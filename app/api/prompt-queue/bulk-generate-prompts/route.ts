import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { query } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODEL_OPTIONS } from '@/lib/gemini/constants';

interface QueueGenerateRequest {
  queueId: number;
  images: { mimeType: string; data: string }[];
}

interface BulkGeneratePromptsRequest {
  queues: QueueGenerateRequest[];
  model?: string; // Gemini model for prompt generation (default: gemini-2.5-flash)
  language?: 'ja' | 'en'; // Output language (default: en)
  basePrompt?: string; // Additional instructions for prompt generation
}

/**
 * POST /api/prompt-queue/bulk-generate-prompts
 * 複数のプロンプトキューの参照画像からプロンプトを一括生成する
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as BulkGeneratePromptsRequest;
    const { queues, model = 'gemini-2.5-flash', language = 'en', basePrompt = '' } = body;

    if (!queues || !Array.isArray(queues) || queues.length === 0) {
      return NextResponse.json({ error: 'queues is required and must be a non-empty array' }, { status: 400 });
    }

    // モデル名のバリデーション
    const validModels = GEMINI_MODEL_OPTIONS.map((m) => m.value);
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model. Valid options: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({ model });

    const results: { queueId: number; prompt?: string; error?: string }[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 言語に応じたシステムプロンプトを生成
    const buildSystemPrompt = (lang: 'ja' | 'en', additionalPrompt: string) => {
      const baseInstructions = additionalPrompt ? `\n\n追加の指示:\n${additionalPrompt}` : '';

      if (lang === 'ja') {
        return `あなたは画像生成AIのプロンプト作成専門家です。
提供された参照画像を分析し、その画像を再現するための詳細なプロンプトを日本語で作成してください。

以下のガイドラインに従ってください：
1. 画像の主要な要素（人物、オブジェクト、背景、構図）を詳細に記述する
2. 色彩、照明、雰囲気、スタイルを具体的に記述する
3. カメラアングル、視点、被写体の配置を明確にする
4. 画像生成に効果的なキーワードを適切に含める
5. 出力はプロンプトのみを返す（説明や解説は不要）
6. プロンプトは1つの段落にまとめ、読点で区切る${baseInstructions}

参照画像を分析して、画像生成用の日本語プロンプトを出力してください:`;
      } else {
        return `You are an expert at creating prompts for image generation AI.
Analyze the provided reference image(s) and create a detailed prompt in English to reproduce that image.

Follow these guidelines:
1. Describe the main elements in detail (characters, objects, background, composition)
2. Specify colors, lighting, atmosphere, and style
3. Clearly describe camera angle, viewpoint, and subject placement
4. Include effective keywords for image generation (lighting, composition, style, quality, etc.)
5. Return only the prompt (no explanations or commentary)
6. Combine the prompt into one paragraph, separated by commas${additionalPrompt ? `\n\nAdditional instructions:\n${additionalPrompt}` : ''}

Analyze the reference image(s) and output an English prompt for image generation:`;
      }
    };

    // 各キューを順次処理（レート制限を考慮して500ms間隔）
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

        // 画像がない場合はスキップ
        if (!queueRequest.images || queueRequest.images.length === 0) {
          results.push({ queueId: queueRequest.queueId, error: 'No images provided for this queue' });
          failedCount++;
          continue;
        }

        const systemPrompt = buildSystemPrompt(language, basePrompt);

        // マルチモーダルリクエスト
        console.log(`Queue ${queueRequest.queueId}: Generating prompt from ${queueRequest.images.length} image(s) using ${model} in ${language}`);
        const parts: any[] = [{ text: systemPrompt }];

        // 参照画像を追加（最大4枚）
        queueRequest.images.slice(0, 4).forEach((img) => {
          parts.push({
            inline_data: {
              mime_type: img.mimeType,
              data: img.data,
            },
          });
        });

        const result = await generativeModel.generateContent({ contents: [{ role: 'user', parts }] });
        const generatedPrompt = result.response.text().trim();
        console.log(`Queue ${queueRequest.queueId}: Generated prompt: ${generatedPrompt.substring(0, 150)}...`);

        // データベースを更新（enhanced_prompt に保存、enhance_prompt を 'enhance' に設定）
        await query(
          `UPDATE kazikastudio.prompt_queues
           SET enhanced_prompt = $1, enhance_prompt = 'enhance', updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [generatedPrompt, queueRequest.queueId, user.id]
        );

        results.push({ queueId: queueRequest.queueId, prompt: generatedPrompt });
        successCount++;

        // レート制限対策: 各リクエスト間に少し待機
        if (queues.indexOf(queueRequest) < queues.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`Failed to generate prompt for queue ${queueRequest.queueId}:`, error);
        results.push({ queueId: queueRequest.queueId, error: error.message });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      model,
      language,
      results,
    });
  } catch (error: any) {
    console.error('Failed to bulk generate prompts:', error);
    return NextResponse.json(
      { error: 'Failed to bulk generate prompts', details: error.message },
      { status: 500 }
    );
  }
}
