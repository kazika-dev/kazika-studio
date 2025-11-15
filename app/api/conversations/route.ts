import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ListConversationsResponse } from '@/types/conversation';

/**
 * GET /api/conversations
 * Get all conversations for a studio
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('studioId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query based on whether studioId is provided
    let query = supabase
      .from('conversations')
      .select('*, studios(id, name, user_id)')
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

    // Get message counts for each conversation
    const conversationIds = conversations?.map(c => c.id) || [];
    let messageCounts: Record<string, number> = {};

    if (conversationIds.length > 0) {
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
    }

    // Add message counts to conversations
    const conversationsWithCounts = (conversations || []).map(conv => ({
      ...conv,
      messageCount: messageCounts[conv.id] || 0
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
