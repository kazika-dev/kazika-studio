import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl } from '@/lib/gcp-storage';

// Next.jsのルートハンドラの設定
export const maxDuration = 600; // 10分（秒単位）

// ジョブステータスをポーリングする間隔（ミリ秒）
const POLLING_INTERVAL = 5000; // 5秒
// 最大ポーリング時間（10分）
const MAX_POLLING_TIME = 600000; // 10分 = 600秒

export async function POST(request: NextRequest) {
  try {
    const { prompt, duration = 5, cfgScale = 0.5, enhancePrompt = false, inputImagePath, negativePrompt = '' } = await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
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

    // 入力画像のURLを生成（GCP Storageのパスから署名付きURLを生成）
    let inputImageUrl: string | null = null;
    if (inputImagePath) {
      try {
        // 署名付きURLを生成（24時間有効）
        inputImageUrl = await getSignedUrl(inputImagePath, 24 * 60);
        console.log('Generated signed URL for input image:', inputImageUrl);
      } catch (error: any) {
        console.error('Failed to generate signed URL:', error);
        return NextResponse.json(
          { error: 'Failed to generate image URL', details: error.message },
          { status: 500 }
        );
      }
    }

    console.log('Higgsfield video generation request:', {
      promptLength: prompt.length,
      duration,
      cfgScale,
      enhancePrompt,
      hasInputImage: !!inputImageUrl,
    });

    // リクエストボディを構築
    const requestBody: any = {
      params: {
        model: 'kling-v2-5-turbo',
        prompt: prompt,
        duration: duration,
        cfg_scale: cfgScale,
        enhance_prompt: enhancePrompt,
      },
    };

    // ネガティブプロンプトがある場合のみ追加
    if (negativePrompt && negativePrompt.trim()) {
      requestBody.params.negative_prompt = negativePrompt;
    }

    // 入力画像がある場合は追加
    if (inputImageUrl) {
      requestBody.params.input_image = {
        type: 'image_url',
        image_url: inputImageUrl,
      };
    }

    console.log('Higgsfield request body:', JSON.stringify(requestBody, null, 2));

    // ジョブを作成
    const createResponse = await fetch('https://platform.higgsfield.ai/generate/kling-2-5', {
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
      console.error('Higgsfield API error (create job):', errorText);
      return NextResponse.json(
        {
          error: 'Failed to create video generation job',
          details: errorText,
        },
        { status: createResponse.status }
      );
    }

    const createData = await createResponse.json();
    console.log('Higgsfield job created:', JSON.stringify(createData, null, 2));

    if (!createData.id || !createData.jobs || createData.jobs.length === 0) {
      return NextResponse.json(
        { error: 'Invalid response from Higgsfield API: missing job ID' },
        { status: 500 }
      );
    }

    const jobSetId = createData.id;
    const jobId = createData.jobs[0].id;

    console.log(`Polling job ${jobId} in job set ${jobSetId}...`);
    console.log('Trying different status check endpoints...');

    // ジョブのステータスをポーリング
    const startTime = Date.now();
    let jobStatus = 'queued';
    let videoUrl: string | null = null;
    let pollCount = 0;
    const maxPollAttempts = Math.floor(MAX_POLLING_TIME / POLLING_INTERVAL);

    while (Date.now() - startTime < MAX_POLLING_TIME) {
      pollCount++;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      if (pollCount === 1) {
        console.log(`Starting polling (will check every ${POLLING_INTERVAL/1000}s for up to ${MAX_POLLING_TIME/1000}s)...`);
      } else if (pollCount % 10 === 0) {
        console.log(`Polling... (${elapsedSeconds}s elapsed, attempt ${pollCount}/${maxPollAttempts})`);
      }

      // 複数のエンドポイントを試す
      const endpoints = [
        `https://platform.higgsfield.ai/job-sets/${jobSetId}`, // 複数形に戻す
        `https://platform.higgsfield.ai/job-set/${jobSetId}`, // 単数形
        `https://platform.higgsfield.ai/v1/job-sets/${jobSetId}`, // v1パス
        `https://platform.higgsfield.ai/api/job-sets/${jobSetId}`, // apiパス
        `https://platform.higgsfield.ai/jobs/${jobId}`, // 個別ジョブ
        `https://platform.higgsfield.ai/generate/kling-2-5/job-sets/${jobSetId}`, // 生成パス配下
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

          // 最初のポーリングのみ詳細ログ
          if (pollCount === 1) {
            console.log(`Endpoint: ${endpoint}`);
            console.log(`Status: ${statusResponse.status}`);
            console.log(`Response: ${responseText.substring(0, 200)}`);
          }

          if (statusResponse.ok) {
            statusData = JSON.parse(responseText);
            if (pollCount === 1 || pollCount % 20 === 0) {
              console.log(`✓ Found working endpoint: ${endpoint}`);
              console.log('Status data:', JSON.stringify(statusData, null, 2));
            }
            foundEndpoint = true;
            break;
          }
        } catch (error: any) {
          if (pollCount === 1) {
            console.error(`Error with endpoint ${endpoint}:`, error.message);
          }
        }
      }

      if (!foundEndpoint || !statusData) {
        if (pollCount === 1 || pollCount % 20 === 0) {
          console.error(`All status check endpoints failed (attempt ${pollCount}), retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }

      // statusDataの構造を確認
      let job: any = null;

      // パターン1: jobs配列がある場合
      if (statusData.jobs && Array.isArray(statusData.jobs)) {
        job = statusData.jobs.find((j: any) => j.id === jobId);
      }
      // パターン2: statusDataそのものがジョブの場合
      else if (statusData.id === jobId) {
        job = statusData;
      }
      // パターン3: statusDataにjobsがあるがIDが一致しない場合は最初のjobを使う
      else if (statusData.jobs && statusData.jobs.length > 0) {
        job = statusData.jobs[0];
      }

      if (!job) {
        console.error('Job not found in response, retrying...');
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
        continue;
      }

      jobStatus = job.status;

      if (pollCount === 1 || pollCount % 10 === 0 || jobStatus !== 'queued' && jobStatus !== 'in_progress') {
        console.log(`Job status: ${jobStatus} (${elapsedSeconds}s elapsed)`);
      }

      if (jobStatus === 'completed') {
        // 動画URLを取得
        if (job.results?.raw?.url) {
          videoUrl = job.results.raw.url;
          console.log('Video generation completed:', videoUrl);
          break;
        } else if (job.results?.min?.url) {
          videoUrl = job.results.min.url;
          console.log('Video generation completed (min version):', videoUrl);
          break;
        } else {
          return NextResponse.json(
            { error: 'Job completed but no video URL found' },
            { status: 500 }
          );
        }
      } else if (jobStatus === 'failed') {
        return NextResponse.json(
          { error: 'Video generation failed' },
          { status: 500 }
        );
      } else if (jobStatus === 'nsfw') {
        return NextResponse.json(
          { error: 'Video generation blocked: content flagged as NSFW' },
          { status: 400 }
        );
      }

      // まだ処理中の場合は待機
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }

    if (!videoUrl) {
      console.warn('Video generation timeout or status check failed');
      console.log('Returning job IDs for manual checking...');

      // タイムアウトまたはステータスチェック失敗の場合
      // ジョブIDを返して、ユーザーがHiggsfieldのダッシュボードで確認できるようにする
      return NextResponse.json({
        success: false,
        message: 'Video generation is in progress. Please check Higgsfield dashboard for status.',
        jobSetId: jobSetId,
        jobId: jobId,
        dashboardUrl: `https://platform.higgsfield.ai/dashboard`,
        note: 'Status check endpoint not available. The video may still be generating.',
      }, { status: 202 }); // 202 Accepted
    }

    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
      jobId: jobId,
      duration: duration,
    });
  } catch (error: any) {
    console.error('Higgsfield API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate video',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
