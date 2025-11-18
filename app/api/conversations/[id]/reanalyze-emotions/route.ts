import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildEmotionTagReanalysisPrompt,
  parseEmotionTagReanalysisResponse,
} from '@/lib/conversation/prompt-builder';

/**
 * POST /api/conversations/[id]/reanalyze-emotions
 * 会話全体の感情タグを一括再分析して更新
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const conversationId = parseInt(id);

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

    // Gemini AI初期化
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    console.log(`[Reanalyze Emotions] Analyzing ${messages.length} messages for conversation ${conversationId}`);

    const updatedMessages = [];
    const errors = [];

    // 各メッセージを順次分析
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      try {
        // メッセージテキストから既存の感情タグを削除
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

        console.log(`[Reanalyze Emotions] Message ${i + 1}/${messages.length}: ${emotionTag}`);

        // メッセージを更新
        const newMessageText = `[${emotionTag}] ${cleanMessageText}`;

        const { data: updatedMessage, error: updateError } = await supabase
          .from('conversation_messages')
          .update({
            message_text: newMessageText,
            metadata: {
              ...message.metadata,
              emotionTag: emotionTag,
              emotionTagReason: reason,
              emotionTagUpdatedAt: new Date().toISOString(),
            }
          })
          .eq('id', message.id)
          .select(`
            *,
            character:character_sheets(id, name, image_url)
          `)
          .single();

        if (updateError || !updatedMessage) {
          console.error(`[Reanalyze Emotions] Failed to update message ${message.id}:`, updateError);
          errors.push({
            messageId: message.id,
            error: updateError?.message || 'Update failed'
          });
        } else {
          updatedMessages.push(updatedMessage);
        }

        // APIレート制限を避けるため、少し待機
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[Reanalyze Emotions] Error processing message ${message.id}:`, error);
        errors.push({
          messageId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updatedMessages.length,
        totalCount: messages.length,
        messages: updatedMessages,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('[Reanalyze Emotions] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reanalyze emotion tags',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
