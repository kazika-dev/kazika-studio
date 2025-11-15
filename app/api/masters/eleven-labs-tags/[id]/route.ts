import { NextRequest, NextResponse } from 'next/server';
import {
  getElevenLabsTagById,
  updateElevenLabsTag,
  deleteElevenLabsTag,
} from '@/lib/db';

/**
 * GET /api/masters/eleven-labs-tags/[id]
 * ElevenLabsタグを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const tag = await getElevenLabsTagById(id);

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tag,
    });
  } catch (error: any) {
    console.error('Failed to get eleven labs tag:', error);
    return NextResponse.json(
      { error: 'Failed to get eleven labs tag', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/masters/eleven-labs-tags/[id]
 * ElevenLabsタグを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { name, description, sort_order, is_active } = body;

    const tag = await updateElevenLabsTag(id, {
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
    console.error('Failed to update eleven labs tag:', error);
    return NextResponse.json(
      { error: 'Failed to update eleven labs tag', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/masters/eleven-labs-tags/[id]
 * ElevenLabsタグを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    await deleteElevenLabsTag(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Failed to delete eleven labs tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete eleven labs tag', details: error.message },
      { status: 500 }
    );
  }
}
