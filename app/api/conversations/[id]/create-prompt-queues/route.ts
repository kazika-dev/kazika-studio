import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getMessageCharacters,
  createPromptQueue,
  query,
} from '@/lib/db';
import {
  buildSceneImagePrompt,
  parseSceneImagePromptResponse,
  SceneImagePromptInput,
} from '@/lib/conversation/prompt-builder';
import { generateConversationContent } from '@/lib/vertex-ai/generate';

interface CreatePromptQueuesRequest {
  aspectRatio?: string;
  additionalTemplateId?: number;
  additionalPrompt?: string;
  priority?: number;
  enhancePrompt?: 'none' | 'enhance';
  enhanceModel?: string;  // プロンプト補完用AIモデル
  promptGenerationModel?: string;  // シーンプロンプト生成用AIモデル
}

/**
 * POST /api/conversations/[id]/create-prompt-queues
 * 会話からプロンプトキューを一括作成
 *
 * - 会話全体のコンテキストからAIで日本語シーンプロンプトを生成
 * - メッセージに紐づくキャラクターシートをprompt_queue_imagesに追加
 * - 指定されたテキストテンプレートをプロンプトに追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = parseInt(id, 10);
    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    // Supabaseクライアントを取得
    const supabase = await createClient();

    // 会話を取得（所有権チェック含む）
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        *,
        studio:studios(id, name, user_id)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 所有権チェック
    const isOwner = conversation.user_id === user.id ||
                    (conversation.studio && conversation.studio.user_id === user.id);
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 会話の場所を取得（conversations.location カラムから）
    const sceneLocation: string | null = conversation.location || null;

    // リクエストボディを取得
    const body: CreatePromptQueuesRequest = await request.json();
    const {
      aspectRatio = '16:9',
      additionalTemplateId,
      additionalPrompt = '',
      priority = 0,
      enhancePrompt = 'none',
      enhanceModel,
      promptGenerationModel = 'gemini-2.5-flash',
    } = body;

    // 追加テンプレートを取得（指定されている場合）
    let templateContent = '';
    if (additionalTemplateId) {
      const templateResult = await query(
        'SELECT content FROM kazikastudio.m_text_templates WHERE id = $1',
        [additionalTemplateId]
      );
      if (templateResult.rows.length > 0) {
        templateContent = templateResult.rows[0].content;
      }
    }

    // メッセージを取得（全メッセージ）
    const { data: messages, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        character:character_sheets(id, name, description)
      `)
      .eq('conversation_id', conversationId)
      .order('sequence_order', { ascending: true });

    if (msgError || !messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages in conversation' }, { status: 400 });
    }

    // 会話に関連するキャラクターを収集
    const characterMap = new Map<number, { id: number; name: string; description?: string }>();
    for (const msg of messages) {
      if (msg.character) {
        const char = Array.isArray(msg.character) ? msg.character[0] : msg.character;
        if (char && char.id) {
          characterMap.set(char.id, {
            id: char.id,
            name: char.name,
            description: char.description,
          });
        }
      }
    }
    const allCharacters = Array.from(characterMap.values());

    // 全メッセージの情報を整形
    const allMessagesForPrompt = messages.map((msg: any) => ({
      id: msg.id,
      speakerName: msg.speaker_name,
      messageText: msg.message_text,
      sequenceOrder: msg.sequence_order,
      emotion: msg.metadata?.emotion,
      emotionTag: msg.metadata?.emotionTag,
    }));

    // 各メッセージに対してプロンプトキューを作成
    const createdQueues = [];
    const errors = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      try {
        // メッセージに紐づくキャラクターを取得
        const messageCharacters = await getMessageCharacters(message.id);

        // AIでシーン画像プロンプトを生成（キャラクターシート画像はAIには送信しない）
        console.log(`[create-prompt-queues] Generating scene prompt for message ${message.id} (${i + 1}/${messages.length})...`);

        const promptInput: SceneImagePromptInput = {
          conversationTitle: conversation.title || '無題の会話',
          situation: conversation.description || '',
          location: sceneLocation || undefined,
          allMessages: allMessagesForPrompt,
          targetMessageIndex: i,
          characters: allCharacters,
          // additionalPrompt は AI 生成には使用せず、キュー登録後にテンプレートとして追加
        };

        const aiPrompt = buildSceneImagePrompt(promptInput);

        // AIに送信するプロンプトをログ出力
        console.log(`[create-prompt-queues] ========== AI PROMPT for message ${message.id} ==========`);
        console.log(aiPrompt);
        console.log(`[create-prompt-queues] ========== END AI PROMPT ==========`);

        // AIでシーンプロンプトを生成（テキストのみ、キャラクターシート画像は送信しない）
        const generateResult = await generateConversationContent({
          model: promptGenerationModel,
          prompt: aiPrompt,
          maxTokens: 2048,
          // images: キャラクターシート画像はAIに送信しない（プロンプトキューへの登録時に使用）
        });

        // AIからの応答をログ出力
        console.log(`[create-prompt-queues] ========== AI RESPONSE for message ${message.id} ==========`);
        console.log(generateResult.text);
        console.log(`[create-prompt-queues] ========== END AI RESPONSE ==========`);

        let scenePromptData;
        try {
          scenePromptData = await parseSceneImagePromptResponse(generateResult.text);
        } catch (parseError) {
          // JSONパースに失敗した場合、AI応答をそのままプロンプトとして使用
          console.warn(`[create-prompt-queues] JSON parse failed for message ${message.id}, using raw response as prompt`);
          console.warn(`[create-prompt-queues] AI response: ${generateResult.text.substring(0, 200)}...`);

          // AI応答からテキスト部分を抽出してプロンプトとして使用
          let rawPrompt = generateResult.text;
          // コードブロックを除去
          rawPrompt = rawPrompt.replace(/```[\s\S]*?```/g, '').trim();
          // 最初の200文字程度を使用
          if (rawPrompt.length > 300) {
            rawPrompt = rawPrompt.substring(0, 300);
          }

          scenePromptData = {
            scenePrompt: rawPrompt || `${message.speaker_name}のシーン。${conversation.description || ''}`,
            sceneCharacterIds: [],
            emotion: '中立',
            cameraAngle: '正面',
          };
        }
        console.log(`[create-prompt-queues] Generated scene prompt: ${scenePromptData.scenePrompt.substring(0, 100)}...`);

        // プロンプトを構築
        let finalPrompt = scenePromptData.scenePrompt;

        // テンプレートを追加（AI生成後に追加するので、AIの出力には影響しない）
        if (templateContent) {
          finalPrompt += `\n\n${templateContent}`;
        }

        // 追加プロンプトを追加（AI生成後に追加するので、AIの出力には影響しない）
        if (additionalPrompt && additionalPrompt.trim()) {
          finalPrompt += `\n\n${additionalPrompt.trim()}`;
        }

        // キャラクターシートIDを決定（AIが提案したものを使用、なければメッセージに紐づくもの）
        let characterSheetIds: number[] = [];
        if (scenePromptData.sceneCharacterIds && scenePromptData.sceneCharacterIds.length > 0) {
          characterSheetIds = scenePromptData.sceneCharacterIds.slice(0, 4);
        } else if (messageCharacters.length > 0) {
          characterSheetIds = messageCharacters.map((mc: any) => mc.character_sheet_id).slice(0, 4);
        }

        // prompt_queue_images用のデータを準備
        const images = characterSheetIds.map((id: number) => ({
          image_type: 'character_sheet' as const,
          reference_id: id,
        }));

        // キュー名を生成
        const queueName = `${conversation.title || '会話'} - シーン ${message.sequence_order + 1}`;

        // プロンプトキューを作成
        const queue = await createPromptQueue(user.id, {
          name: queueName,
          prompt: finalPrompt.trim(),
          aspect_ratio: aspectRatio,
          priority,
          enhance_prompt: enhancePrompt,
          metadata: {
            conversation_id: conversationId,
            message_id: message.id,
            sequence_order: message.sequence_order,
            speaker_name: message.speaker_name,
            character_id: message.character_id,
            enhance_model: enhanceModel,
            ai_generated_prompt: true,
            scene_emotion: scenePromptData.emotion,
            scene_camera_angle: scenePromptData.cameraAngle,
          },
          images,
        });

        createdQueues.push({
          queue_id: queue.id,
          message_id: message.id,
          sequence_order: message.sequence_order,
          character_count: characterSheetIds.length,
          scene_prompt_preview: scenePromptData.scenePrompt.substring(0, 100),
        });

        // レート制限対策：少し待機
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (err: any) {
        console.error(`Failed to create queue for message ${message.id}:`, err);
        errors.push({
          message_id: message.id,
          sequence_order: message.sequence_order,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        created_count: createdQueues.length,
        error_count: errors.length,
        total_messages: messages.length,
        queues: createdQueues,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('Failed to create prompt queues from conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create prompt queues', details: error.message },
      { status: 500 }
    );
  }
}
