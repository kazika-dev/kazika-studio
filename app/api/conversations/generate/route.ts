import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildConversationPrompt,
  parseAIResponse,

  validateMessageSpeakers,
  buildScenePrompt,
  parseScenePromptResponse

} from '@/lib/conversation/prompt-builder';
import { getAllCameraAngles, getAllShotDistances, addCharacterToMessage } from '@/lib/db'; // Still needed for random scene generation
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

    // studioId and storySceneId are now optional (at least one should be provided)
    const studioId = body.studioId;
    const storySceneId = body.storySceneId;

    // Validate that at least one of studioId or storySceneId is provided
    if (!studioId && !storySceneId) {
      return NextResponse.json(
        { success: false, error: 'Either studioId or storySceneId must be provided' },
        { status: 400 }
      );
    }

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

    // If storySceneId is provided, verify scene ownership via story
    if (storySceneId) {
      const { data: scene, error: sceneError } = await supabase
        .from('story_scenes')
        .select(`
          id,
          story:stories(id, user_id)
        `)
        .eq('id', storySceneId)
        .single();

      if (sceneError || !scene) {
        return NextResponse.json(
          { success: false, error: 'Scene not found' },
          { status: 404 }
        );
      }

      const story = Array.isArray(scene.story) ? scene.story[0] : scene.story;
      if (!story || story.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Scene does not belong to user' },
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

    // Build prompt (now async - fetches emotion tags from database and uses template)
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
      tone: body.tone,
      previousMessages: body.previousMessages
    }, body.promptTemplateId);

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
    console.log('[DEBUG] Prompt sent to AI:', prompt.substring(0, 500) + '...');
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();
    console.log('[DEBUG] AI raw response:', aiResponse);

    // Parse AI response
    let parsed;
    try {
      parsed = await parseAIResponse(aiResponse);
      console.log('[DEBUG] Parsed messages:', JSON.stringify(parsed.messages, null, 2));
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
    console.log('[Generate Conversation] Creating conversation with studioId:', studioId || 'null', 'storySceneId:', storySceneId || 'null', 'userId:', user.id);
    const conversationData: {
      user_id: string;
      title: string;
      description: string;
      studio_id?: number;
      story_scene_id?: number;
    } = {
      user_id: user.id,
      title: body.title,
      description: body.situation
    };

    // Only add studio_id if provided
    if (studioId) {
      conversationData.studio_id = studioId;
    }

    // Only add story_scene_id if provided
    if (storySceneId) {
      conversationData.story_scene_id = storySceneId;
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
    console.log('[Conversation Generate] Available characters:', characters.map(c => ({ id: c.id, name: c.name })));
    console.log('[Conversation Generate] Generated messages:', parsed.messages.map(m => ({ speakerId: m.speakerId, speaker: m.speaker })));
    const messagesToInsert = parsed.messages.map((msg, idx) => {
       let character = null;
      // 優先順位1: speakerIdが指定されている場合はそれを使用
      if (msg.speakerId !== undefined && msg.speakerId !== null) {
        character = characters.find(c => c.id === msg.speakerId);
        if (character) {
          console.log(`[Message ${idx}] Matched speakerId ${msg.speakerId} to character "${character.name}"`);
        } else {
          console.warn(`[Message ${idx}] speakerId ${msg.speakerId} not found in available characters`);
        }
      }
      // 優先順位2: speakerIdがない場合は名前でマッチング
      if (!character && msg.speaker) {
        // 完全一致を試みる
        character = characters.find(c => c.name === msg.speaker);
        // 完全一致しない場合、部分一致を試みる
        if (!character) {
          character = characters.find(c =>
            c.name.includes(msg.speaker!) || msg.speaker!.includes(c.name)
          );
        }
        // それでも見つからない場合、トリムして比較
        if (!character) {
          const trimmedSpeaker = msg.speaker.trim();
          character = characters.find(c => c.name.trim() === trimmedSpeaker);
        }
        if (character) {
          console.log(`[Message ${idx}] Matched speaker name "${msg.speaker}" to character ID ${character.id} (${character.name})`);
        }
      }
      if (!character) {
        console.warn(`[Message ${idx}] Character not found for speakerId:${msg.speakerId}, speaker:"${msg.speaker}". Available characters:`, characters.map(c => ({ id: c.id, name: c.name })));
      }

      // Determine speaker_name: use speaker if provided, otherwise use character name
      const speakerName = msg.speaker || character?.name || 'Unknown';

      // Add emotion tag to message text if present
      const emotionTagPrefix = msg.emotionTag ? `[${msg.emotionTag}] ` : '';
      const messageTextWithTag = emotionTagPrefix + msg.message;

      return {
        conversation_id: conversation.id,
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
      // Rollback conversation
      await supabase.from('conversations').delete().eq('id', conversation.id);
      return NextResponse.json(
        { success: false, error: 'Failed to save messages' },
        { status: 500 }
      );
    }

    // Register scene characters to each message
    console.log('[Generate Conversation] Registering scene characters to messages...');
    for (let idx = 0; idx < messages.length; idx++) {
      const msg = parsed.messages[idx];
      const insertedMsg = messages[idx];

      if (msg.sceneCharacterIds && msg.sceneCharacterIds.length > 0) {
        console.log(
          `[Generate Conversation] Registering ${msg.sceneCharacterIds.length} characters to message ${insertedMsg.id}`
        );

        for (let i = 0; i < Math.min(msg.sceneCharacterIds.length, 4); i++) {
          const characterId = msg.sceneCharacterIds[i];
          try {
            await addCharacterToMessage(insertedMsg.id, characterId, { displayOrder: i + 1 });
            console.log(
              `[Generate Conversation] Registered character ${characterId} to message ${insertedMsg.id} (order: ${i + 1})`
            );
          } catch (error) {
            console.error(
              `[Generate Conversation] Failed to register character ${characterId} to message ${insertedMsg.id}:`,
              error
            );
            // Continue with other characters
          }
        }
      }
    }

    // Generate conversation scenes
    // Group messages into scenes (e.g., every 3-5 messages or based on topic changes)
    const scenesPerConversation = Math.max(1, Math.ceil(messages.length / 4)); // Aim for ~4 messages per scene
    const scenesToInsert = [];

    // Fetch camera angles and shot distances from database for scene generation
    const cameraAngles = await getAllCameraAngles();
    const shotDistances = await getAllShotDistances();

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

      // Get random camera angle and shot distance for variety
      const randomCameraAngle = cameraAngles[Math.floor(Math.random() * cameraAngles.length)];
      const randomShotDistance = shotDistances[Math.floor(Math.random() * shotDistances.length)];

      // Create image generation prompt based on the scene context with camera info
      const cameraInfo = randomCameraAngle && randomShotDistance
        ? `, ${randomCameraAngle.name}, ${randomShotDistance.name}`
        : '';
      const imagePrompt = `${body.situation}の場面で、${sceneMessages.map(m => m.speaker_name).filter((v, i, a) => a.indexOf(v) === i).join('と')}が会話している様子。${sceneMessages[0].metadata?.emotion || 'neutral'}な雰囲気${cameraInfo}。`;

      scenesToInsert.push({
        conversation_id: conversation.id,
        scene_number: i + 1,
        scene_description: sceneDescription,
        image_generation_prompt: imagePrompt,
        metadata: {
          message_ids: sceneMessages.map(m => m.id),
          start_sequence: startIdx,
          end_sequence: endIdx - 1,
          dialogue_preview: sceneDialogue.slice(0, 200),
          cameraAngle: randomCameraAngle?.name || null,
          shotDistance: randomShotDistance?.name || null
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

    // Generate scene image prompt
    console.log('Generating scene image prompt...');
    let sceneData = null;
    try {
      // Build scene prompt (now async - fetches camera angles and shot distances from database)
      const scenePrompt = await buildScenePrompt(
        body.situation,
        characters.map(c => ({
          name: c.name,
          description: c.description || 'キャラクターの説明なし'
        })),
        parsed.messages
      );

      const sceneResult = await model.generateContent(scenePrompt);
      const sceneAiResponse = sceneResult.response.text();
      const scenePromptData = await parseScenePromptResponse(sceneAiResponse);

      // Save scene to database with camera info
      const { data: scene, error: sceneError } = await supabase
        .from('conversation_scenes')
        .insert({
          conversation_id: conversation.id,
          scene_number: 1,
          scene_description: scenePromptData.sceneDescription,
          image_generation_prompt: scenePromptData.imagePrompt,
          metadata: {
            cameraAngle: scenePromptData.cameraAngle || null,
            shotDistance: scenePromptData.shotDistance || null
          }
        })
        .select()
        .single();

      if (sceneError) {
        console.error('Failed to save scene:', sceneError);
      } else {
        sceneData = scene;
        console.log('Scene image prompt generated successfully');
      }
    } catch (sceneError) {
      console.error('Failed to generate scene prompt:', sceneError);
      // Continue even if scene generation fails - this is not critical
    }

    console.log(`Successfully generated conversation ${conversation.id} with ${messages.length} messages`);

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        messages,
        scene: sceneData
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
