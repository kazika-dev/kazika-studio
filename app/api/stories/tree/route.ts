import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { getStoriesTreeByUserId } from '@/lib/db';

/**
 * GET /api/stories/tree
 * ユーザーの全ストーリー・シーン・会話の階層構造を取得
 */
export async function GET(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tree = await getStoriesTreeByUserId(user.id);

    return NextResponse.json({
      success: true,
      data: {
        tree,
      },
    });
  } catch (error) {
    console.error('Failed to fetch stories tree:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stories tree' },
      { status: 500 }
    );
  }
}
