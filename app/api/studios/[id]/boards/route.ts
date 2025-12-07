import { NextRequest, NextResponse } from 'next/server';
import { getStudioById, getBoardsByStudioId, createBoard } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/studios/[id]/boards
 * スタジオの全ボードを取得（時系列順）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const studioId = parseInt(id);
    if (isNaN(studioId)) {
      return NextResponse.json(
        { error: 'Invalid studio ID' },
        { status: 400 }
      );
    }

    const studio = await getStudioById(studioId);

    if (!studio) {
      return NextResponse.json(
        { error: 'Studio not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const boards = await getBoardsByStudioId(studioId);

    return NextResponse.json({
      success: true,
      boards,
    });
  } catch (error: any) {
    console.error('Get boards error:', error);
    return NextResponse.json(
      { error: 'Failed to get boards', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/studios/[id]/boards
 * 新しいボードを作成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const studioId = parseInt(id);
    if (isNaN(studioId)) {
      return NextResponse.json(
        { error: 'Invalid studio ID' },
        { status: 400 }
      );
    }

    const studio = await getStudioById(studioId);

    if (!studio) {
      return NextResponse.json(
        { error: 'Studio not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      sequence_order,
      title,
      description,
      workflow_id,
      prompt_text,
      duration_seconds,
      metadata,
    } = body;

    if (sequence_order === undefined || sequence_order === null) {
      return NextResponse.json(
        { error: 'sequence_order is required' },
        { status: 400 }
      );
    }

    const board = await createBoard({
      studio_id: studioId,
      sequence_order,
      title: title || '',
      description: description || '',
      workflow_id: workflow_id || null,
      prompt_text: prompt_text || '',
      duration_seconds: duration_seconds || null,
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      board,
    });
  } catch (error: any) {
    console.error('Create board error:', error);
    return NextResponse.json(
      { error: 'Failed to create board', details: error.message },
      { status: 500 }
    );
  }
}
