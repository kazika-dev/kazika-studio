import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildEmotionTagReanalysisPrompt,
  parseEmotionTagReanalysisResponse,
} from '@/lib/conversation/prompt-builder';

/**
 * POST /api/conversations/messages/[id]/reanalyze-emotion
 * メッセージ内容から感情タグを再分析して更新
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
    const messageId = parseInt(id);

    // メッセージを取得
    const { data: message, error: messageError } = await supabase
      .from('conversation_messages')
      .select(`
        *,
        conversation:conversations(
          id,
          description,
          studio_id,
          story_scene_id
        )
      `)
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // 所有権チェック（会話経由）
    const conversation = Array.isArray(message.conversation)
      ? message.conversation[0]
      : message.conversation;

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // studioまたはstoryの所有権チェック
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

    // 前後のメッセージを取得（コンテキスト用）
    const { data: contextMessages } = await supabase
      .from('conversation_messages')
      .select('speaker_name, message_text, sequence_order')
      .eq('conversation_id', conversation.id)
      .order('sequence_order', { ascending: true });

    const currentMessageIndex = contextMessages?.findIndex(m => m.sequence_order === message.sequence_order) ?? -1;
    const previousMessages = currentMessageIndex > 0 && contextMessages
      ? contextMessages.slice(Math.max(0, currentMessageIndex - 3), currentMessageIndex).map(m => ({
          speaker: m.speaker_name,
          message: m.message_text.replace(/^\[.*?\]\s*/, '') // 既存のタグを削除
        }))
      : [];

    // メッセージテキストから既存の感情タグを削除
    const cleanMessageText = message.message_text.replace(/^\[.*?\]\s*/, '');

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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    console.log('[Reanalyze Emotion] Analyzing message:', messageId);
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // AIレスポンスをパース
    const { emotionTag, reason } = await parseEmotionTagReanalysisResponse(aiResponse);

    console.log('[Reanalyze Emotion] Selected emotion tag:', emotionTag, '- Reason:', reason);

    // メッセージを更新（感情タグプレフィックスを追加）
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
      .eq('id', messageId)
      .select(`
        *,
        character:character_sheets(id, name, image_url)
      `)
      .single();

    if (updateError || !updatedMessage) {
      console.error('[Reanalyze Emotion] Failed to update message:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: updatedMessage,
        emotionTag,
        reason,
      },
    });
  } catch (error) {
    console.error('[Reanalyze Emotion] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reanalyze emotion tag',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
