import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/apiAuth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createPromptQueue } from '@/lib/db';
import type { PromptQueueImageType } from '@/types/prompt-queue';

/**
 * 一括プロンプト生成リクエストの型
 */
interface BulkGenerateRequest {
  // 生成の元となるテーマ/指示
  theme: string;
  // 生成するプロンプトの数
  count: number;
  // 出力言語 ('ja' = 日本語, 'en' = 英語)
  language: 'ja' | 'en';
  // 使用するAIモデル
  model: string;
  // 画像生成モデル（キューに設定する）
  imageModel?: string;
  // アスペクト比
  aspectRatio?: string;
  // ネガティブプロンプト（共通）
  negativePrompt?: string;
  // 参照画像（共通で適用）
  images?: {
    image_type: PromptQueueImageType;
    reference_id: number;
  }[];
}

/**
 * POST /api/prompt-queue/bulk-generate
 * テーマに基づいて複数のプロンプトを一括生成し、キューに登録する
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BulkGenerateRequest = await request.json();
    const {
      theme,
      count,
      language,
      model,
      imageModel = 'gemini-2.5-flash-image',
      aspectRatio = '16:9',
      negativePrompt,
      images,
    } = body;

    // バリデーション
    if (!theme || theme.trim() === '') {
      return NextResponse.json({ error: 'theme is required' }, { status: 400 });
    }

    if (!count || count < 1 || count > 50) {
      return NextResponse.json(
        { error: 'count must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (!language || !['ja', 'en'].includes(language)) {
      return NextResponse.json(
        { error: 'language must be "ja" or "en"' },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    // 画像のバリデーション
    if (images && images.length > 8) {
      return NextResponse.json(
        { error: 'Maximum 8 images allowed' },
        { status: 400 }
      );
    }

    if (images) {
      const validImageTypes = ['character_sheet', 'output', 'scene', 'prop'];
      for (const img of images) {
        if (!validImageTypes.includes(img.image_type)) {
          return NextResponse.json(
            { error: `Invalid image_type: ${img.image_type}` },
            { status: 400 }
          );
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    // プロンプト生成用のシステムプロンプト
    const systemPrompt = buildBulkGeneratePrompt(theme, count, language);

    console.log(`Generating ${count} prompts with model: ${model}, language: ${language}`);
    console.log('Theme:', theme);

    const result = await genModel.generateContent(systemPrompt);
    const responseText = result.response.text().trim();

    // JSONをパース
    const prompts = parseGeneratedPrompts(responseText, count);

    if (prompts.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate prompts', details: 'No valid prompts were generated' },
        { status: 500 }
      );
    }

    console.log(`Successfully generated ${prompts.length} prompts`);

    // 各プロンプトをキューに登録
    const createdQueues = [];
    const errors = [];

    for (let i = 0; i < prompts.length; i++) {
      const promptData = prompts[i];
      try {
        const queue = await createPromptQueue(user.id, {
          name: promptData.name || `${theme.slice(0, 20)}... #${i + 1}`,
          prompt: promptData.prompt,
          negative_prompt: negativePrompt || promptData.negativePrompt,
          model: imageModel,
          aspect_ratio: aspectRatio,
          priority: 0,
          enhance_prompt: 'none', // 既に最適化されているので補完は不要
          metadata: {
            bulkGenerated: true,
            theme,
            generatedAt: new Date().toISOString(),
            generationModel: model,
            language,
          },
          images,
        });
        createdQueues.push(queue);
      } catch (err: any) {
        console.error(`Failed to create queue for prompt ${i + 1}:`, err);
        errors.push({ index: i, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      generated: prompts.length,
      created: createdQueues.length,
      failed: errors.length,
      queues: createdQueues,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Failed to bulk generate prompts:', error);
    return NextResponse.json(
      { error: 'Failed to bulk generate prompts', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 一括プロンプト生成用のシステムプロンプトを構築
 */
function buildBulkGeneratePrompt(theme: string, count: number, language: 'ja' | 'en'): string {
  const languageInstruction = language === 'ja'
    ? '日本語でプロンプトを生成してください。'
    : 'Generate prompts in English.';

  const exampleFormat = language === 'ja'
    ? `{
  "prompts": [
    {
      "name": "シーン1: 朝の風景",
      "prompt": "朝日が差し込む静かな森の中、木漏れ日が地面に模様を描いている。霧が薄くかかり、幻想的な雰囲気。高品質、詳細な描写、アニメスタイル"
    },
    {
      "name": "シーン2: 夕暮れの街",
      "prompt": "夕焼けに染まる街並み、オレンジと紫のグラデーション空、シルエットになる建物、ノスタルジックな雰囲気、映画的な照明"
    }
  ]
}`
    : `{
  "prompts": [
    {
      "name": "Scene 1: Morning Landscape",
      "prompt": "quiet forest with morning sunlight streaming through, dappled light patterns on the ground, light mist, ethereal atmosphere, high quality, detailed, anime style"
    },
    {
      "name": "Scene 2: Twilight City",
      "prompt": "cityscape at sunset, orange and purple gradient sky, silhouetted buildings, nostalgic atmosphere, cinematic lighting, high quality"
    }
  ]
}`;

  return `あなたは画像生成AIのプロンプトを作成する専門家です。
与えられたテーマに基づいて、${count}個の多様で高品質な画像生成プロンプトを作成してください。

${languageInstruction}

【重要なガイドライン】
1. 各プロンプトは具体的で詳細な描写を含むこと
2. 構図、照明、雰囲気、スタイルを明確に記述すること
3. 各プロンプトは互いに異なるシーン/状況を描写すること
4. 画像生成に効果的なキーワードを含めること
5. プロンプトは1つの段落にまとめ、読点またはカンマで区切ること

【テーマ】
${theme}

【出力形式】
必ず以下のJSON形式で出力してください。他のテキストは含めないでください。
${exampleFormat}

${count}個のプロンプトを生成してください:`;
}

/**
 * 生成されたテキストからプロンプトをパース
 */
function parseGeneratedPrompts(
  responseText: string,
  expectedCount: number
): Array<{ name: string; prompt: string; negativePrompt?: string }> {
  try {
    // JSONブロックを抽出（マークダウンのコードブロック対応）
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // 先頭と末尾の余分な文字を除去
    jsonText = jsonText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');

    const parsed = JSON.parse(jsonText);

    if (parsed.prompts && Array.isArray(parsed.prompts)) {
      return parsed.prompts
        .filter((p: any) => p.prompt && typeof p.prompt === 'string')
        .map((p: any) => ({
          name: p.name || '',
          prompt: p.prompt.trim(),
          negativePrompt: p.negativePrompt || p.negative_prompt,
        }));
    }

    // 配列形式の場合
    if (Array.isArray(parsed)) {
      return parsed
        .filter((p: any) => p.prompt && typeof p.prompt === 'string')
        .map((p: any) => ({
          name: p.name || '',
          prompt: p.prompt.trim(),
          negativePrompt: p.negativePrompt || p.negative_prompt,
        }));
    }

    console.error('Unexpected response format:', parsed);
    return [];
  } catch (err) {
    console.error('Failed to parse prompts JSON:', err);
    console.error('Raw response:', responseText);

    // フォールバック: 行ごとに分割してプロンプトとして扱う
    const lines = responseText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 20 && !line.startsWith('{') && !line.startsWith('['));

    if (lines.length > 0) {
      return lines.slice(0, expectedCount).map((line, i) => ({
        name: `Prompt #${i + 1}`,
        prompt: line,
      }));
    }

    return [];
  }
}
