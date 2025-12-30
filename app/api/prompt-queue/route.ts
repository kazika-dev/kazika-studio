import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getPromptQueuesByUserId,
  createPromptQueue,
} from '@/lib/db';
import type {
  CreatePromptQueueRequest,
  PromptQueueStatus,
} from '@/types/prompt-queue';

/**
 * GET /api/prompt-queue
 * プロンプトキュー一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PromptQueueStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const offset = (page - 1) * limit;

    const { queues, total } = await getPromptQueuesByUserId(user.id, {
      status: status || undefined,
      limit,
      offset,
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      queues,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Failed to get prompt queues:', error);
    return NextResponse.json(
      { error: 'Failed to get prompt queues', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prompt-queue
 * プロンプトキューを作成
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePromptQueueRequest = await request.json();

    // バリデーション
    if (!body.prompt || body.prompt.trim() === '') {
      return NextResponse.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    if (body.images && body.images.length > 8) {
      return NextResponse.json(
        { error: 'Maximum 8 images allowed' },
        { status: 400 }
      );
    }

    // 画像のバリデーション
    if (body.images) {
      const validImageTypes = ['character_sheet', 'output', 'scene', 'prop'];
      for (const img of body.images) {
        if (!validImageTypes.includes(img.image_type)) {
          return NextResponse.json(
            { error: `Invalid image_type: ${img.image_type}. Valid types: ${validImageTypes.join(', ')}` },
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

    const queue = await createPromptQueue(user.id, {
      name: body.name,
      prompt: body.prompt,
      negative_prompt: body.negative_prompt,
      model: body.model,
      aspect_ratio: body.aspect_ratio,
      priority: body.priority,
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
    console.error('Failed to create prompt queue:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt queue', details: error.message },
      { status: 500 }
    );
  }
}
