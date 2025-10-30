import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 利用可能なモデルをリスト
    const models = await genAI.listModels();

    const modelList = models.models.map((model: any) => ({
      name: model.name,
      displayName: model.displayName,
      description: model.description,
      supportedGenerationMethods: model.supportedGenerationMethods,
    }));

    return NextResponse.json({
      success: true,
      models: modelList,
    });
  } catch (error: any) {
    console.error('Error listing models:', error);
    return NextResponse.json(
      {
        error: 'Failed to list models',
        details: error.message
      },
      { status: 500 }
    );
  }
}
