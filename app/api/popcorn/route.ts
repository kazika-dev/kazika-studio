import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/gcp-storage';

// Next.jsのルートハンドラの設定
export const maxDuration = 300; // 5分（秒単位）

// ジョブステータスをポーリングする間隔（ミリ秒）
const POLLING_INTERVAL = 3000; // 3秒
// 最大ポーリング時間（5分）- ジョブが完了するまで待つ
const MAX_POLLING_TIME = 300000; // 5分 = 300秒

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      aspectRatio = '3:4',
      count = 1,
      quality = '720p',
      seed,
      inputImagePaths,
      presetId,
      enhancePrompt = false,
    } = await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 4) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 4' },
        { status: 400 }
      );
    }

    if (seed !== undefined && (seed < 1 || seed > 1000000)) {
      return NextResponse.json(
        { error: 'Seed must be between 1 and 1000000' },
        { status: 400 }
      );
    }

    const apiKey = process.env.HIGGSFIELD_API_KEY;
    const apiSecret = process.env.HIGGSFIELD_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'HIGGSFIELD_API_KEY and HIGGSFIELD_SECRET are not configured in environment variables' },
        { status: 500 }
      );
    }

    // 入力画像のURLを生成（オプショナル、最大8枚）
    const imageReferences: Array<{ type: string; image_url: string }> = [];
    if (inputImagePaths && Array.isArray(inputImagePaths) && inputImagePaths.length > 0) {
      const limitedPaths = inputImagePaths.slice(0, 8);

      for (const imagePath of limitedPaths) {
        try {
          // 署名付きURLを生成（24時間有効）
          const signedUrl = await getSignedUrl(imagePath, 24 * 60);
          imageReferences.push({
            type: 'image_url',
            image_url: signedUrl,
          });
        } catch (error: any) {
          console.error('Failed to generate signed URL:', error);
          return NextResponse.json(
            { error: 'Failed to generate image URL', details: error.message },
            { status: 500 }
          );
        }
      }
    }

    console.log('Popcorn image generation request:', {
      promptLength: prompt.length,
      aspectRatio,
      count,
      quality,
      seed,
      presetId,
      enhancePrompt,
      imageReferencesCount: imageReferences.length,
    });

    // リクエストボディを構築
    const requestBody: any = {
      params: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        count: count,
        quality: quality,
      },
    };

    // オプショナルパラメータの追加
    if (seed !== undefined) {
      requestBody.params.seed = seed;
    }

    if (presetId) {
      requestBody.params.preset_id = presetId;
    }

    if (enhancePrompt) {
      requestBody.params.enhance_prompt = enhancePrompt;
    }

    if (imageReferences.length > 0) {
      requestBody.params.image_references = imageReferences;
    }

    console.log('Popcorn request body:', JSON.stringify(requestBody, null, 2));

    // ジョブを作成
    const createResponse = await fetch('https://platform.higgsfield.ai/v1/text2image/keyframes', {
      method: 'POST',
      headers: {
        'hf-api-key': apiKey,
        'hf-secret': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Popcorn API error (create job):', errorText);
      return NextResponse.json(
        {
          error: 'Failed to create image generation job',
          details: errorText,
        },
        { status: createResponse.status }
      );
    }

    const createData = await createResponse.json();
    console.log('Popcorn job created:', JSON.stringify(createData, null, 2));

    if (!createData.id || !createData.jobs || createData.jobs.length === 0) {
      return NextResponse.json(
        { error: 'Invalid response from Popcorn API: missing job ID' },
        { status: 500 }
      );
    }

    const jobSetId = createData.id;
    const jobIds = createData.jobs.map((job: any) => job.id);

    console.log(`Polling jobs ${jobIds.join(', ')} in job set ${jobSetId}...`);

    // 最初に3秒待ってから開始（APIの処理時間を考慮）
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ポーリング（最大100回 = 約300秒 = 5分）
    const startTime = Date.now();
    const imageUrls: string[] = [];
    let pollCount = 0;
    const maxPollAttempts = 100; // 最大100回のポーリング（約5分間）

    while (pollCount < maxPollAttempts && Date.now() - startTime < MAX_POLLING_TIME) {
      pollCount++;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      // 10回ごと、または最初と最後にログ出力
      if (pollCount === 1 || pollCount === maxPollAttempts || pollCount % 10 === 0) {
        console.log(`Polling... (${elapsedSeconds}s elapsed, attempt ${pollCount}/${maxPollAttempts})`);
      }

      // ステータスをチェック
      const endpoints = [
        `https://platform.higgsfield.ai/job-sets/${jobSetId}`,
        `https://platform.higgsfield.ai/job-set/${jobSetId}`,
        `https://platform.higgsfield.ai/v1/job-sets/${jobSetId}`,
        `https://platform.higgsfield.ai/api/job-sets/${jobSetId}`,
        `https://platform.higgsfield.ai/v1/text2image/keyframes/job-sets/${jobSetId}`,
      ];

      let statusData: any = null;
      let foundEndpoint = false;

      for (const endpoint of endpoints) {
        try {
          const statusResponse = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'hf-api-key': apiKey,
              'hf-secret': apiSecret,
            },
          });

          const responseText = await statusResponse.text();

          // 最初の3回のみ詳細ログ
          if (pollCount <= 3) {
            console.log(`Endpoint: ${endpoint}`);
            console.log(`Status: ${statusResponse.status}`);
            console.log(`Response: ${responseText.substring(0, 200)}`);
          }

          if (statusResponse.ok) {
            statusData = JSON.parse(responseText);
            // 最初の1回または20回ごとにログ
            if (pollCount === 1 || pollCount % 20 === 0) {
              console.log(`✓ Found working endpoint: ${endpoint}`);
              if (pollCount === 1) {
                console.log('Status data:', JSON.stringify(statusData, null, 2));
              }
            }
            foundEndpoint = true;
            break;
          }
        } catch (error: any) {
          // 最初の3回のみエラーログ
          if (pollCount <= 3) {
            console.error(`Error with endpoint ${endpoint}:`, error.message);
          }
        }
      }

      if (!foundEndpoint || !statusData) {
        // 最初または10回ごとにエラーログ
        if (pollCount === 1 || pollCount % 10 === 0) {
          console.error(`All status check endpoints failed (attempt ${pollCount}), retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }

      // すべてのジョブをチェック
      let allCompleted = true;
      let anyFailed = false;
      let anyNsfw = false;

      if (statusData.jobs && Array.isArray(statusData.jobs)) {
        for (const jobId of jobIds) {
          const job = statusData.jobs.find((j: any) => j.id === jobId);

          if (!job) {
            console.log(`Job ${jobId} not found in status response`);
            allCompleted = false;
            continue;
          }

          const jobStatus = job.status;

          // 詳細ログは10回ごと、またはステータス変化時
          if (pollCount === 1 || pollCount % 10 === 0 || jobStatus === 'completed' || jobStatus === 'failed' || jobStatus === 'nsfw') {
            console.log(`Job ${jobId} status: ${jobStatus}`);
            if (jobStatus !== 'queued' && jobStatus !== 'in_progress') {
              console.log(`Job results:`, JSON.stringify(job.results, null, 2));
            }
          }

          if (jobStatus === 'completed') {
            // 画像URLを取得
            if (job.results?.raw?.url) {
              if (!imageUrls.includes(job.results.raw.url)) {
                console.log(`Found raw image URL: ${job.results.raw.url}`);
                imageUrls.push(job.results.raw.url);
              }
            } else if (job.results?.min?.url) {
              if (!imageUrls.includes(job.results.min.url)) {
                console.log(`Found min image URL: ${job.results.min.url}`);
                imageUrls.push(job.results.min.url);
              }
            } else {
              console.warn(`Job ${jobId} completed but no image URL found in results:`, job.results);
            }
          } else if (jobStatus === 'failed') {
            console.error(`Job ${jobId} failed`);
            anyFailed = true;
            break;
          } else if (jobStatus === 'nsfw') {
            console.error(`Job ${jobId} flagged as NSFW`);
            anyNsfw = true;
            break;
          } else {
            // queued または in_progress
            allCompleted = false;
          }
        }
      } else {
        console.warn('No jobs found in status response');
        allCompleted = false;
      }

      // 進捗ログは10回ごと、または画像が見つかった時
      if (pollCount === 1 || pollCount % 10 === 0 || imageUrls.length > 0 || pollCount === maxPollAttempts) {
        console.log(`Polling attempt ${pollCount}: ${imageUrls.length}/${count} images completed (${elapsedSeconds}s elapsed)`);

        if (imageUrls.length > 0) {
          console.log(`Current image URLs:`, imageUrls);
        }
      }

      if (anyFailed) {
        return NextResponse.json(
          { error: 'Image generation failed' },
          { status: 500 }
        );
      }

      if (anyNsfw) {
        return NextResponse.json(
          { error: 'Image generation blocked: content flagged as NSFW' },
          { status: 400 }
        );
      }

      // 期待される数の画像URLが取得できたら完了
      if (imageUrls.length >= count) {
        console.log(`Successfully got ${imageUrls.length} images (requested ${count})`);
        break;
      }

      // すべてのジョブが完了し、画像URLも期待される数だけある場合
      if (allCompleted && imageUrls.length === count) {
        console.log('All jobs completed and all images retrieved');
        break;
      }

      // まだ処理中の場合は待機
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }

    if (imageUrls.length === 0) {
      console.warn('Image generation timeout or status check failed');
      console.log('Returning job IDs for manual checking...');

      return NextResponse.json({
        success: false,
        message: 'Image generation is in progress. Please check Higgsfield dashboard for status.',
        jobSetId: jobSetId,
        jobIds: jobIds,
        dashboardUrl: `https://platform.higgsfield.ai/dashboard`,
        note: 'Status check endpoint not available. The images may still be generating.',
      }, { status: 202 }); // 202 Accepted
    }

    console.log('=== Popcorn API Success ===');
    console.log(`Generated ${imageUrls.length} images`);
    console.log('Image URLs:', imageUrls);
    console.log('==========================');

    return NextResponse.json({
      success: true,
      imageUrls: imageUrls,
      jobSetId: jobSetId,
      count: imageUrls.length,
    });

  } catch (error: any) {
    console.error('Popcorn API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate images',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
