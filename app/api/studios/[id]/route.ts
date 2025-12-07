import { NextRequest, NextResponse } from 'next/server';
import { getStudioById, updateStudio, deleteStudio } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/studios/[id]
 * 特定のスタジオを取得
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

    return NextResponse.json({
      success: true,
      studio,
    });
  } catch (error: any) {
    console.error('Get studio error:', error);
    return NextResponse.json(
      { error: 'Failed to get studio', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/studios/[id]
 * スタジオを更新
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
    const { name, description, thumbnail_url, metadata } = body;

    const updatedStudio = await updateStudio(studioId, {
      name,
      description,
      thumbnail_url,
      metadata,
    });

    return NextResponse.json({
      success: true,
      studio: updatedStudio,
    });
  } catch (error: any) {
    console.error('Update studio error:', error);
    return NextResponse.json(
      { error: 'Failed to update studio', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/studios/[id]
 * スタジオを削除
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

    await deleteStudio(studioId);

    return NextResponse.json({
      success: true,
      message: 'Studio deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete studio error:', error);
    return NextResponse.json(
      { error: 'Failed to delete studio', details: error.message },
      { status: 500 }
    );
  }
}
