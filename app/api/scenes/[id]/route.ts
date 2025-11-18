import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSceneById, updateStoryScene, deleteStoryScene, getStoryById } from '@/lib/db';

/**
 * GET /api/scenes/[id]
 * シーン詳細を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sceneId = parseInt(params.id);
    const scene = await getSceneById(sceneId);

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 親ストーリーの所有者チェック
    const story = await getStoryById(scene.story_id);
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { scene },
    });
  } catch (error) {
    console.error('Failed to fetch scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scene' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scenes/[id]
 * シーンを更新
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sceneId = parseInt(params.id);
    const scene = await getSceneById(sceneId);

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 親ストーリーの所有者チェック
    const story = await getStoryById(scene.story_id);
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updatedScene = await updateStoryScene(sceneId, body);

    return NextResponse.json({
      success: true,
      data: { scene: updatedScene },
    });
  } catch (error) {
    console.error('Failed to update scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update scene' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scenes/[id]
 * シーンを削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sceneId = parseInt(params.id);
    const scene = await getSceneById(sceneId);

    if (!scene) {
      return NextResponse.json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 親ストーリーの所有者チェック
    const story = await getStoryById(scene.story_id);
    if (!story || story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await deleteStoryScene(sceneId);

    return NextResponse.json({
      success: true,
      data: { scene },
    });
  } catch (error) {
    console.error('Failed to delete scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete scene' },
      { status: 500 }
    );
  }
}
