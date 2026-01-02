import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildConversationPrompt,
  parseAIResponse,
  validateMessageSpeakers,
} from '@/lib/conversation/prompt-builder';
import { addCharacterToMessage } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';

interface GenerateMessagesRequest {
  characterIds: number[];
  situation: string;
  messageCount: number;
  tone?: 'casual' | 'formal' | 'dramatic' | 'humorous';
  promptTemplateId?: number;
}

/**
 * POST /api/conversations/[id]/generate-messages
 * Generate messages for an existing conversation (even if it has no messages yet)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id, 10);

    if (isNaN(conversationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation ID' },
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
    const body: GenerateMessagesRequest = await request.json();

    // Validation
    if (!body.characterIds || body.characterIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 characters are required' },
        { status: 400 }
      );
    }

    if (!body.situation?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Situation is required' },
        { status: 400 }
      );
    }

    if (!body.messageCount || body.messageCount < 1 || body.messageCount > 20) {
      return NextResponse.json(
        { success: false, error: 'messageCount must be between 1 and 20' },
        { status: 400 }
      );
    }

    // Fetch conversation with ownership check
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        title,
        description,
        studio_id,
        story_scene_id,
        studios:studio_id(id, user_id),
        story_scenes:story_scene_id(
          id,
          story:stories(id, user_id)
        )
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
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

    // Fetch character details
    const { data: characters, error: charError } = await supabase
      .from('character_sheets')
      .select('id, name, description, personality, speaking_style, sample_dialogues')
      .in('id', body.characterIds);

    if (charError || !characters || characters.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch characters or not enough characters found' },
        { status: 400 }
      );
    }

    // Get existing messages count for sequence_order
    const { data: existingMessages } = await supabase
      .from('conversation_messages')
      .select('sequence_order')
      .eq('conversation_id', conversationId)
      .order('sequence_order', { ascending: false })
      .limit(1);

    const startSequenceOrder = existingMessages && existingMessages.length > 0
      ? existingMessages[0].sequence_order + 1
      : 0;

    // Build prompt
    const prompt = await buildConversationPrompt({
      characters: characters.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || 'キャラクターの説明なし',
        personality: c.personality || '一般的な性格',
        speakingStyle: c.speaking_style || '普通の話し方',
        sampleDialogues: c.sample_dialogues || []
      })),
      situation: body.situation,
      messageCount: body.messageCount,
      tone: body.tone
    }, body.promptTemplateId);

    // Generate with Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    console.log('[Generate Messages] Generating messages for conversation:', conversationId);
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // Parse AI response
    let parsed;
    try {
      parsed = await parseAIResponse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Validate speaker names
    const validCharacterNames = characters.map(c => c.name);
    const validation = validateMessageSpeakers(parsed.messages, validCharacterNames);

    if (!validation.valid) {
      console.warn('AI generated messages with invalid speakers:', validation.invalidSpeakers);
    }

    // Insert new messages
    const messagesToInsert = parsed.messages.map((msg, idx) => {
      let character = null;

      if (msg.speakerId !== undefined && msg.speakerId !== null) {
        character = characters.find(c => c.id === msg.speakerId);
      }
      if (!character && msg.speaker) {
        character = characters.find(c => c.name === msg.speaker);
        if (!character) {
          character = characters.find(c =>
            c.name.includes(msg.speaker!) || msg.speaker!.includes(c.name)
          );
        }
      }

      const speakerName = msg.speaker || character?.name || 'Unknown';
      const emotionTagPrefix = msg.emotionTag ? `[${msg.emotionTag}] ` : '';
      const messageTextWithTag = emotionTagPrefix + msg.message;

      return {
        conversation_id: conversationId,
        character_id: character?.id || null,
        speaker_name: speakerName,
        message_text: messageTextWithTag,
        sequence_order: startSequenceOrder + idx,
        scene_prompt_ja: msg.scenePromptJa || null,
        scene_prompt_en: msg.scenePromptEn || null,
        metadata: {
          emotion: msg.emotion || 'neutral',
          emotionTag: msg.emotionTag || 'neutral'
        }
      };
    });

    const { data: newMessages, error: insertError } = await supabase
      .from('conversation_messages')
      .insert(messagesToInsert)
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `);

    if (insertError || !newMessages) {
      console.error('Failed to insert messages:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save new messages' },
        { status: 500 }
      );
    }

    // Register scene characters to each new message
    for (let idx = 0; idx < newMessages.length; idx++) {
      const msg = parsed.messages[idx];
      const insertedMsg = newMessages[idx];

      if (msg.sceneCharacterIds && msg.sceneCharacterIds.length > 0) {
        for (let i = 0; i < Math.min(msg.sceneCharacterIds.length, 4); i++) {
          const characterId = msg.sceneCharacterIds[i];
          try {
            await addCharacterToMessage(insertedMsg.id, characterId, { displayOrder: i + 1 });
          } catch (error) {
            console.error(`Failed to register character ${characterId} to message ${insertedMsg.id}:`, error);
          }
        }
      }
    }

    // Update conversation description if it was empty
    if (!conversation.description && body.situation) {
      await supabase
        .from('conversations')
        .update({ description: body.situation })
        .eq('id', conversationId);
    }

    console.log(`[Generate Messages] Successfully added ${newMessages.length} messages to conversation ${conversationId}`);

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        newMessages
      }
    });

  } catch (error: unknown) {
    console.error('Generate messages error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
