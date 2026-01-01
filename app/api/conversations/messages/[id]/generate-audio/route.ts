import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { uploadImageToStorage, getSignedUrl } from '@/lib/gcp-storage';

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George
const DEFAULT_MODEL_ID = 'eleven_v3';

/**
 * POST /api/conversations/messages/:id/generate-audio
 * Generate audio from message text using ElevenLabs and save to GCP Storage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Fetch message with character info and verify ownership
    const { data: messageData, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        character:character_sheets(id, name, elevenlabs_voice_id),
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
      .eq('id', messageId)
      .single();

    const message = messageData as any;

    if (msgError || !message) {
      console.error('Message not found:', msgError);
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check ownership through either studio or story path
    let isOwner = false;
    if (message.conversation?.studio_id && message.conversation?.studio) {
      isOwner = message.conversation.studio.user_id === user.id;
    } else if (message.conversation?.story_scene_id && message.conversation?.story_scene) {
      isOwner = message.conversation.story_scene.story.user_id === user.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Message does not belong to user' },
        { status: 403 }
      );
    }

    // Get voice ID from character or use default
    const voiceId = message.character?.elevenlabs_voice_id || DEFAULT_VOICE_ID;
    const modelId = DEFAULT_MODEL_ID;

    // Get text to generate (remove emotion tags like [friendly] for cleaner audio)
    const text = message.message_text.replace(/^\[[\w-]+\]\s*/, '');

    if (!text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message text is empty' },
        { status: 400 }
      );
    }

    console.log('[generate-audio] Generating audio for message:', messageId, {
      voiceId,
      modelId,
      textLength: text.length,
    });

    // Call ElevenLabs API
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { success: false, error: 'ELEVENLABS_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('[generate-audio] ElevenLabs API error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate audio', details: errorText },
        { status: elevenLabsResponse.status }
      );
    }

    // Get audio data
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    const fileSizeBytes = audioBuffer.byteLength;

    console.log('[generate-audio] Audio generated, size:', fileSizeBytes, 'bytes');

    // Upload to GCP Storage
    const fileName = `message-${messageId}-${Date.now()}.mp3`;
    const storagePath = await uploadImageToStorage(
      audioBase64,
      'audio/mpeg',
      fileName,
      'conversation-audio'
    );

    console.log('[generate-audio] Uploaded to GCP Storage:', storagePath);

    // Update message with audio info
    const { data: updatedMessage, error: updateError } = await supabase
      .from('conversation_messages')
      .update({
        audio_storage_path: storagePath,
        audio_voice_id: voiceId,
        audio_model_id: modelId,
        audio_file_size_bytes: fileSizeBytes,
        audio_created_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `)
      .single();

    if (updateError) {
      console.error('[generate-audio] Failed to update message:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to save audio info' },
        { status: 500 }
      );
    }

    // Generate signed URL for playback
    const audioUrl = await getSignedUrl(storagePath, 120); // 2 hours

    console.log('[generate-audio] Success for message:', messageId);

    return NextResponse.json({
      success: true,
      data: {
        message: updatedMessage,
        audioUrl,
      },
    });

  } catch (error: any) {
    console.error('[generate-audio] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/conversations/messages/:id/generate-audio
 * Get signed URL for existing audio
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Fetch message and verify ownership
    const { data: messageData, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        audio_storage_path,
        audio_voice_id,
        audio_model_id,
        audio_duration_seconds,
        audio_file_size_bytes,
        audio_created_at,
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
      .eq('id', messageId)
      .single();

    const message = messageData as any;

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check ownership
    let isOwner = false;
    if (message.conversation?.studio_id && message.conversation?.studio) {
      isOwner = message.conversation.studio.user_id === user.id;
    } else if (message.conversation?.story_scene_id && message.conversation?.story_scene) {
      isOwner = message.conversation.story_scene.story.user_id === user.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (!message.audio_storage_path) {
      return NextResponse.json(
        { success: false, error: 'No audio available for this message' },
        { status: 404 }
      );
    }

    // Generate signed URL
    const audioUrl = await getSignedUrl(message.audio_storage_path, 120); // 2 hours

    return NextResponse.json({
      success: true,
      data: {
        audioUrl,
        voiceId: message.audio_voice_id,
        modelId: message.audio_model_id,
        durationSeconds: message.audio_duration_seconds,
        fileSizeBytes: message.audio_file_size_bytes,
        createdAt: message.audio_created_at,
      },
    });

  } catch (error: any) {
    console.error('[get-audio] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/messages/:id/generate-audio
 * Delete audio from message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messageId = parseInt(id, 10);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Fetch message and verify ownership
    const { data: messageData, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        audio_storage_path,
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
      .eq('id', messageId)
      .single();

    const message = messageData as any;

    if (msgError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check ownership
    let isOwner = false;
    if (message.conversation?.studio_id && message.conversation?.studio) {
      isOwner = message.conversation.studio.user_id === user.id;
    } else if (message.conversation?.story_scene_id && message.conversation?.story_scene) {
      isOwner = message.conversation.story_scene.story.user_id === user.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete from GCP Storage if exists
    if (message.audio_storage_path) {
      try {
        const { deleteImageFromStorage } = await import('@/lib/gcp-storage');
        await deleteImageFromStorage(message.audio_storage_path);
        console.log('[delete-audio] Deleted from GCP Storage:', message.audio_storage_path);
      } catch (storageError) {
        console.error('[delete-audio] Failed to delete from storage:', storageError);
        // Continue even if storage deletion fails
      }
    }

    // Clear audio fields in message
    const { error: updateError } = await supabase
      .from('conversation_messages')
      .update({
        audio_storage_path: null,
        audio_voice_id: null,
        audio_model_id: null,
        audio_duration_seconds: null,
        audio_file_size_bytes: null,
        audio_created_at: null,
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('[delete-audio] Failed to update message:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to clear audio info' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: messageId },
    });

  } catch (error: any) {
    console.error('[delete-audio] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
