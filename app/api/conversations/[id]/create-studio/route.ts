import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const { workflowId } = body;

    console.log('[POST /api/conversations/:id/create-studio] Creating studio from conversation ID:', id, 'with workflow ID:', workflowId);
    const supabase = await createClient();

    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[POST /api/conversations/:id/create-studio] Auth error:', authError);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[POST /api/conversations/:id/create-studio] User authenticated:', user.id);

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
        *,
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

    // Create workflow steps if workflowId is provided
    let workflowSteps = null;
    if (workflowId) {
      console.log('[POST /api/conversations/:id/create-studio] Creating workflow steps with workflow ID:', workflowId);

      // Verify workflow exists and belongs to user
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .select('id, name, nodes')
        .eq('id', workflowId)
        .eq('user_id', user.id)
        .single();

      if (workflowError || !workflow) {
        console.error('Workflow not found or unauthorized:', workflowError);
        // Continue without workflow steps
        console.log('[POST /api/conversations/:id/create-studio] Warning: Workflow not found, skipping workflow steps');
      } else {
        console.log('[POST /api/conversations/:id/create-studio] Found workflow:', workflow.name);

        // Parse workflow nodes
        const workflowNodes = typeof workflow.nodes === 'string'
          ? JSON.parse(workflow.nodes)
          : workflow.nodes;

        // Find ElevenLabs nodes in the workflow
        const elevenLabsNodes = workflowNodes.filter(
          (node: any) => node.data?.type === 'elevenlabs' || node.type === 'elevenlabs'
        );

        console.log('[POST /api/conversations/:id/create-studio] Found', elevenLabsNodes.length, 'ElevenLabs nodes');

        // Create workflow steps for each board
        const workflowStepsToInsert = boards.map((board, idx) => {
          const message = messages[idx];
          const characterVoiceId = message.character?.elevenlabs_voice_id;

          // デフォルトの音声ID（キャラクターに設定されていない場合）
          const voiceId = characterVoiceId || 'JBFqnCBsd6RMkjVDRZzb';

          // Build input_config with node-specific overrides
          const nodeOverrides: any = {};

          // For each ElevenLabs node, set text and voiceId
          elevenLabsNodes.forEach((node: any) => {
            nodeOverrides[node.id] = {
              text: message.message_text,
              voiceId: voiceId,
            };
          });

          console.log(`[Board ${idx}] Message: "${message.message_text.substring(0, 50)}..."`);
          console.log(`[Board ${idx}] Character: ${message.speaker_name}, VoiceID: ${voiceId}`);
          console.log(`[Board ${idx}] Node overrides:`, nodeOverrides);

          return {
            board_id: board.id,
            workflow_id: workflowId,
            step_order: 0,
            execution_status: 'pending',
            input_config: {
              // General metadata
              character_id: message.character_id,
              character_name: message.speaker_name,
              has_custom_voice: !!characterVoiceId,
              // Node-specific overrides
              nodeOverrides: nodeOverrides,
            }
          };
        });

        const { data: createdSteps, error: stepsError } = await supabase
          .from('studio_board_workflow_steps')
          .insert(workflowStepsToInsert)
          .select();

        if (stepsError) {
          console.error('Failed to create workflow steps:', stepsError);
          // Continue even if workflow steps fail - boards are already created
          console.log('[POST /api/conversations/:id/create-studio] Warning: Could not create workflow steps, but boards were created successfully');
        } else {
          workflowSteps = createdSteps;
          console.log('[POST /api/conversations/:id/create-studio] Created', workflowSteps?.length || 0, 'workflow steps');
        }
      }
    } else {
      console.log('[POST /api/conversations/:id/create-studio] No workflow ID provided, skipping workflow steps');
    }

    return NextResponse.json({
      success: true,
      data: {
        studioId: studio.id,
        studioName: studio.name,
        boardCount: boards.length,
        workflowStepCount: workflowSteps?.length || 0
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
