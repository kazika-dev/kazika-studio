import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { getNodeTypeConfig } from '@/lib/workflow/formConfigGenerator';

/**
 * POST /api/conversations/:id/create-studio
 * Create a studio from a conversation
 * Each message in the conversation becomes a board in the studio
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { workflowIds = [], workflowId } = body;

    // 後方互換性: workflowIdが指定されている場合はworkflowIdsに変換
    const workflowIdsArray = workflowIds.length > 0 ? workflowIds : (workflowId ? [workflowId] : []);

    console.log('[POST /api/conversations/:id/create-studio] Creating studio from conversation ID:', id, 'with workflow IDs:', workflowIdsArray);

    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      console.log('[POST /api/conversations/:id/create-studio] Auth error: No user');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[POST /api/conversations/:id/create-studio] User authenticated:', user.id);

    const supabase = await createClient();

    // Fetch conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError || !conversation) {
      console.log('[POST /api/conversations/:id/create-studio] Conversation not found. Error:', convError);
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Conversation does not belong to user' },
        { status: 403 }
      );
    }

    console.log('[POST /api/conversations/:id/create-studio] Conversation found:', conversation.id);

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        character_id,
        speaker_name,
        message_text,
        sequence_order,
        scene_prompt_ja,
        scene_prompt_en,
        metadata,
        character:character_sheets(id, name, image_url, elevenlabs_voice_id)
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

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages found in conversation' },
        { status: 400 }
      );
    }

    // Fetch scene characters for all messages
    const { data: sceneCharacters, error: scError } = await supabase
      .from('conversation_message_characters')
      .select('conversation_message_id, character_sheet_id, display_order')
      .in('conversation_message_id', messages.map(m => m.id))
      .order('conversation_message_id')
      .order('display_order');

    if (scError) {
      console.error('Failed to fetch scene characters:', scError);
      // Continue without scene characters (fallback to speaker character only)
    }

    // Build a map of messageId -> characterSheetIds
    const messageCharactersMap = new Map<number, number[]>();
    if (sceneCharacters) {
      sceneCharacters.forEach(sc => {
        if (!messageCharactersMap.has(sc.conversation_message_id)) {
          messageCharactersMap.set(sc.conversation_message_id, []);
        }
        messageCharactersMap.get(sc.conversation_message_id)!.push(sc.character_sheet_id);
      });
    }

    console.log('[POST /api/conversations/:id/create-studio] Found', messages.length, 'messages');

    // Create studio
    const { data: studio, error: studioError } = await supabase
      .from('studios')
      .insert({
        user_id: user.id,
        name: conversation.title,
        description: conversation.description || `Created from conversation: ${conversation.title}`,
        metadata: {
          source: 'conversation',
          conversation_id: conversation.id
        }
      })
      .select()
      .single();

    if (studioError || !studio) {
      console.error('Failed to create studio:', studioError);
      return NextResponse.json(
        { success: false, error: 'Failed to create studio' },
        { status: 500 }
      );
    }

    console.log('[POST /api/conversations/:id/create-studio] Studio created:', studio.id);

    // Create boards for each message
    const boardsToInsert = messages.map((msg, idx) => {
      const fullText = `${msg.speaker_name}「${msg.message_text}」`;
      return {
        studio_id: studio.id,
        sequence_order: idx,
        title: fullText,
        description: '',
        prompt_text: fullText,
        status: 'draft',
        metadata: {
          conversation_message_id: msg.id,
          character_id: msg.character_id,
          emotion: msg.metadata?.emotion || 'neutral'
        }
      };
    });

    const { data: boards, error: boardsError } = await supabase
      .from('studio_boards')
      .insert(boardsToInsert)
      .select();

    if (boardsError || !boards) {
      console.error('Failed to create boards:', boardsError);
      // Rollback studio creation
      await supabase.from('studios').delete().eq('id', studio.id);
      return NextResponse.json(
        { success: false, error: 'Failed to create boards' },
        { status: 500 }
      );
    }

    console.log('[POST /api/conversations/:id/create-studio] Created', boards.length, 'boards');

    // Create workflow steps if workflowIds are provided
    let totalWorkflowSteps = 0;
    if (workflowIdsArray.length > 0) {
      console.log('[POST /api/conversations/:id/create-studio] Creating workflow steps with workflow IDs:', workflowIdsArray);

      // 各ワークフローIDに対してワークフローステップを作成
      for (const workflowId of workflowIdsArray) {
        console.log('[POST /api/conversations/:id/create-studio] Processing workflow ID:', workflowId);

        // Verify workflow exists and belongs to user
        const { data: workflow, error: workflowError } = await supabase
          .from('workflows')
          .select('id, name, nodes')
          .eq('id', workflowId)
          .eq('user_id', user.id)
          .single();

        if (workflowError || !workflow) {
          console.error(`Workflow ${workflowId} not found or unauthorized:`, workflowError);
          // Continue to next workflow
          console.log('[POST /api/conversations/:id/create-studio] Warning: Workflow not found, skipping this workflow');
          continue;
        }

        console.log('[POST /api/conversations/:id/create-studio] Found workflow:', workflow.name);

        // Parse workflow nodes
        const workflowNodes = typeof workflow.nodes === 'string'
          ? JSON.parse(workflow.nodes)
          : workflow.nodes;

        // Categorize nodes by type
        const nodesByType = new Map<string, any[]>();
        workflowNodes.forEach((node: any) => {
          const nodeType = node.data?.type || node.type;
          if (!nodeType) return;

          if (!nodesByType.has(nodeType)) {
            nodesByType.set(nodeType, []);
          }
          nodesByType.get(nodeType)!.push(node);
        });

        console.log('[POST /api/conversations/:id/create-studio] Found nodes by type:',
          Array.from(nodesByType.entries()).map(([type, nodes]) => `${type}:${nodes.length}`).join(', '));

        // Create workflow steps for each board
        const workflowStepsToInsert = boards.map((board, idx) => {
          const message = messages[idx];
          // Type assertion: Supabase infers character as array, but it's actually a single object
          const character = Array.isArray(message.character) ? message.character[0] : message.character;
          const characterVoiceId = character?.elevenlabs_voice_id;

          // デバッグ: キャラクター情報を出力
          console.log(`[Board ${idx}] Character data:`, {
            character_id: message.character_id,
            character_name: message.speaker_name,
            character_object: message.character,
            elevenlabs_voice_id: characterVoiceId
          });

          // デフォルトの音声ID（キャラクターに設定されていない場合）
          const voiceId = characterVoiceId || 'JBFqnCBsd6RMkjVDRZzb';

          // Build workflowInputs in the same format as normal workflow execution
          const workflowInputs: Record<string, any> = {};

          // Get scene characters from the map (characters registered in conversation_message_characters)
          const sceneCharacterIds = messageCharactersMap.get(message.id) || [];

          // Process each node type dynamically
          nodesByType.forEach((nodes, nodeType) => {
            try {
              const nodeConfig = getNodeTypeConfig(nodeType);

              nodes.forEach((node: any) => {
                const nodeId = node.id;

                // Apply node-specific field values based on node type configuration
                nodeConfig.fields.forEach((field) => {
                  const fieldKey = `${nodeType}_${field.name}_${nodeId}`;

                  // Handle special cases for specific field types
                  if (field.name === 'text' && nodeType === 'elevenlabs') {
                    // ElevenLabs text field: use message text
                    workflowInputs[fieldKey] = message.message_text;
                  } else if (field.name === 'voiceId' && nodeType === 'elevenlabs') {
                    // ElevenLabs voiceId field: use character voice ID
                    workflowInputs[fieldKey] = voiceId;
                  } else if (field.name === 'modelId' && nodeType === 'elevenlabs') {
                    // ElevenLabs modelId field: use node config or default
                    workflowInputs[fieldKey] = node.data?.config?.modelId || 'eleven_turbo_v2_5';
                  } else if (field.name === 'prompt') {
                    // Prompt field: use scene prompt (priority varies by node type)
                    let prompt = '';
                    if (nodeType === 'nanobana') {
                      // Nanobana: prefer English prompt for image generation
                      prompt = message.scene_prompt_en || message.scene_prompt_ja || message.metadata?.scene || '';
                    } else if (nodeType === 'gemini') {
                      // Gemini: prefer Japanese prompt for image recognition
                      prompt = message.scene_prompt_ja || message.scene_prompt_en || message.metadata?.scene || '';
                    } else {
                      // Other nodes: use English then Japanese
                      prompt = message.scene_prompt_en || message.scene_prompt_ja || message.metadata?.scene || '';
                    }

                    if (!prompt) {
                      console.warn(`[Board ${idx}] Warning: No prompt available for ${nodeType} node`);
                    }

                    workflowInputs[fieldKey] = prompt;
                  } else if (field.name === 'model' && field.type === 'select') {
                    // Model field: use node config or default from field options
                    const defaultModel = node.data?.config?.model || field.options?.[0]?.value || '';
                    workflowInputs[fieldKey] = defaultModel;
                  } else if (field.type === 'characterSheets' && field.name === 'selectedCharacterSheetIds') {
                    // Character sheets field: auto-populate from conversation
                    if (sceneCharacterIds.length > 0) {
                      // Use scene characters if available (up to maxSelections)
                      const maxSelections = field.maxSelections || 4;
                      workflowInputs[fieldKey] = sceneCharacterIds.slice(0, maxSelections).map(String);
                      console.log(`[Board ${idx}] Using scene characters for ${nodeType}:`, sceneCharacterIds);
                    } else if (message.character_id) {
                      // Fallback to speaker character if no scene characters registered
                      workflowInputs[fieldKey] = [String(message.character_id)];
                      console.log(`[Board ${idx}] Falling back to speaker character for ${nodeType}:`, message.character_id);
                    }
                  }
                  // Other field types can be added here as needed
                });
              });
            } catch (error) {
              console.warn(`[Board ${idx}] Warning: Could not get config for node type "${nodeType}":`, error);
              // Continue processing other node types
            }
          });

          console.log(`[Board ${idx}] Message: "${message.message_text.substring(0, 50)}..."`);
          console.log(`[Board ${idx}] Character: ${message.speaker_name}, VoiceID: ${voiceId}`);
          console.log(`[Board ${idx}] Scene Prompt (EN): "${(message.scene_prompt_en || '').substring(0, 50)}..."`);
          console.log(`[Board ${idx}] Scene Prompt (JA): "${(message.scene_prompt_ja || '').substring(0, 50)}..."`);
          console.log(`[Board ${idx}] Workflow inputs:`, JSON.stringify(workflowInputs, null, 2));

          return {
            board_id: board.id,
            workflow_id: workflowId,
            step_order: workflowIdsArray.indexOf(workflowId), // 複数ワークフローの実行順序
            execution_status: 'pending',
            input_config: {
              usePrompt: false,
              workflowInputs: workflowInputs,
              usePreviousText: false,
              usePreviousAudio: false,
              usePreviousImage: false,
              usePreviousVideo: false
            }
          };
        });

        const { data: createdSteps, error: stepsError } = await supabase
          .from('studio_board_workflow_steps')
          .insert(workflowStepsToInsert)
          .select();

        if (stepsError) {
          console.error(`Failed to create workflow steps for workflow ${workflowId}:`, stepsError);
          // Continue to next workflow even if this one fails
          console.log('[POST /api/conversations/:id/create-studio] Warning: Could not create workflow steps for this workflow, continuing to next');
        } else {
          totalWorkflowSteps += createdSteps?.length || 0;
          console.log(`[POST /api/conversations/:id/create-studio] Created ${createdSteps?.length || 0} workflow steps for workflow ${workflowId}`);
        }
      }
    } else {
      console.log('[POST /api/conversations/:id/create-studio] No workflow IDs provided, skipping workflow steps');
    }

    return NextResponse.json({
      success: true,
      data: {
        studioId: studio.id,
        studioName: studio.name,
        boardCount: boards.length,
        workflowStepCount: totalWorkflowSteps,
        workflowCount: workflowIdsArray.length
      }
    });

  } catch (error: unknown) {
    console.error('Create studio from conversation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
