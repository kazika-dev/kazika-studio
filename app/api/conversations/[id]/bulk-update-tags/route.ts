import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';

/**
 * POST /api/conversations/[id]/bulk-update-tags
 * 会話全体の感情タグを一括追加または削除
 *
 * Body:
 *   action: 'add' | 'remove'
 *   tagName?: string (action === 'add' の場合に必須)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const conversationId = parseInt(id);

    const body = await request.json();
    const { action, tagName } = body;

    if (!action || !['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "add" or "remove"' },
        { status: 400 }
      );
    }

    if (action === 'add' && !tagName) {
      return NextResponse.json(
        { success: false, error: 'tagName is required for add action' },
        { status: 400 }
      );
    }

    // 会話を取得
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, description, studio_id, story_scene_id')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // 所有権チェック
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

    // 全メッセージを取得
    const { data: messages, error: messagesError } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sequence_order', { ascending: true });

    if (messagesError || !messages || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages found' },
        { status: 404 }
      );
    }

    console.log(`[Bulk Update Tags] ${action} tags for ${messages.length} messages in conversation ${conversationId}`);

    const updatedMessages = [];
    const errors = [];

    for (const message of messages) {
      try {
        let newMessageText: string;
        let newMetadata: object;

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
        } else {
          // 感情タグを削除
          newMessageText = message.message_text.replace(/^\[.*?\]\s*/, '');
          const { emotionTag, emotionTagReason, emotionTagUpdatedAt, emotionTagSource, ...restMetadata } = message.metadata || {};
          newMetadata = restMetadata;
        }

        // メッセージが変更されていない場合はスキップ
        if (newMessageText === message.message_text) {
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
