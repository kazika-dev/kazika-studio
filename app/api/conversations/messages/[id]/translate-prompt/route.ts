import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';

// Gemini APIを初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

/**
 * POST /api/conversations/messages/[id]/translate-prompt
 * 日本語のシーンプロンプトを英語に翻訳する
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const messageId = parseInt(resolvedParams.id);

    if (isNaN(messageId)) {
      return NextResponse.json(
        { error: 'Invalid message ID' },
        { status: 400 }
      );
    }

    const { japanesePrompt } = await request.json();

    if (!japanesePrompt || typeof japanesePrompt !== 'string') {
      return NextResponse.json(
        { error: 'Japanese prompt is required' },
        { status: 400 }
      );
    }

    // メッセージの所有権チェック
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // メッセージと会話情報を取得
    const { data: message, error: msgError } = await supabase
      .from('conversation_messages')
      .select(`
        id,
        conversation_id,
        conversation:conversations(
          id,
          studio_id,
          story_scene_id,
          studio:studios(user_id),
          story_scene:story_scenes(
            id,
            story:stories(user_id)
          )
        )
      `)
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // 所有権チェック
    let isOwner = false;
    if (message.conversation.studio_id && message.conversation.studio) {
      isOwner = message.conversation.studio.user_id === user.id;
    } else if (message.conversation.story_scene_id && message.conversation.story_scene) {
      isOwner = message.conversation.story_scene.story.user_id === user.id;
    }

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Unauthorized: Message does not belong to user' },
        { status: 403 }
      );
    }

    // Gemini APIを使って翻訳
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `
あなたはプロの翻訳者です。以下の日本語のシーンプロンプトを、画像生成AIに最適な英語プロンプトに翻訳してください。

要件:
- Stable Diffusion/DALL-E形式に最適化する
- 品質タグ（high quality, detailed, anime style など）を含める
- カンマ区切りのキーワード形式にする
- 具体的で明確な描写にする
- 日本語の雰囲気やニュアンスを英語で表現する

日本語プロンプト:
${japanesePrompt}

英語プロンプト（翻訳のみを出力してください。説明文は不要です）:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const englishPrompt = response.text().trim();

    return NextResponse.json({
      success: true,
      data: {
        japanesePrompt,
        englishPrompt
      }
    });

  } catch (error) {
    console.error('[translate-prompt] Error:', error);
    return NextResponse.json(
      {
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
