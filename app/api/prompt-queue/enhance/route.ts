import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * POST /api/prompt-queue/enhance
 * プロンプトをGeminiで英語に補完する
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, negative_prompt, images } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    // プロンプト補完用のシステムプロンプト
    const enhanceSystemPrompt = `あなたは画像生成AIのプロンプトを最適化する専門家です。
ユーザーの入力プロンプト（日本語または英語）を、高品質な画像生成に最適な英語プロンプトに変換してください。

画像の構図をしっかり表現してください。再現できるようにプロンプトを作成してください。

以下のガイドラインに従ってください：
1. 入力プロンプトの意図を理解し、詳細な描写を追加する
2. 画像生成に効果的なキーワード（lighting, composition, style, qualityなど）を適切に追加する
3. 参照画像がある場合は、その内容（キャラクター、スタイル、構図など）を考慮してプロンプトを調整する
4. 出力は英語のプロンプトのみを返す（説明や解説は不要）
5. プロンプトは1つの段落にまとめ、カンマで区切る
6. ネガティブプロンプトは含めない
7. 構図（カメラアングル、被写体の配置、視点など）を具体的に記述する

入力プロンプト: ${prompt}
${negative_prompt ? `ネガティブプロンプト（参考）: ${negative_prompt}` : ''}

最適化された英語プロンプトを出力してください:`;

    // 画像がある場合はマルチモーダルリクエスト
    let result;
    if (images && images.length > 0) {
      console.log(`Enhancing prompt with ${images.length} reference image(s)`);
      const parts: any[] = [{ text: enhanceSystemPrompt }];

      // 参照画像を追加（最大4枚）
      images.slice(0, 4).forEach((img: { mimeType: string; data: string }) => {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.data,
          },
        });
      });

      result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    } else {
      result = await model.generateContent(enhanceSystemPrompt);
    }

    const rawEnhancedPrompt = result.response.text().trim();
    // キャラクターシートに忠実に描画するよう指示を先頭に追加
    const characterSheetInstruction = 'Please make sure that the hairstyle, clothing, and accessories of the character appearing in the image you create exactly match the attached character sheet.';
    const enhancedPrompt = `${characterSheetInstruction} ${rawEnhancedPrompt}`;
    console.log(`Enhanced prompt: ${enhancedPrompt}`);

    return NextResponse.json({
      success: true,
      enhanced_prompt: enhancedPrompt,
      original_prompt: prompt,
    });
  } catch (error: any) {
    console.error('Failed to enhance prompt:', error);
    return NextResponse.json(
      { error: 'Failed to enhance prompt', details: error.message },
      { status: 500 }
    );
  }
}
