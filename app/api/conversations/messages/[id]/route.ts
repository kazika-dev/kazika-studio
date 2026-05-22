import { NextRequest, NextResponse } from 'next/server';
import { createKazikaClient } from '@/lib/kazika-db-client';
import { syncConversationMessageSceneArtifacts } from '@/lib/agent-scene-artifact-sync';
import type { UpdateMessageRequest, UpdateMessageResponse } from '@/types/conversation';
/**
 * PATCH /api/conversations/messages/:id
 * Update a specific message
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await createKazikaClient();

    // Authentication check
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: UpdateMessageRequest = await request.json();

    // Fetch message and verify ownership
    const { data: message, error: msgError } = await db
      .from('conversation_messages')
      .select(`
        *,
        conversation:conversations(
          id,
          studio_id,
          story_scene_id,
          studio:studios(user_id),
          story_scene:story_scenes(
            id,
            story:stories(user_id)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check ownership through either studio or story path
    let isOwner = false;
    if (message.conversation.studio_id && message.conversation.studio) {
      isOwner = message.conversation.studio.user_id === user.id;
    } else if (message.conversation.story_scene_id && message.conversation.story_scene) {
      isOwner = message.conversation.story_scene.story.user_id === user.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Message does not belong to user' },
        { status: 403 }
      );
    }

    // Update message
    const updates: Record<string, unknown> = {};
    if (body.messageText !== undefined) {
      updates.message_text = body.messageText;
    }
    if (body.characterId !== undefined) {
      updates.character_id = body.characterId;
      // Update speaker_name based on character
      const { data: character } = await db
        .from('character_sheets')
        .select('name')
        .eq('id', body.characterId)
        .single();
      if (character) {
        updates.speaker_name = character.name;
      }
    }
    if (body.scenePromptJa !== undefined) {
      updates.scene_prompt_ja = body.scenePromptJa;
    }
    if (body.scenePromptEn !== undefined) {
      updates.scene_prompt_en = body.scenePromptEn;
    }
    if (body.metadata !== undefined) {
      updates.metadata = body.metadata;
    }

    const { data: updated, error: updateError } = await db
      .from('conversation_messages')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `)
      .single();

    if (updateError || !updated) {
      console.error('Failed to update message:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update message' },
        { status: 500 }
      );
    }

    // Update conversation's updated_at timestamp
    await db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.conversation.id);

    let artifactSync = null;
    let artifactSyncWarning = null;
    try {
      artifactSync = await syncConversationMessageSceneArtifacts(updated.id);
    } catch (syncError) {
      console.error('[Update Message] Failed to sync script/subtitle artifacts:', syncError);
      artifactSyncWarning = syncError instanceof Error ? syncError.message : 'Failed to sync script/subtitle artifacts';
    }

    return NextResponse.json({
      success: true,
      data: { message: updated, artifactSync, artifactSyncWarning }
    } as UpdateMessageResponse);

  } catch (error: unknown) {
    console.error('Update message error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/messages/:id
 * Delete a specific message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await createKazikaClient();

    // Authentication check
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch message and verify ownership
    const { data: message, error: msgError } = await db
      .from('conversation_messages')
      .select(`
        *,
        conversation:conversations(
          id,
          studio_id,
          story_scene_id,
          studio:studios(user_id),
          story_scene:story_scenes(
            id,
            story:stories(user_id)
          )
        )
      `)
      .eq('id', id)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check ownership through either studio or story path
    let isOwner = false;
    if (message.conversation.studio_id && message.conversation.studio) {
      isOwner = message.conversation.studio.user_id === user.id;
    } else if (message.conversation.story_scene_id && message.conversation.story_scene) {
      isOwner = message.conversation.story_scene.story.user_id === user.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Message does not belong to user' },
        { status: 403 }
      );
    }

    // Delete message
    const { error: deleteError } = await db
      .from('conversation_messages')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete message:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to delete message' },
        { status: 500 }
      );
    }

    // Update conversation's updated_at timestamp
    await db
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.conversation.id);

    return NextResponse.json({
      success: true,
      data: { id }
    });

  } catch (error: unknown) {
    console.error('Delete message error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
