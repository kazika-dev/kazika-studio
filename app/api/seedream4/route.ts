import { NextRequest, NextResponse } from 'next/server';
import { getSignedUrl, getFileFromStorage } from '@/lib/gcp-storage';
import { compressImagesForApi } from '@/lib/utils/imageCompression';

// Next.jsのルートハンドラの設定
export const maxDuration = 300; // 5分（秒単位）

// ジョブステータスをポーリングする間隔（ミリ秒）
const POLLING_INTERVAL = 3000; // 3秒
// 最大ポーリング時間（5分）
const MAX_POLLING_TIME = 300000; // 5分 = 300秒

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = '4:3', quality = 'basic', inputImagePaths } = await request.json();

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!inputImagePaths || !Array.isArray(inputImagePaths) || inputImagePaths.length === 0) {
      return NextResponse.json(
        { error: 'At least one input image is required' },
        { status: 400 }
      );
    }

    if (inputImagePaths.length > 8) {
      return NextResponse.json(
        { error: 'Maximum 8 input images allowed' },
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

    // 入力画像を取得してbase64に変換し、圧縮
    const inputImages: Array<{ mimeType: string; data: string }> = [];
    for (const imagePath of inputImagePaths) {
      try {
        // GCP Storageから画像を取得
        const { data: imageBuffer, contentType } = await getFileFromStorage(imagePath);
        const base64Data = Buffer.from(imageBuffer).toString('base64');

        inputImages.push({
          mimeType: contentType,
          data: base64Data,
        });
      } catch (error: any) {
        console.error('Failed to load image from storage:', error);
        return NextResponse.json(
          { error: 'Failed to load image', details: error.message },
          { status: 500 }
        );
      }
    }

    // 画像を合計5MB以下に圧縮
    const compressedImages = await compressImagesForApi(inputImages);

    // 圧縮後の画像からdata URIを生成（Seedream4 APIはdata URIに対応）
    const inputImageDataUris = compressedImages.map(img =>
      `data:${img.mimeType};base64,${img.data}`
    );

    console.log('Seedream4 image generation request:', {
      promptLength: prompt.length,
      aspectRatio,
      quality,
      inputImageCount: inputImageDataUris.length,
      totalSize: compressedImages.reduce((sum, img) => {
        const padding = (img.data.match(/=/g) || []).length;
        return sum + (img.data.length * 3) / 4 - padding;
      }, 0),
    });

    // リクエストボディを構築
    const requestBody: any = {
      params: {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        quality: quality,
        input_images: inputImageDataUris.map(dataUri => ({
          type: 'image_url',
          image_url: dataUri,
        })),
      },
    };

    console.log('Seedream4 request body:', JSON.stringify(requestBody, null, 2));

    // ジョブを作成
    const createResponse = await fetch('https://platform.higgsfield.ai/v1/text2image/seedream', {
      method: 'POST',
      headers: {
        'hf-api-key': apiKey,
        'hf-secret': apiSecret,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Seedream4 API error (create job):', errorText);
      return NextResponse.json(
        {
          error: 'Failed to create image generation job',
          details: errorText,
        },
        { status: createResponse.status }
      );
    }

    const createData = await createResponse.json();
    console.log('Seedream4 job created:', JSON.stringify(createData, null, 2));

    if (!createData.id || !createData.jobs || createData.jobs.length === 0) {
      return NextResponse.json(
        { error: 'Invalid response from Seedream4 API: missing job ID' },
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
    let imageUrl: string | null = null;
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
        `https://platform.higgsfield.ai/job-sets/${jobSetId}`,
        `https://platform.higgsfield.ai/job-set/${jobSetId}`,
        `https://platform.higgsfield.ai/v1/job-sets/${jobSetId}`,
        `https://platform.higgsfield.ai/api/job-sets/${jobSetId}`,
        `https://platform.higgsfield.ai/jobs/${jobId}`,
        `https://platform.higgsfield.ai/v1/text2image/seedream/job-sets/${jobSetId}`,
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
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        // 画像URLを取得
        if (job.results?.raw?.url) {
          imageUrl = job.results.raw.url;
          console.log('Image generation completed:', imageUrl);
          break;
        } else if (job.results?.min?.url) {
          imageUrl = job.results.min.url;
          console.log('Image generation completed (min version):', imageUrl);
          break;
        } else {
          return NextResponse.json(
            { error: 'Job completed but no image URL found' },
            { status: 500 }
          );
        }
      } else if (jobStatus === 'failed') {
        return NextResponse.json(
          { error: 'Image generation failed' },
          { status: 500 }
        );
      } else if (jobStatus === 'nsfw') {
        return NextResponse.json(
          { error: 'Image generation blocked: content flagged as NSFW' },
          { status: 400 }
        );
      }

      // まだ処理中の場合は待機
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }

    if (!imageUrl) {
      console.warn('Image generation timeout or status check failed');
      console.log('Returning job IDs for manual checking...');

      // タイムアウトまたはステータスチェック失敗の場合
      return NextResponse.json({
        success: false,
        message: 'Image generation is in progress. Please check Higgsfield dashboard for status.',
        jobSetId: jobSetId,
        jobId: jobId,
        dashboardUrl: `https://platform.higgsfield.ai/dashboard`,
        note: 'Status check endpoint not available. The image may still be generating.',
      }, { status: 202 }); // 202 Accepted
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      jobId: jobId,
    });

  } catch (error: any) {
    console.error('Seedream4 API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate image',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
