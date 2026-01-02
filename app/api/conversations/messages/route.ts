import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import type { CreateMessageRequest, CreateMessageResponse } from '@/types/conversation';

/**
 * POST /api/conversations/messages
 * Create a new message in a conversation
 */
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const body: CreateMessageRequest = await request.json();

    // Validation
    if (!body.conversationId || !body.characterId || !body.messageText?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: conversationId, characterId, messageText' },
        { status: 400 }
      );
    }

    // Verify conversation ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        studio_id,
        story_scene_id,
        studios:studio_id(id, user_id),
        story_scenes:story_scene_id(
          id,
          story:stories(id, user_id)
        )
      `)
      .eq('id', body.conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check ownership via studio or story
    let isOwner = false;

    if (conversation.studios) {
      const studio = Array.isArray(conversation.studios) ? conversation.studios[0] : conversation.studios;
      if (studio && studio.user_id === user.id) {
        isOwner = true;
      }
    }

    if (!isOwner && conversation.story_scenes) {
      const scene = Array.isArray(conversation.story_scenes) ? conversation.story_scenes[0] : conversation.story_scenes;
      if (scene?.story) {
        const story = Array.isArray(scene.story) ? scene.story[0] : scene.story;
        if (story && story.user_id === user.id) {
          isOwner = true;
        }
      }
    }

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // Verify character exists
    const { data: character, error: charError } = await supabase
      .from('character_sheets')
      .select('id, name, image_url')
      .eq('id', body.characterId)
      .single();

    if (charError || !character) {
      return NextResponse.json(
        { success: false, error: 'Character not found' },
        { status: 404 }
      );
    }

    // Determine sequence_order
    let sequenceOrder = 0;

    if (body.insertAfterMessageId) {
      // Insert after a specific message
      const { data: afterMessage, error: afterError } = await supabase
        .from('conversation_messages')
        .select('sequence_order')
        .eq('id', body.insertAfterMessageId)
        .eq('conversation_id', body.conversationId)
        .single();

      if (afterError || !afterMessage) {
        return NextResponse.json(
          { success: false, error: 'Message to insert after not found' },
          { status: 404 }
        );
      }

      sequenceOrder = afterMessage.sequence_order + 1;

      // Increment sequence_order for all messages after this position
      // Fetch all affected messages
      console.log(`[Create Message] Fetching messages with sequence_order >= ${sequenceOrder} for conversation ${body.conversationId}`);
      const { data: affectedMessages, error: fetchError } = await supabase
        .from('conversation_messages')
        .select('id, sequence_order')
        .eq('conversation_id', body.conversationId)
        .gte('sequence_order', sequenceOrder);

      if (fetchError) {
        console.error('Failed to fetch affected messages:', fetchError);
        console.error('Fetch error details:', JSON.stringify(fetchError, null, 2));
        return NextResponse.json(
          { success: false, error: `Failed to adjust message positions: ${fetchError.message}` },
          { status: 500 }
        );
      }
      console.log(`[Create Message] Found ${affectedMessages?.length || 0} affected messages`);

      // Update each message individually
      if (affectedMessages && affectedMessages.length > 0) {
        const updatePromises = affectedMessages.map(msg =>
          supabase
            .from('conversation_messages')
            .update({ sequence_order: msg.sequence_order + 1 })
            .eq('id', msg.id)
        );

        const results = await Promise.all(updatePromises);
        const updateError = results.find(r => r.error)?.error;

        if (updateError) {
          console.error('Failed to update sequence orders:', updateError);
          return NextResponse.json(
            { success: false, error: 'Failed to adjust message positions' },
            { status: 500 }
          );
        }
      }
    } else {
      // Insert at the end
      const { data: maxOrderResult, error: maxOrderError } = await supabase
        .from('conversation_messages')
        .select('sequence_order')
        .eq('conversation_id', body.conversationId)
        .order('sequence_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxOrderError) {
        console.error('Failed to get max sequence_order:', maxOrderError);
        return NextResponse.json(
          { success: false, error: 'Failed to determine message position' },
          { status: 500 }
        );
      }

      sequenceOrder = (maxOrderResult?.sequence_order ?? -1) + 1;
    }

    // Add emotion tag to message text if present
    const emotionTagPrefix = body.emotionTag ? `[${body.emotionTag}] ` : '';
    const messageTextWithTag = emotionTagPrefix + body.messageText.trim();

    // Create the message
    const { data: newMessage, error: createError } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: body.conversationId,
        character_id: body.characterId,
        speaker_name: character.name,
        message_text: messageTextWithTag,
        sequence_order: sequenceOrder,
        metadata: {
          emotion: 'neutral',
          emotionTag: body.emotionTag || 'neutral',
          manuallyCreated: true // Flag to indicate this was manually created
        }
      })
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `)
      .single();

    if (createError || !newMessage) {
      console.error('Failed to create message:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create message' },
        { status: 500 }
      );
    }

    console.log(`Successfully created message ${newMessage.id} in conversation ${body.conversationId}`);

    return NextResponse.json({
      success: true,
      data: {
        message: newMessage
      }
    } as CreateMessageResponse);

  } catch (error: unknown) {
    console.error('Create message error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
