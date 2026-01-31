import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import {
  getConversationById,
  getConversationMessages,
  getMessageCharacters,
  createPromptQueue,
  query,
} from '@/lib/db';

interface CreatePromptQueuesRequest {
  model?: string;
  aspectRatio?: string;
  additionalTemplateId?: number;
  additionalPrompt?: string;
  priority?: number;
  enhancePrompt?: 'none' | 'enhance';
}

/**
 * POST /api/conversations/[id]/create-prompt-queues
 * 会話からプロンプトキューを一括作成
 *
 * - 各メッセージのシーンプロンプト（scene_prompt_en）を使用
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

    // 会話を取得
    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 所有権チェック（studio経由またはstory_scene経由）
    let hasAccess = false;
    if (conversation.studio_id) {
      const studioResult = await query(
        'SELECT user_id FROM kazikastudio.studios WHERE id = $1',
        [conversation.studio_id]
      );
      hasAccess = studioResult.rows.length > 0 && studioResult.rows[0].user_id === user.id;
    }
    if (!hasAccess && conversation.story_scene_id) {
      const storyResult = await query(
        `SELECT s.user_id FROM kazikastudio.story_scenes ss
         JOIN kazikastudio.stories s ON s.id = ss.story_id
         WHERE ss.id = $1`,
        [conversation.story_scene_id]
      );
      hasAccess = storyResult.rows.length > 0 && storyResult.rows[0].user_id === user.id;
    }
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // リクエストボディを取得
    const body: CreatePromptQueuesRequest = await request.json();
    const {
      model = 'gemini-2.5-flash-image',
      aspectRatio = '16:9',
      additionalTemplateId,
      additionalPrompt = '',
      priority = 0,
      enhancePrompt = 'none',
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

    // メッセージを取得
    const messages = await getConversationMessages(conversationId);
    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages in conversation' }, { status: 400 });
    }

    // シーンプロンプトを持つメッセージのみをフィルタリング
    const messagesWithScenePrompt = messages.filter(
      (msg: any) => msg.scene_prompt_en || msg.scene_prompt_ja
    );

    if (messagesWithScenePrompt.length === 0) {
      return NextResponse.json(
        { error: 'No messages with scene prompts found' },
        { status: 400 }
      );
    }

    // 各メッセージに対してプロンプトキューを作成
    const createdQueues = [];
    const errors = [];

    for (const message of messagesWithScenePrompt) {
      try {
        // メッセージに紐づくキャラクターを取得
        const messageCharacters = await getMessageCharacters(message.id);

        // キャラクターシートIDを抽出
        const characterSheetIds = messageCharacters.map((mc: any) => mc.character_sheet_id);

        // プロンプトを構築
        // 英語プロンプト優先、なければ日本語
        let basePrompt = message.scene_prompt_en || message.scene_prompt_ja || '';

        // キャラクター情報をプロンプトに追加
        const characterNames = messageCharacters.map((mc: any) => mc.character_sheets?.name).filter(Boolean);
        if (characterNames.length > 0) {
          basePrompt += `\n\nCharacters: ${characterNames.join(', ')}`;
        }

        // 感情・表情情報を追加
        if (message.metadata?.emotion) {
          basePrompt += `\nExpression: ${message.metadata.emotion}`;
        }
        if (message.metadata?.emotionTag) {
          basePrompt += `\nMood: ${message.metadata.emotionTag}`;
        }

        // シーン情報を追加（メタデータから）
        if (message.metadata?.scene) {
          basePrompt += `\nScene description: ${message.metadata.scene}`;
        }

        // テンプレートを追加
        if (templateContent) {
          basePrompt += `\n\n${templateContent}`;
        }

        // 追加プロンプトを追加
        if (additionalPrompt.trim()) {
          basePrompt += `\n\n${additionalPrompt}`;
        }

        // prompt_queue_images用のデータを準備
        const images = characterSheetIds.map((id: number, index: number) => ({
          image_type: 'character_sheet' as const,
          reference_id: id,
        }));

        // キュー名を生成
        const queueName = `${conversation.title || '会話'} - シーン ${message.sequence_order + 1}`;

        // プロンプトキューを作成
        const queue = await createPromptQueue(user.id, {
          name: queueName,
          prompt: basePrompt.trim(),
          model,
          aspect_ratio: aspectRatio,
          priority,
          enhance_prompt: enhancePrompt,
          metadata: {
            conversation_id: conversationId,
            message_id: message.id,
            sequence_order: message.sequence_order,
            speaker_name: message.speaker_name,
            character_id: message.character_id,
          },
          images,
        });

        createdQueues.push({
          queue_id: queue.id,
          message_id: message.id,
          sequence_order: message.sequence_order,
          character_count: characterSheetIds.length,
        });
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
        total_messages: messagesWithScenePrompt.length,
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
