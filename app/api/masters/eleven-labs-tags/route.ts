import { NextRequest, NextResponse } from 'next/server';
import {
  getAllElevenLabsTags,
  createElevenLabsTag,
} from '@/lib/db';

/**
 * GET /api/masters/eleven-labs-tags
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
    console.error('Failed to get eleven labs tags:', error);
    return NextResponse.json(
      { error: 'Failed to get eleven labs tags', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/masters/eleven-labs-tags
 * ElevenLabsタグを作成
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, sort_order, is_active } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const tag = await createElevenLabsTag({
      name,
      description,
      sort_order,
      is_active,
    });

    return NextResponse.json({
      success: true,
      tag,
    });
  } catch (error: any) {
    console.error('Failed to create eleven labs tag:', error);
    return NextResponse.json(
      { error: 'Failed to create eleven labs tag', details: error.message },
      { status: 500 }
    );
  }
}
