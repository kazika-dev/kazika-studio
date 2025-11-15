import { NextRequest, NextResponse } from 'next/server';
import { getAllElevenLabsTags, createElevenLabsTag } from '@/lib/db';

/**
 * GET /api/eleven-labs-tags
 * ElevenLabsタグ一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const tags = await getAllElevenLabsTags();

    return NextResponse.json({
      success: true,
      tags,
    });
  } catch (error: any) {
    console.error('Failed to get ElevenLabs tags:', error);
    return NextResponse.json(
      { error: 'Failed to get ElevenLabs tags', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/eleven-labs-tags
 * ElevenLabsタグを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    const tag = await createElevenLabsTag({
      name,
      description,
    });

    return NextResponse.json({
      success: true,
      tag,
    });
  } catch (error: any) {
    console.error('Failed to create ElevenLabs tag:', error);
    return NextResponse.json(
      { error: 'Failed to create ElevenLabs tag', details: error.message },
      { status: 500 }
    );
  }
}
