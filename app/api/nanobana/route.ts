import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage } from '@/lib/gcp-storage';

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = '1:1', referenceImages } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in environment variables' },
        { status: 500 }
      );
    }

    // 公式ドキュメントに基づく実装
    const genAI = new GoogleGenerativeAI(apiKey);

    // 画像生成専用モデルを使用
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
    });

    // 画像生成設定
    const generationConfig = {
      responseModalities: ['IMAGE'],
      imageConfig: {
        aspectRatio: aspectRatio,
      },
    };

    // コンテンツのpartsを構築（プロンプト + 参照画像）
    const parts: any[] = [{ text: prompt }];

    // 参照画像がある場合は追加
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Adding ${referenceImages.length} reference image(s) to Nanobana request`);
      referenceImages.forEach((img: { mimeType: string; data: string }) => {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data
          }
        });
      });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: generationConfig as any,
    });

    const response = result.response;

    // 画像データを取得
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { error: 'No candidates in response' },
        { status: 500 }
      );
    }

    // 画像データを探す
    let imageData = null;
    for (const candidate of candidates) {
      // finishReasonをチェック
      if (candidate.finishReason && candidate.finishReason.toString() === 'NO_IMAGE') {
        console.error('Model did not generate an image. FinishReason:', candidate.finishReason);
        return NextResponse.json(
          {
            error: 'Image generation failed',
            message: 'The model could not generate an image for this prompt. The prompt may be blocked by safety filters or may not be suitable for image generation. Try a different prompt.',
            finishReason: candidate.finishReason,
          },
          { status: 400 }
        );
      }

      if (candidate.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
            imageData = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data,
            };
            break;
          }
        }
      }
      if (imageData) break;
    }

    if (!imageData) {
      // デバッグ情報を出力
      console.error('Response structure:', JSON.stringify(response, null, 2));

      return NextResponse.json(
        {
          error: 'No image data found in response',
          message: 'The model did not return image data. The prompt may have been blocked by safety filters or is not suitable for image generation.',
          debug: {
            candidatesCount: candidates.length,
            hasContent: !!candidates[0]?.content,
            finishReasons: candidates.map(c => c.finishReason),
          }
        },
        { status: 500 }
      );
    }

    // GCP Storageに画像をアップロード（環境変数が設定されている場合のみ）
    let storageUrl: string | undefined;
    if (process.env.GCP_SERVICE_ACCOUNT_KEY && process.env.GCP_STORAGE_BUCKET) {
      try {
        storageUrl = await uploadImageToStorage(
          imageData.data,
          imageData.mimeType
        );
        console.log('Image uploaded to GCP Storage:', storageUrl);
      } catch (storageError: any) {
        console.error('Failed to upload to GCP Storage:', storageError);
        // Storageへのアップロードが失敗してもエラーにはせず、警告として記録
        // Base64データは引き続き返す
      }
    } else {
      console.log('GCP Storage not configured, skipping upload');
    }

    return NextResponse.json({
      success: true,
      imageData: {
        mimeType: imageData.mimeType,
        data: imageData.data, // Base64エンコードされた画像データ
      },
      storageUrl, // GCP StorageのURL（アップロード成功時のみ）
      model: 'gemini-2.5-flash-image',
    });
  } catch (error: any) {
    console.error('Nanobana API error:', error);
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
