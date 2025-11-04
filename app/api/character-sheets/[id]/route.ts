import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getCharacterSheetById,
  updateCharacterSheet,
  deleteCharacterSheet,
} from '@/lib/db';

/**
 * GET /api/character-sheets/[id]
 * キャラクターシートを取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const characterSheetId = parseInt(id);

    if (isNaN(characterSheetId)) {
      return NextResponse.json(
        { error: 'Invalid character sheet ID' },
        { status: 400 }
      );
    }

    const characterSheet = await getCharacterSheetById(characterSheetId);

    if (!characterSheet) {
      return NextResponse.json(
        { error: 'Character sheet not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (characterSheet.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      characterSheet,
    });
  } catch (error: any) {
    console.error('Failed to get character sheet:', error);
    return NextResponse.json(
      { error: 'Failed to get character sheet', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/character-sheets/[id]
 * キャラクターシートを更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const characterSheetId = parseInt(id);

    if (isNaN(characterSheetId)) {
      return NextResponse.json(
        { error: 'Invalid character sheet ID' },
        { status: 400 }
      );
    }

    const characterSheet = await getCharacterSheetById(characterSheetId);

    if (!characterSheet) {
      return NextResponse.json(
        { error: 'Character sheet not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (characterSheet.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, image_url, description, metadata } = body;

    const updatedCharacterSheet = await updateCharacterSheet(characterSheetId, {
      name,
      image_url,
      description,
      metadata,
    });

    return NextResponse.json({
      success: true,
      characterSheet: updatedCharacterSheet,
    });
  } catch (error: any) {
    console.error('Failed to update character sheet:', error);
    return NextResponse.json(
      { error: 'Failed to update character sheet', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/character-sheets/[id]
 * キャラクターシートを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const characterSheetId = parseInt(id);

    if (isNaN(characterSheetId)) {
      return NextResponse.json(
        { error: 'Invalid character sheet ID' },
        { status: 400 }
      );
    }

    const characterSheet = await getCharacterSheetById(characterSheetId);

    if (!characterSheet) {
      return NextResponse.json(
        { error: 'Character sheet not found' },
        { status: 404 }
      );
    }

    // 所有者確認
    if (characterSheet.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const deleted = await deleteCharacterSheet(characterSheetId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete character sheet' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Character sheet deleted successfully',
    });
  } catch (error: any) {
    console.error('Failed to delete character sheet:', error);
    return NextResponse.json(
      { error: 'Failed to delete character sheet', details: error.message },
      { status: 500 }
    );
  }
}
