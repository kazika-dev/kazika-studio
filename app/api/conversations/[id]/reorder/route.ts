import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ReorderMessagesRequest {
  messages: Array<{
    id: number;
    sequence_order: number;
  }>;
}

/**
 * POST /api/conversations/:id/reorder
 * Reorder messages in a conversation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id, 10);
    const supabase = await createClient();

    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ReorderMessagesRequest = await request.json();

    // Verify conversation ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        user_id,
        studio:studio_id(user_id)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check ownership via user_id or studio
    const studio = Array.isArray(conversation.studio) ? conversation.studio[0] : conversation.studio;
    const isOwner = conversation.user_id === user.id ||
                    (studio && studio.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // Update message orders in two steps to avoid unique constraint violation
    // Step 1: Set all to temporary values (10000 + index)
    const tempUpdatePromises = body.messages.map((msg, index) =>
      supabase
        .from('conversation_messages')
        .update({ sequence_order: 10000 + index })
        .eq('id', msg.id)
        .eq('conversation_id', conversationId)
    );

    const tempResults = await Promise.all(tempUpdatePromises);
    const tempErrors = tempResults.filter(r => r.error);
    if (tempErrors.length > 0) {
      console.error('Failed to set temporary order:', tempErrors);
      return NextResponse.json(
        { success: false, error: 'Failed to reorder messages' },
        { status: 500 }
      );
    }

    // Step 2: Set to actual values
    const finalUpdatePromises = body.messages.map(msg =>
      supabase
        .from('conversation_messages')
        .update({ sequence_order: msg.sequence_order })
        .eq('id', msg.id)
        .eq('conversation_id', conversationId)
    );

    const finalResults = await Promise.all(finalUpdatePromises);
    const finalErrors = finalResults.filter(r => r.error);
    if (finalErrors.length > 0) {
      console.error('Failed to set final order:', finalErrors);
      return NextResponse.json(
        { success: false, error: 'Failed to reorder messages' },
        { status: 500 }
      );
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({
      success: true,
      data: { conversationId }
    });

  } catch (error: any) {
    console.error('Reorder messages error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
