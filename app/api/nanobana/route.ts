import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = '1:1' } = await request.json();

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

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
          message: 'The model did not return image data. Check API configuration.',
          debug: {
            candidatesCount: candidates.length,
            hasContent: !!candidates[0]?.content,
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageData: {
        mimeType: imageData.mimeType,
        data: imageData.data, // Base64エンコードされた画像データ
      },
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
