import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { uploadImageToStorage, getSignedUrl } from '@/lib/gcp-storage';

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George
const DEFAULT_MODEL_ID = 'eleven_v3';

// MP3 bitrate lookup table (kbps)
const BITRATE_TABLE: Record<number, number[]> = {
  // MPEG1 Layer III bitrates
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  // MPEG2/2.5 Layer III bitrates
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
};

// Sample rate lookup table
const SAMPLE_RATE_TABLE: Record<number, number[]> = {
  0: [44100, 48000, 32000, 0], // MPEG1
  1: [22050, 24000, 16000, 0], // MPEG2
  2: [11025, 12000, 8000, 0],  // MPEG2.5
};

/**
 * Calculate MP3 duration by parsing frame headers
 * Returns duration in seconds
 */
function calculateMp3Duration(buffer: Buffer): number {
  let offset = 0;
  let totalFrames = 0;
  let totalDuration = 0;

  // Skip ID3v2 tag if present
  if (buffer.length >= 10 &&
      buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const size = ((buffer[6] & 0x7f) << 21) |
                 ((buffer[7] & 0x7f) << 14) |
                 ((buffer[8] & 0x7f) << 7) |
                 (buffer[9] & 0x7f);
    offset = 10 + size;
  }

  // Parse frames
  while (offset < buffer.length - 4) {
    // Look for frame sync (11 bits set to 1)
    if (buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0) {
      const header = buffer.readUInt32BE(offset);

      // Extract header fields
      const mpegVersion = (header >> 19) & 0x03; // 00=2.5, 01=reserved, 10=2, 11=1
      const layer = (header >> 17) & 0x03;       // 01=Layer III
      const bitrateIndex = (header >> 12) & 0x0f;
      const sampleRateIndex = (header >> 10) & 0x03;
      const padding = (header >> 9) & 0x01;

      // Only process Layer III frames
      if (layer !== 1 || sampleRateIndex === 3 || bitrateIndex === 0 || bitrateIndex === 15) {
        offset++;
        continue;
      }

      // Get version-specific values
      const versionIndex = mpegVersion === 3 ? 0 : (mpegVersion === 2 ? 1 : 2);
      const bitrateRow = mpegVersion === 3 ? 1 : 2;

      const bitrate = BITRATE_TABLE[bitrateRow][bitrateIndex] * 1000;
      const sampleRate = SAMPLE_RATE_TABLE[versionIndex][sampleRateIndex];

      if (bitrate === 0 || sampleRate === 0) {
        offset++;
        continue;
      }

      // Calculate frame size
      const samplesPerFrame = mpegVersion === 3 ? 1152 : 576;
      const frameSize = Math.floor((samplesPerFrame * bitrate) / (8 * sampleRate)) + padding;

      // Accumulate duration
      totalDuration += samplesPerFrame / sampleRate;
      totalFrames++;

      // Move to next frame
      offset += frameSize;
    } else {
      offset++;
    }

    // Limit iterations for safety
    if (totalFrames > 100000) break;
  }

  if (totalFrames === 0) {
    throw new Error('No valid MP3 frames found');
  }

  return totalDuration;
}

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

    // Calculate audio duration from MP3 file
    // ElevenLabs typically returns 128kbps MP3
    // Duration = file size in bits / bitrate
    // For more accurate duration, we parse the MP3 header
    let audioDurationSeconds: number | null = null;
    try {
      audioDurationSeconds = calculateMp3Duration(Buffer.from(audioBuffer));
    } catch (durationError) {
      console.warn('[generate-audio] Could not calculate duration, using estimate:', durationError);
      // Fallback: estimate based on 128kbps bitrate
      // duration = (fileSize * 8) / (128 * 1000)
      audioDurationSeconds = (fileSizeBytes * 8) / (128 * 1000);
    }

    console.log('[generate-audio] Audio generated, size:', fileSizeBytes, 'bytes, duration:', audioDurationSeconds?.toFixed(2), 'seconds');

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
        audio_duration_seconds: audioDurationSeconds,
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
