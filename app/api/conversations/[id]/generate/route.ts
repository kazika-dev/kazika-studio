import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildConversationPrompt,
  parseAIResponse,
  validateMessageSpeakers,
  buildScenePrompt,
  parseScenePromptResponse
} from '@/lib/conversation/prompt-builder';
import { getAllCameraAngles, getAllShotDistances, addCharacterToMessage } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import type { ConversationDraftParams } from '@/types/conversation';
import { generateConversationContent } from '@/lib/vertex-ai/generate';
import { getModelProvider, DEFAULT_CONVERSATION_MODEL } from '@/lib/vertex-ai/constants';

/**
 * POST /api/conversations/[id]/generate
 * Generate conversation messages for an existing conversation with draft params
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const conversationId = parseInt(id, 10);
    if (isNaN(conversationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch conversation with ownership check
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        story_scenes:story_scene_id(
          id,
          stories:story_id(id, user_id)
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

    // Check ownership via story
    const storyScene = conversation.story_scenes;
    if (storyScene) {
      const story = Array.isArray(storyScene.stories) ? storyScene.stories[0] : storyScene.stories;
      if (!story || story.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Conversation does not belong to user' },
          { status: 403 }
        );
      }
    } else if (conversation.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    // Check if conversation already has messages
    const { count: messageCount } = await supabase
      .from('conversation_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    if (messageCount && messageCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Conversation already has messages. Cannot regenerate.' },
        { status: 400 }
      );
    }

    // Get draft params from metadata
    const draftParams = conversation.metadata?.draft_params as ConversationDraftParams | undefined;
    if (!draftParams) {
      return NextResponse.json(
        { success: false, error: 'No draft parameters found. Cannot generate.' },
        { status: 400 }
      );
    }

    const { characterIds, situation, messageCount: targetMessageCount, tone, promptTemplateId, model } = draftParams;

    // Fetch character information
    const { data: characters, error: charError } = await supabase
      .from('character_sheets')
      .select('id, name, description, personality, speaking_style, sample_dialogues')
      .in('id', characterIds);

    if (charError || !characters || characters.length !== characterIds.length) {
      return NextResponse.json(
        { success: false, error: 'Invalid character IDs or characters not found' },
        { status: 400 }
      );
    }

    // Get model and provider
    const selectedModel = model || DEFAULT_CONVERSATION_MODEL;
    const modelProvider = getModelProvider(selectedModel);

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
      situation,
      messageCount: targetMessageCount,
      tone
    }, promptTemplateId, modelProvider);

    console.log(`[Generate from draft] Generating conversation with ${selectedModel} (${modelProvider})...`);

    // Generate conversation
    const generateResult = await generateConversationContent({
      model: selectedModel,
      prompt,
      maxTokens: 8192,
    });

    const aiResponse = generateResult.text;

    // Parse AI response
    let parsed;
    try {
      parsed = await parseAIResponse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response',
          details: parseError instanceof Error ? parseError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Validate speaker names
    const validCharacterNames = characters.map(c => c.name);
    const validation = validateMessageSpeakers(parsed.messages, validCharacterNames);

    if (!validation.valid) {
      console.warn('AI generated messages with invalid speakers:', validation.invalidSpeakers);
    }

    // Save messages to database
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
        sequence_order: idx,
        scene_prompt_ja: msg.scenePromptJa || null,
        scene_prompt_en: msg.scenePromptEn || null,
        metadata: {
          emotion: msg.emotion || 'neutral',
          emotionTag: msg.emotionTag || 'neutral'
        }
      };
    });

    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .insert(messagesToInsert)
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `);

    if (msgError || !messages) {
      console.error('Failed to save messages:', msgError);
      return NextResponse.json(
        { success: false, error: 'Failed to save messages' },
        { status: 500 }
      );
    }

    // Register scene characters to each message
    for (let idx = 0; idx < messages.length; idx++) {
      const msg = parsed.messages[idx];
      const insertedMsg = messages[idx];

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

    // Update conversation metadata to mark as generated
    await supabase
      .from('conversations')
      .update({
        metadata: {
          ...conversation.metadata,
          generated_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    // Generate conversation scenes
    const scenesPerConversation = Math.max(1, Math.ceil(messages.length / 4));
    const scenesToInsert = [];
    const cameraAngles = await getAllCameraAngles();
    const shotDistances = await getAllShotDistances();

    for (let i = 0; i < scenesPerConversation; i++) {
      const startIdx = Math.floor(i * messages.length / scenesPerConversation);
      const endIdx = Math.floor((i + 1) * messages.length / scenesPerConversation);
      const sceneMessages = messages.slice(startIdx, endIdx);

      if (sceneMessages.length === 0) continue;

      const randomAngle = cameraAngles[Math.floor(Math.random() * cameraAngles.length)];
      const randomDistance = shotDistances[Math.floor(Math.random() * shotDistances.length)];

      // Build scene prompt using the existing messages
      const scenePrompt = await buildScenePrompt(
        situation,
        characters.map(c => ({
          name: c.name,
          description: c.description || ''
        })),
        parsed.messages.slice(startIdx, endIdx)
      );

      let imagePrompt = '';
      try {
        const sceneResult = await generateConversationContent({
          model: selectedModel,
          prompt: scenePrompt,
          maxTokens: 1024,
        });
        const sceneResponse = await parseScenePromptResponse(sceneResult.text);
        imagePrompt = sceneResponse.imagePrompt || '';
      } catch (error) {
        console.error('Failed to generate scene prompt:', error);
        imagePrompt = `${situation}, ${randomAngle?.name_en || 'eye level'}, ${randomDistance?.name_en || 'medium shot'}`;
      }

      scenesToInsert.push({
        conversation_id: conversationId,
        scene_number: i + 1,
        scene_description: sceneMessages.map(m => `${m.speaker_name}: ${m.message_text}`).join('\n'),
        image_generation_prompt: imagePrompt,
        metadata: {
          message_range: { start: startIdx, end: endIdx - 1 },
          camera_angle: randomAngle?.name_en || 'eye level',
          shot_distance: randomDistance?.name_en || 'medium shot'
        }
      });
    }

    if (scenesToInsert.length > 0) {
      await supabase.from('conversation_scenes').insert(scenesToInsert);
    }

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        messageCount: messages.length,
        sceneCount: scenesToInsert.length
      }
    });

  } catch (error: any) {
    console.error('Generate from draft error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
