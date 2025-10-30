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
    const { prompt, model: requestedModel = 'gemini-2.5-flash' } = await request.json();

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

    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({
      success: true,
      response: text,
      model,
      originalModel: requestedModel !== model ? requestedModel : undefined,
    });
  } catch (error: any) {
    console.error('Gemini API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error.message
      },
      { status: 500 }
    );
  }
}
