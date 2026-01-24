import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildEmotionTagReanalysisPrompt,
  parseEmotionTagReanalysisResponse,
} from '@/lib/conversation/prompt-builder';

/**
 * POST /api/conversations/messages/bulk-update-tags
 * 選択したメッセージの感情タグを一括追加、削除、または再分析
 *
 * Body:
 *   messageIds: number[] (対象のメッセージID)
 *   action: 'add' | 'remove' | 'reanalyze'
 *   tagName?: string (action === 'add' の場合に必須)
 */
export async function POST(request: NextRequest) {
  try {
    // Cookie、APIキー、JWT認証をサポート
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    const body = await request.json();
    const { messageIds, action, tagName } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messageIds is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!action || !['add', 'remove', 'reanalyze'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "add", "remove", or "reanalyze"' },
        { status: 400 }
      );
    }

    if (action === 'add' && !tagName) {
      return NextResponse.json(
        { success: false, error: 'tagName is required for add action' },
        { status: 400 }
      );
    }

    // メッセージを取得
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*, conversation:conversations(id, description, studio_id, story_scene_id)')
      .in('id', messageIds)
      .order('sequence_order', { ascending: true });

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Messages not found' },
        { status: 404 }
      );
    }

    // 所有権チェック（最初のメッセージの会話で確認）
    const conversation = messages[0].conversation;
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (conversation.studio_id) {
      const { data: studio } = await supabase
        .from('studios')
        .select('user_id')
        .eq('id', conversation.studio_id)
        .single();

      if (!studio || studio.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else if (conversation.story_scene_id) {
      const { data: scene } = await supabase
        .from('story_scenes')
        .select('story:stories(user_id)')
        .eq('id', conversation.story_scene_id)
        .single();

      const story = scene?.story && (Array.isArray(scene.story) ? scene.story[0] : scene.story);
      if (!story || story.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Forbidden' },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation' },
        { status: 400 }
      );
    }

    console.log(`[Bulk Update Tags] ${action} tags for ${messages.length} selected messages`);

    const updatedMessages = [];
    const errors = [];

    // AI再分析の場合はGeminiを初期化
    let model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null;
    if (action === 'reanalyze') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'GEMINI_API_KEY is not configured' },
          { status: 500 }
        );
      }
      const genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      try {
        let newMessageText: string;
        let newMetadata: Record<string, unknown>;

        if (action === 'add') {
          // 既存の感情タグを削除してから新しいタグを追加
          const cleanMessageText = message.message_text.replace(/^\[.*?\]\s*/, '');
          newMessageText = `[${tagName}] ${cleanMessageText}`;
          newMetadata = {
            ...message.metadata,
            emotionTag: tagName,
            emotionTagUpdatedAt: new Date().toISOString(),
            emotionTagSource: 'bulk_add',
          };
        } else if (action === 'remove') {
          // 感情タグを削除
          newMessageText = message.message_text.replace(/^\[.*?\]\s*/, '');
          const { emotionTag, emotionTagReason, emotionTagUpdatedAt, emotionTagSource, ...restMetadata } = (message.metadata || {}) as Record<string, unknown>;
          newMetadata = restMetadata;
        } else {
          // reanalyze: AIで感情タグを再分析
          if (!model) {
            throw new Error('Gemini model not initialized');
          }

          const cleanMessageText = message.message_text.replace(/^\[.*?\]\s*/, '');

          // 前のメッセージをコンテキストとして提供（最大3件）
          const previousMessages = i > 0
            ? messages.slice(Math.max(0, i - 3), i).map(m => ({
                speaker: m.speaker_name,
                message: m.message_text.replace(/^\[.*?\]\s*/, '')
              }))
            : [];

          // AIプロンプトを構築
          const prompt = await buildEmotionTagReanalysisPrompt(
            cleanMessageText,
            message.speaker_name,
            {
              previousMessages,
              situation: conversation.description || undefined,
            }
          );

          // Gemini AIで感情タグを再分析
          const result = await model.generateContent(prompt);
          const aiResponse = result.response.text();
          const { emotionTag, reason } = await parseEmotionTagReanalysisResponse(aiResponse);

          console.log(`[Bulk Reanalyze] Message ${i + 1}/${messages.length}: ${emotionTag}`);

          newMessageText = `[${emotionTag}] ${cleanMessageText}`;
          newMetadata = {
            ...message.metadata,
            emotionTag: emotionTag,
            emotionTagReason: reason,
            emotionTagUpdatedAt: new Date().toISOString(),
            emotionTagSource: 'bulk_reanalyze',
          };

          // APIレート制限を避けるため、少し待機
          if (i < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // メッセージが変更されていない場合はスキップ
        if (newMessageText === message.message_text && action !== 'reanalyze') {
          updatedMessages.push(message);
          continue;
        }

        const { data: updatedMessage, error: updateError } = await supabase
          .from('conversation_messages')
          .update({
            message_text: newMessageText,
            metadata: newMetadata,
          })
          .eq('id', message.id)
          .select(`
            *,
            character:character_sheets(id, name, image_url)
          `)
          .single();

        if (updateError || !updatedMessage) {
          console.error(`[Bulk Update Tags] Failed to update message ${message.id}:`, updateError);
          errors.push({
            messageId: message.id,
            error: updateError?.message || 'Update failed',
          });
        } else {
          updatedMessages.push(updatedMessage);
        }
      } catch (error) {
        console.error(`[Bulk Update Tags] Error processing message ${message.id}:`, error);
        errors.push({
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        tagName: action === 'add' ? tagName : null,
        updatedCount: updatedMessages.length,
        totalCount: messages.length,
        messages: updatedMessages,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[Bulk Update Tags] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bulk update tags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
