import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getStoriesByUserId,
  createStory,
  getScenesByStoryId,
  getConversationsBySceneId,
} from '@/lib/db';
import type {
  CreateStoryRequest,
  CreateStoryResponse,
  ListStoriesResponse,
} from '@/types/conversation';

/**
 * GET /api/stories
 * ユーザーのストーリー一覧を取得
 */
export async function GET(request: NextRequest) {
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

    const stories = await getStoriesByUserId(user.id);

    // 各ストーリーのシーン数と会話数を集計
    const storiesWithCounts = await Promise.all(
      stories.map(async (story) => {
        const scenes = await getScenesByStoryId(story.id);

        // 全シーンの会話数を集計
        let totalConversationCount = 0;
        for (const scene of scenes) {
          const conversations = await getConversationsBySceneId(scene.id);
          totalConversationCount += conversations.length;
        }

        return {
          ...story,
          sceneCount: scenes.length,
          conversationCount: totalConversationCount,
        };
      })
    );

    const response: ListStoriesResponse = {
      success: true,
      data: {
        stories: storiesWithCounts,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch stories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stories
 * 新しいストーリーを作成
 */
export async function POST(request: NextRequest) {
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

    const body: CreateStoryRequest = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const story = await createStory({
      user_id: user.id,
      title: body.title,
      description: body.description,
      thumbnail_url: body.thumbnail_url,
    });

    const response: CreateStoryResponse = {
      success: true,
      data: {
        story,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Failed to create story:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create story' },
      { status: 500 }
    );
  }
}
