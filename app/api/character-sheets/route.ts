import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCharacterSheetsByUserId, createCharacterSheet } from '@/lib/db';

/**
 * GET /api/character-sheets
 * ユーザーのキャラクターシート一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const characterSheets = await getCharacterSheetsByUserId(user.id);

    return NextResponse.json({
      success: true,
      characterSheets,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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
