import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// 古いモデル名を新しいモデル名に自動変換
const MODEL_MAPPING: Record<string, string> = {
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-flash': 'gemini-2.5-flash',
};

export async function POST(request: NextRequest) {
  try {
    const {
      prompt,
      model: requestedModel = 'gemini-2.5-flash',
      images
    } = await request.json();

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

    // 古いモデル名を新しいモデル名に変換
    const model = MODEL_MAPPING[requestedModel] || requestedModel;

    if (requestedModel !== model) {
      console.log(`Model mapping: ${requestedModel} -> ${model}`);
    }
    console.log(`Using Gemini model: ${model}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({ model });

    // 画像がある場合はマルチモーダルリクエストを構築
    let result;
    if (images && images.length > 0) {
      console.log(`Sending multimodal request with ${images.length} image(s)`);

      const parts: any[] = [{ text: prompt }];

      // 画像をinline_data形式で追加
      images.forEach((img: { mimeType: string; data: string }) => {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data
          }
        });
      });

      result = await generativeModel.generateContent({ contents: [{ role: 'user', parts }] });
    } else {
      // テキストのみの場合は従来通り
      result = await generativeModel.generateContent(prompt);
    }

    const response = result.response;
    const text = response.text();

    // レスポンスが不正（HTMLなど）でないか確認
    if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
      console.error('Gemini API returned HTML instead of text:', text.substring(0, 500));

      // HTMLレスポンスの場合、認証エラーの可能性が高い
      if (text.includes('Authentication Required')) {
        return NextResponse.json(
          {
            error: 'Gemini API authentication failed',
            details: 'APIキーが無効または期限切れです。環境変数 GEMINI_API_KEY を確認してください。'
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          error: 'Gemini API returned invalid response',
          details: 'APIからHTMLレスポンスが返されました。APIキーまたはAPIの設定を確認してください。'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response: text,
      model,
      originalModel: requestedModel !== model ? requestedModel : undefined,
    });
  } catch (error: any) {
    console.error('Gemini API error:', error);

    // エラーメッセージをより詳しく解析
    let errorMessage = 'Failed to generate response';
    let errorDetails = error.message;

    // 認証エラーのパターンを検出
    if (error.message?.includes('API key') ||
        error.message?.includes('authentication') ||
        error.message?.includes('unauthorized') ||
        error.message?.includes('401')) {
      errorMessage = 'Gemini API authentication failed';
      errorDetails = 'APIキーが無効または期限切れです。環境変数 GEMINI_API_KEY を確認してください。';
    }
    // クォータエラー
    else if (error.message?.includes('quota') || error.message?.includes('429')) {
      errorMessage = 'Gemini API quota exceeded';
      errorDetails = 'APIの使用量制限に達しました。しばらく待ってから再試行してください。';
    }
    // ネットワークエラー
    else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
      errorMessage = 'Network error';
      errorDetails = 'Gemini APIへの接続に失敗しました。ネットワーク接続を確認してください。';
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        originalError: error.message
      },
      { status: 500 }
    );
  }
}
