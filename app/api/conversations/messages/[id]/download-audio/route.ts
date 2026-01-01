import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { getFileFromStorage } from '@/lib/gcp-storage';

/**
 * GET /api/conversations/messages/:id/download-audio
 * Download audio file directly (bypasses CORS issues)
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
        speaker_name,
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

    if (!message.audio_storage_path) {
      return NextResponse.json(
        { success: false, error: 'No audio available for this message' },
        { status: 404 }
      );
    }

    // Download file from GCP Storage
    const { data: buffer } = await getFileFromStorage(message.audio_storage_path);

    // Create filename
    const speakerName = message.speaker_name || 'audio';
    const filename = `${speakerName}_${messageId}.mp3`;

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(buffer);

    // Return as downloadable file
    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('[download-audio] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
