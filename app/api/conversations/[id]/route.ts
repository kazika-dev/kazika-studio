import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import type { GetConversationResponse } from '@/types/conversation';

/**
 * GET /api/conversations/:id
 * Get a specific conversation with all its messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[GET /api/conversations/:id] Fetching conversation ID:', id);

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      console.log('[GET /api/conversations/:id] Auth error: No user');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[GET /api/conversations/:id] User authenticated:', user.id);

    // Supabaseクライアントを取得（RLSを適用するため）
    const supabase = await createClient();

    // Fetch conversation with studio information
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        studio:studios(id, name, user_id)
      `)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      console.log('[GET /api/conversations/:id] Conversation not found. Error:', convError);
      console.log('[GET /api/conversations/:id] Conversation data:', conversation);
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }
    console.log('[GET /api/conversations/:id] Conversation found:', conversation.id);

    // Verify ownership - check user_id first, then studio
    const isOwner = conversation.user_id === user.id ||
                    (conversation.studio && conversation.studio.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `)
      .eq('conversation_id', id)
      .order('sequence_order', { ascending: true });

    if (msgError) {
      console.error('Failed to fetch messages:', msgError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Convert storage paths to API proxy URLs for character images
    const messagesWithApiUrls = (messages || []).map((msg: { character?: { id: number; name: string; image_url?: string } }) => {
      if (msg.character?.image_url) {
        let imageUrl = msg.character.image_url;
        // Strip any existing api/storage prefix (with or without leading /)
        if (imageUrl.startsWith('/api/storage/')) {
          imageUrl = imageUrl.replace('/api/storage/', '');
        } else if (imageUrl.startsWith('api/storage/')) {
          imageUrl = imageUrl.replace('api/storage/', '');
        }
        // Only add prefix if it's not already an HTTP URL
        if (!imageUrl.startsWith('http')) {
          return { ...msg, character: { ...msg.character, image_url: `/api/storage/${imageUrl}` } };
        }
        return { ...msg, character: { ...msg.character, image_url: imageUrl } };
      }
      return msg;
    });

    return NextResponse.json({
      success: true,
      data: {
        conversation: {
          id: conversation.id,
          studio_id: conversation.studio_id,
          story_scene_id: conversation.story_scene_id,
          title: conversation.title,
          description: conversation.description,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
          metadata: conversation.metadata,
          ...(conversation.studio && {
            studio: {
              id: conversation.studio.id,
              name: conversation.studio.name
            }
          })
        },
        messages: messagesWithApiUrls
      }
    } as GetConversationResponse);

  } catch (error: any) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id
 * Delete a conversation and all its messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Verify ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        studio:studios(user_id)
      `)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check ownership via user_id or studio
    const isOwner = conversation.user_id === user.id ||
                    (conversation.studio && conversation.studio.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // Delete conversation (cascade will delete messages and logs)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete conversation:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id }
    });

  } catch (error: any) {
    console.error('Delete conversation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/:id
 * Update conversation metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const body = await request.json();
    const { title, description, metadata, draftParams } = body;

    // Verify ownership
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        studio:studios(user_id)
      `)
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check ownership via user_id or studio
    const isOwner = conversation.user_id === user.id ||
                    (conversation.studio && conversation.studio.user_id === user.id);

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // Update conversation
    console.log('[PATCH /api/conversations] Conversation data:', {
      id: conversation.id,
      story_scene_id: conversation.story_scene_id,
      user_id: conversation.user_id
    });

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (metadata !== undefined) updates.metadata = metadata;
    // Handle draftParams update - merge into existing metadata
    if (draftParams !== undefined) {
      updates.metadata = {
        ...(conversation.metadata || {}),
        draft_params: draftParams
      };

      // Also update story_scenes.location if conversation has story_scene_id
      if (conversation.story_scene_id && draftParams.location !== undefined) {
        console.log('[PATCH /api/conversations] Updating story_scenes.location:', {
          story_scene_id: conversation.story_scene_id,
          location: draftParams.location
        });
        const { error: sceneUpdateError } = await supabase
          .from('story_scenes')
          .update({ location: draftParams.location })
          .eq('id', conversation.story_scene_id);

        if (sceneUpdateError) {
          console.error('Failed to update story_scenes.location:', sceneUpdateError);
          // Continue anyway - this is not critical
        } else {
          console.log('[PATCH /api/conversations] Successfully updated story_scenes.location');
        }
      }
    }

    const { data: updated, error: updateError} = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('Failed to update conversation:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { conversation: updated }
    });

  } catch (error: any) {
    console.error('Update conversation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
