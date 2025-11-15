import { NextRequest, NextResponse } from 'next/server';
import {
  getElevenLabsTagById,
  updateElevenLabsTag,
  deleteElevenLabsTag,
} from '@/lib/db';

/**
 * GET /api/eleven-labs-tags/[id]
 * ElevenLabsタグを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: 'Invalid tag ID' },
        { status: 400 }
      );
    }

    const tag = await getElevenLabsTagById(tagId);

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
    console.error('Failed to get ElevenLabs tag:', error);
    return NextResponse.json(
      { error: 'Failed to get ElevenLabs tag', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/eleven-labs-tags/[id]
 * ElevenLabsタグを更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: 'Invalid tag ID' },
        { status: 400 }
      );
    }

    const tag = await getElevenLabsTagById(tagId);

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    const updatedTag = await updateElevenLabsTag(tagId, {
      name,
      description,
    });

    return NextResponse.json({
      success: true,
      tag: updatedTag,
    });
  } catch (error: any) {
    console.error('Failed to update ElevenLabs tag:', error);
    return NextResponse.json(
      { error: 'Failed to update ElevenLabs tag', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/eleven-labs-tags/[id]
 * ElevenLabsタグを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tagId = parseInt(id);

    if (isNaN(tagId)) {
      return NextResponse.json(
        { error: 'Invalid tag ID' },
        { status: 400 }
      );
    }

    const tag = await getElevenLabsTagById(tagId);

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag not found' },
        { status: 404 }
      );
    }

    const deleted = await deleteElevenLabsTag(tagId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete tag' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error: any) {
    console.error('Failed to delete ElevenLabs tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete ElevenLabs tag', details: error.message },
      { status: 500 }
    );
  }
}
