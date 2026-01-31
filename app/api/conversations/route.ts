import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import type { ListConversationsResponse, CreateConversationRequest, CreateConversationResponse, ConversationDraftParams } from '@/types/conversation';

/**
 * GET /api/conversations
 * Get all conversations for a studio
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

    // Supabaseクライアントを取得（RLSを適用するため）
    const supabase = await createClient();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('studioId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query based on whether studioId is provided
    let query = supabase
      .from('conversations')
      .select('*, studios(id, name, user_id), story_scenes:story_scene_id(id, title, stories:story_id(id, title))')
      .order('created_at', { ascending: false });

    if (studioId) {
      // If studioId is provided, verify studio ownership
      const { data: studio, error: studioError } = await supabase
        .from('studios')
        .select('id, user_id')
        .eq('id', studioId)
        .single();

      if (studioError || !studio) {
        return NextResponse.json(
          { success: false, error: 'Studio not found' },
          { status: 404 }
        );
      }

      if (studio.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Studio does not belong to user' },
          { status: 403 }
        );
      }

      query = query.eq('studio_id', studioId);
    } else {
      // If no studioId, filter by user_id to get all conversations owned by the user
      // This includes both conversations with studio_id and without (studio_id = null)
      query = query.eq('user_id', user.id);
    }

    // Get total count
    const countQuery = studioId
      ? supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('studio_id', studioId)
      : supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('user_id', user.id);

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Failed to count conversations:', countError);
    }

    // Fetch conversations
    console.log('[GET /api/conversations] Fetching conversations', studioId ? `for studio: ${studioId}` : 'for all user studios');
    const { data: conversations, error: convError } = await query.range(offset, offset + limit - 1);

    if (convError) {
      console.error('[GET /api/conversations] Failed to fetch conversations:', convError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    console.log('[GET /api/conversations] Found conversations:', conversations?.length || 0);

    // Get message counts and scene counts for each conversation
    const conversationIds = conversations?.map(c => c.id) || [];
    let messageCounts: Record<string, number> = {};
    let sceneCounts: Record<string, number> = {};

    if (conversationIds.length > 0) {
      // Get message counts
      const { data: messageCountData, error: msgCountError } = await supabase
        .from('conversation_messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds);

      if (!msgCountError && messageCountData) {
        messageCounts = messageCountData.reduce((acc, msg) => {
          acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      // Get scene counts
      const { data: sceneCountData, error: sceneCountError } = await supabase
        .from('conversation_scenes')
        .select('conversation_id')
        .in('conversation_id', conversationIds);

      if (!sceneCountError && sceneCountData) {
        sceneCounts = sceneCountData.reduce((acc, scene) => {
          acc[scene.conversation_id] = (acc[scene.conversation_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Add message counts and scene counts to conversations
    const conversationsWithCounts = (conversations || []).map(conv => ({
      ...conv,
      message_count: messageCounts[conv.id] || 0,
      scene_count: sceneCounts[conv.id] || 0,
      story_scene: conv.story_scenes ? {
        id: conv.story_scenes.id,
        title: conv.story_scenes.title,
        story: conv.story_scenes.stories ? {
          id: conv.story_scenes.stories.id,
          title: conv.story_scenes.stories.title
        } : null
      } : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        conversations: conversationsWithCounts,
        total: count || 0
      }
    } as ListConversationsResponse);

  } catch (error: any) {
    console.error('List conversations error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new empty conversation
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, storySceneId, draftParams } = body as CreateConversationRequest & { draftParams?: ConversationDraftParams };

    if (!title?.trim()) {
      return NextResponse.json(
        { success: false, error: 'タイトルは必須です' },
        { status: 400 }
      );
    }

    if (!storySceneId) {
      return NextResponse.json(
        { success: false, error: 'シーンIDは必須です' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify scene ownership
    const { data: scene, error: sceneError } = await supabase
      .from('story_scenes')
      .select('id, story_id, stories!inner(user_id)')
      .eq('id', storySceneId)
      .single();

    if (sceneError || !scene) {
      return NextResponse.json(
        { success: false, error: 'シーンが見つかりません' },
        { status: 404 }
      );
    }

    if ((scene.stories as any).user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'このシーンにアクセスする権限がありません' },
        { status: 403 }
      );
    }

    // Create conversation with optional draft params
    const metadata: Record<string, any> = {};
    if (draftParams) {
      metadata.draft_params = draftParams;
    }

    const { data: conversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        story_scene_id: storySceneId,
        user_id: user.id,
        metadata,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create conversation:', insertError);
      return NextResponse.json(
        { success: false, error: '会話の作成に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        conversation
      }
    } as CreateConversationResponse);

  } catch (error: any) {
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
