import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getPromptQueueById,
  updatePromptQueue,
  deletePromptQueue,
} from '@/lib/db';
import type { UpdatePromptQueueRequest } from '@/types/prompt-queue';

/**
 * GET /api/prompt-queue/[id]
 * プロンプトキュー詳細を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const queueId = parseInt(id, 10);

    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queue ID' }, { status: 400 });
    }

    const queue = await getPromptQueueById(queueId);

    if (!queue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    // 所有権チェック
    if (queue.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      queue,
    });
  } catch (error: any) {
    console.error('Failed to get prompt queue:', error);
    return NextResponse.json(
      { error: 'Failed to get prompt queue', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/prompt-queue/[id]
 * プロンプトキューを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const queueId = parseInt(id, 10);

    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queue ID' }, { status: 400 });
    }

    // 既存のキューを取得して所有権チェック
    const existingQueue = await getPromptQueueById(queueId);

    if (!existingQueue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    if (existingQueue.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: UpdatePromptQueueRequest = await request.json();

    // 画像数のバリデーション
    if (body.images && body.images.length > 8) {
      return NextResponse.json(
        { error: 'Maximum 8 images allowed' },
        { status: 400 }
      );
    }

    // 画像のバリデーション
    if (body.images) {
      for (const img of body.images) {
        if (!['character_sheet', 'output'].includes(img.image_type)) {
          return NextResponse.json(
            { error: `Invalid image_type: ${img.image_type}` },
            { status: 400 }
          );
        }
        if (!img.reference_id || typeof img.reference_id !== 'number') {
          return NextResponse.json(
            { error: 'reference_id must be a number' },
            { status: 400 }
          );
        }
      }
    }

    const queue = await updatePromptQueue(queueId, {
      name: body.name,
      prompt: body.prompt,
      negative_prompt: body.negative_prompt,
      model: body.model,
      aspect_ratio: body.aspect_ratio,
      priority: body.priority,
      status: body.status,
      enhance_prompt: body.enhance_prompt,
      enhanced_prompt: body.enhanced_prompt,
      metadata: body.metadata,
      images: body.images,
    });

    return NextResponse.json({
      success: true,
      queue,
    });
  } catch (error: any) {
    console.error('Failed to update prompt queue:', error);
    return NextResponse.json(
      { error: 'Failed to update prompt queue', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/prompt-queue/[id]
 * プロンプトキューを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const queueId = parseInt(id, 10);

    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queue ID' }, { status: 400 });
    }

    // 既存のキューを取得して所有権チェック
    const existingQueue = await getPromptQueueById(queueId);

    if (!existingQueue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    if (existingQueue.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deletePromptQueue(queueId);

    return NextResponse.json({
      success: true,
      message: 'Queue deleted successfully',
    });
  } catch (error: any) {
    console.error('Failed to delete prompt queue:', error);
    return NextResponse.json(
      { error: 'Failed to delete prompt queue', details: error.message },
      { status: 500 }
    );
  }
}
