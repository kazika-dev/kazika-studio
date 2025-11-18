import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getStoryById,
  getScenesByStoryId,
  createStoryScene,
  getConversationsBySceneId,
} from '@/lib/db';
import type {
  CreateStorySceneRequest,
  CreateStorySceneResponse,
  ListStoryScenesResponse,
} from '@/types/conversation';

/**
 * GET /api/stories/[id]/scenes
 * ストーリーのシーン一覧を取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const storyId = parseInt(id);
    const story = await getStoryById(storyId);

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }

    // 所有者チェック
    if (story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const scenes = await getScenesByStoryId(storyId);

    // 各シーンの会話数を集計
    const scenesWithCounts = await Promise.all(
      scenes.map(async (scene) => {
        const conversations = await getConversationsBySceneId(scene.id);
        return {
          ...scene,
          conversationCount: conversations.length,
        };
      })
    );

    const response: ListStoryScenesResponse = {
      success: true,
      data: {
        scenes: scenesWithCounts,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch scenes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch scenes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stories/[id]/scenes
 * 新しいシーンを作成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const storyId = parseInt(id);
    const story = await getStoryById(storyId);

    if (!story) {
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      );
    }

    // 所有者チェック
    if (story.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body: CreateStorySceneRequest = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const scene = await createStoryScene({
      story_id: storyId,
      title: body.title,
      description: body.description,
      sequence_order: body.sequence_order,
    });

    const response: CreateStorySceneResponse = {
      success: true,
      data: {
        scene,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to create scene:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create scene' },
      { status: 500 }
    );
  }
}
