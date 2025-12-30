import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { query } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface QueueEnhanceRequest {
  queueId: number;
  prompt: string;
  images: { mimeType: string; data: string }[];
}

/**
 * POST /api/prompt-queue/bulk-enhance
 * 複数のプロンプトキューを一括でGemini補完する
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { queues } = body as { queues: QueueEnhanceRequest[] };

    if (!queues || !Array.isArray(queues) || queues.length === 0) {
      return NextResponse.json({ error: 'queues is required and must be a non-empty array' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const results: { queueId: number; enhanced_prompt?: string; error?: string }[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 各キューを順次処理（レート制限を考慮して1秒間隔）
    for (const queueRequest of queues) {
      try {
        // キューの所有権チェック
        const ownerCheck = await query(
          `SELECT id FROM kazikastudio.prompt_queues WHERE id = $1 AND user_id = $2`,
          [queueRequest.queueId, user.id]
        );

        if (ownerCheck.rowCount === 0) {
          results.push({ queueId: queueRequest.queueId, error: 'Not found or not authorized' });
          failedCount++;
          continue;
        }

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

入力プロンプト: ${queueRequest.prompt}

最適化された英語プロンプトを出力してください:`;

        // 画像がある場合はマルチモーダルリクエスト
        let result;
        if (queueRequest.images && queueRequest.images.length > 0) {
          console.log(`Queue ${queueRequest.queueId}: Enhancing with ${queueRequest.images.length} image(s)`);
          const parts: any[] = [{ text: enhanceSystemPrompt }];

          // 参照画像を追加（最大4枚）
          queueRequest.images.slice(0, 4).forEach((img) => {
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
        console.log(`Queue ${queueRequest.queueId}: Enhanced prompt: ${enhancedPrompt.substring(0, 150)}...`);

        // データベースを更新
        await query(
          `UPDATE kazikastudio.prompt_queues
           SET enhanced_prompt = $1, enhance_prompt = 'enhance', updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [enhancedPrompt, queueRequest.queueId, user.id]
        );

        results.push({ queueId: queueRequest.queueId, enhanced_prompt: enhancedPrompt });
        successCount++;

        // レート制限対策: 各リクエスト間に少し待機
        if (queues.indexOf(queueRequest) < queues.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`Failed to enhance queue ${queueRequest.queueId}:`, error);
        results.push({ queueId: queueRequest.queueId, error: error.message });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error('Failed to bulk enhance prompts:', error);
    return NextResponse.json(
      { error: 'Failed to bulk enhance prompts', details: error.message },
      { status: 500 }
    );
  }
}
