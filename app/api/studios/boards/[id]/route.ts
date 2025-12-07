import { NextRequest, NextResponse } from 'next/server';
import { getBoardById, getStudioById, updateBoard, deleteBoard } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/studios/boards/[id]
 * 特定のボードを取得
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
    const boardId = parseInt(id);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    const board = await getBoardById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // 所有者確認（スタジオの所有者をチェック）
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      board,
    });
  } catch (error: any) {
    console.error('Get board error:', error);
    return NextResponse.json(
      { error: 'Failed to get board', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/studios/boards/[id]
 * ボードを更新
 */
export async function PUT(
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
    const boardId = parseInt(id);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    const board = await getBoardById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // 所有者確認（スタジオの所有者をチェック）
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const updatedBoard = await updateBoard(boardId, body);

    return NextResponse.json({
      success: true,
      board: updatedBoard,
    });
  } catch (error: any) {
    console.error('Update board error:', error);
    return NextResponse.json(
      { error: 'Failed to update board', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/studios/boards/[id]
 * ボードを削除
 */
export async function DELETE(
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
    const boardId = parseInt(id);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid board ID' },
        { status: 400 }
      );
    }

    const board = await getBoardById(boardId);

    if (!board) {
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 404 }
      );
    }

    // 所有者確認（スタジオの所有者をチェック）
    const studio = await getStudioById(board.studio_id);
    if (!studio || studio.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await deleteBoard(boardId);

    return NextResponse.json({
      success: true,
      message: 'Board deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete board error:', error);
    return NextResponse.json(
      { error: 'Failed to delete board', details: error.message },
      { status: 500 }
    );
  }
}
