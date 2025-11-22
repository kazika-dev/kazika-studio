import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSceneCharacters,
  addCharacterToScene,
  removeCharacterFromScene,
  updateSceneMainCharacter
} from '@/lib/db';
import type {
  AddCharacterToSceneRequest,
  AddCharacterToSceneResponse,
  ListSceneCharactersResponse,
  UpdateSceneMainCharacterRequest
} from '@/types/conversation';

/**
 * GET /api/scenes/[id]/characters
 * シーンに登録されているキャラクター一覧を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = parseInt(params.id);
    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ListSceneCharactersResponse,
        { status: 401 }
      );
    }

    // シーンの所有権チェック
    const { data: scene } = await supabase
      .from('story_scenes')
      .select(`
        id,
        story:stories(user_id)
      `)
      .eq('id', sceneId)
      .single();

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' } as ListSceneCharactersResponse,
        { status: 404 }
      );
    }

    const story = Array.isArray(scene.story) ? scene.story[0] : scene.story;
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Scene does not belong to user' } as ListSceneCharactersResponse,
        { status: 403 }
      );
    }

    // キャラクター一覧を取得
    const characters = await getSceneCharacters(sceneId);

    return NextResponse.json({
      success: true,
      data: { characters }
    } as ListSceneCharactersResponse);

  } catch (error) {
    console.error('Get scene characters error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      } as ListSceneCharactersResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/scenes/[id]/characters
 * シーンにキャラクターを追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = parseInt(params.id);
    const body: AddCharacterToSceneRequest = await request.json();
    const { characterId, displayOrder, isMainCharacter } = body;

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: 'characterId is required' } as AddCharacterToSceneResponse,
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as AddCharacterToSceneResponse,
        { status: 401 }
      );
    }

    // シーンの所有権チェック
    const { data: scene } = await supabase
      .from('story_scenes')
      .select(`
        id,
        story:stories(user_id)
      `)
      .eq('id', sceneId)
      .single();

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' } as AddCharacterToSceneResponse,
        { status: 404 }
      );
    }

    const story = Array.isArray(scene.story) ? scene.story[0] : scene.story;
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Scene does not belong to user' } as AddCharacterToSceneResponse,
        { status: 403 }
      );
    }

    // キャラクターを追加
    const result = await addCharacterToScene(sceneId, characterId, {
      displayOrder,
      isMainCharacter
    });

    return NextResponse.json({
      success: true,
      data: { sceneCharacter: result }
    } as AddCharacterToSceneResponse);

  } catch (error) {
    console.error('Add character to scene error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      } as AddCharacterToSceneResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scenes/[id]/characters?characterId=X
 * シーンからキャラクターを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = parseInt(params.id);
    const url = new URL(request.url);
    const characterId = parseInt(url.searchParams.get('characterId') || '0');

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: 'characterId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // シーンの所有権チェック
    const { data: scene } = await supabase
      .from('story_scenes')
      .select(`
        id,
        story:stories(user_id)
      `)
      .eq('id', sceneId)
      .single();

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    const story = Array.isArray(scene.story) ? scene.story[0] : scene.story;
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Scene does not belong to user' },
        { status: 403 }
      );
    }

    // キャラクターを削除
    await removeCharacterFromScene(sceneId, characterId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Remove character from scene error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scenes/[id]/characters
 * キャラクターのメインフラグを更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sceneId = parseInt(params.id);
    const body: UpdateSceneMainCharacterRequest = await request.json();
    const { characterId, isMainCharacter } = body;

    if (!characterId) {
      return NextResponse.json(
        { success: false, error: 'characterId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 認証チェック
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // シーンの所有権チェック
    const { data: scene } = await supabase
      .from('story_scenes')
      .select(`
        id,
        story:stories(user_id)
      `)
      .eq('id', sceneId)
      .single();

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    const story = Array.isArray(scene.story) ? scene.story[0] : scene.story;
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Scene does not belong to user' },
        { status: 403 }
      );
    }

    // メインキャラクターフラグを更新
    const result = await updateSceneMainCharacter(sceneId, characterId, isMainCharacter);

    return NextResponse.json({
      success: true,
      data: { sceneCharacter: result }
    });

  } catch (error) {
    console.error('Update scene main character error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
