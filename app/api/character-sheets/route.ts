import { NextRequest, NextResponse } from 'next/server';
import { getCharacterSheetsByUserId, createCharacterSheet } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * GET /api/character-sheets
 * ユーザーのキャラクターシート一覧を取得
 * クエリパラメータ: limit, offset（ページング用）
 */
export async function GET(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ページングパラメータを取得
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '0', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const characterSheets = await getCharacterSheetsByUserId(user.id, limit > 0 ? limit : undefined, offset > 0 ? offset : undefined);

    // total を取得するために、limit/offset なしで全件数を取得
    const allSheets = await getCharacterSheetsByUserId(user.id);
    const total = allSheets.length;

    // Convert storage paths to API proxy URLs
    const sheetsWithApiUrls = characterSheets.map((sheet: { id: number; user_id: string; name: string; image_url?: string; description?: string; elevenlabs_voice_id?: string; metadata?: unknown; created_at: string; updated_at: string }) => {
      if (sheet.image_url && !sheet.image_url.startsWith('http') && !sheet.image_url.startsWith('/api/')) {
        return { ...sheet, image_url: `/api/storage/${sheet.image_url}` };
      }
      return sheet;
    });

    return NextResponse.json({
      success: true,
      characterSheets: sheetsWithApiUrls,
      total,
    });
  } catch (error: any) {
    console.error('Failed to get character sheets:', error);
    return NextResponse.json(
      { error: 'Failed to get character sheets', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/character-sheets
 * キャラクターシートを作成
 */
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, image_url, description, elevenlabs_voice_id, metadata } = body;

    if (!name || !image_url) {
      return NextResponse.json(
        { error: 'Name and image_url are required' },
        { status: 400 }
      );
    }

    const characterSheet = await createCharacterSheet({
      user_id: user.id,
      name,
      image_url,
      description,
      elevenlabs_voice_id,
      metadata,
    });

    return NextResponse.json({
      success: true,
      characterSheet,
    });
  } catch (error: any) {
    console.error('Failed to create character sheet:', error);
    return NextResponse.json(
      { error: 'Failed to create character sheet', details: error.message },
      { status: 500 }
    );
  }
}
