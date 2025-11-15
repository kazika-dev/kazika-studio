import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildConversationPrompt, parseAIResponse, validateMessageSpeakers } from '@/lib/conversation/prompt-builder';
import type { GenerateConversationRequest, GenerateConversationResponse } from '@/types/conversation';

/**
 * POST /api/conversations/generate
 * Generate a conversation using AI based on character information
 */
export async function POST(request: NextRequest) {
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

    const body: GenerateConversationRequest = await request.json();

    // Validation
    if (!body.title || !body.characterIds || !body.situation) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: title, characterIds, situation' },
        { status: 400 }
      );
    }

    if (body.characterIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 characters are required' },
        { status: 400 }
      );
    }

    if (body.messageCount < 1 || body.messageCount > 20) {
      return NextResponse.json(
        { success: false, error: 'Message count must be between 1 and 20' },
        { status: 400 }
      );
    }

    // studioId is now optional
    const studioId = body.studioId;

    // If studioId is provided, verify studio ownership
    if (studioId) {
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
    }

    // Fetch character information
    const { data: characters, error: charError } = await supabase
      .from('character_sheets')
      .select('id, name, description, personality, speaking_style, sample_dialogues')
      .in('id', body.characterIds);

    if (charError || !characters || characters.length !== body.characterIds.length) {
      return NextResponse.json(
        { success: false, error: 'Invalid character IDs or characters not found' },
        { status: 400 }
      );
    }

    // Build prompt
    const prompt = buildConversationPrompt({
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
      tone: body.tone,
      previousMessages: body.previousMessages
    });

    // Generate conversation using Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    console.log('Generating conversation with Gemini...');
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

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
      // Continue anyway, but log the warning
    }

    // Create conversation in database
    console.log('[Generate Conversation] Creating conversation with studioId:', studioId || 'null', 'userId:', user.id);
    const conversationData: {
      user_id: string;
      title: string;
      description: string;
      studio_id?: number;
    } = {
      user_id: user.id,
      title: body.title,
      description: body.situation
    };

    // Only add studio_id if provided
    if (studioId) {
      conversationData.studio_id = studioId;
    }

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert(conversationData)
      .select()
      .single();

    if (convError || !conversation) {
      console.error('Failed to create conversation:', convError);
      return NextResponse.json(
        { success: false, error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    // Save messages to database
    const messagesToInsert = parsed.messages.map((msg, idx) => {
      const character = characters.find(c => c.name === msg.speaker);
      return {
        conversation_id: conversation.id,
        character_id: character?.id || null,
        speaker_name: msg.speaker,
        message_text: msg.message,
        sequence_order: idx,
        metadata: {
          emotion: msg.emotion || 'neutral'
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
      // Rollback conversation
      await supabase.from('conversations').delete().eq('id', conversation.id);
      return NextResponse.json(
        { success: false, error: 'Failed to save messages' },
        { status: 500 }
      );
    }

    // Generate conversation scenes
    // Group messages into scenes (e.g., every 3-5 messages or based on topic changes)
    const scenesPerConversation = Math.max(1, Math.ceil(messages.length / 4)); // Aim for ~4 messages per scene
    const scenesToInsert = [];

    for (let i = 0; i < scenesPerConversation; i++) {
      const startIdx = Math.floor(i * messages.length / scenesPerConversation);
      const endIdx = Math.floor((i + 1) * messages.length / scenesPerConversation);
      const sceneMessages = messages.slice(startIdx, endIdx);

      if (sceneMessages.length === 0) continue;

      // Create scene description from the messages in this scene
      const sceneDialogue = sceneMessages
        .map(m => `${m.speaker_name}: ${m.message_text}`)
        .join('\n');

      const sceneDescription = `Scene ${i + 1}: ${sceneMessages[0].speaker_name}との会話 (${sceneMessages.length}メッセージ)`;

      // Create image generation prompt based on the scene context
      const imagePrompt = `${body.situation}の場面で、${sceneMessages.map(m => m.speaker_name).filter((v, i, a) => a.indexOf(v) === i).join('と')}が会話している様子。${sceneMessages[0].metadata?.emotion || 'neutral'}な雰囲気。`;

      scenesToInsert.push({
        conversation_id: conversation.id,
        scene_number: i + 1,
        scene_description: sceneDescription,
        image_generation_prompt: imagePrompt,
        metadata: {
          message_ids: sceneMessages.map(m => m.id),
          start_sequence: startIdx,
          end_sequence: endIdx - 1,
          dialogue_preview: sceneDialogue.slice(0, 200)
        }
      });
    }

    // Insert scenes into database
    const { data: scenes, error: sceneError } = await supabase
      .from('conversation_scenes')
      .insert(scenesToInsert)
      .select();

    if (sceneError) {
      console.error('Failed to save conversation scenes:', sceneError);
      // Don't fail the entire operation, just log the error
    } else {
      console.log(`Created ${scenes?.length || 0} scenes for conversation ${conversation.id}`);
    }

    // Save generation log
    await supabase.from('conversation_generation_logs').insert({
      conversation_id: conversation.id,
      prompt_template: prompt,
      prompt_variables: body,
      ai_model: 'gemini-2.0-flash-exp',
      ai_response: aiResponse,
      generated_messages: messages.map(m => m.id)
    });

    console.log(`Successfully generated conversation ${conversation.id} with ${messages.length} messages and ${scenes?.length || 0} scenes`);

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        messages
      }
    } as GenerateConversationResponse);

  } catch (error: unknown) {
    console.error('Generate conversation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
