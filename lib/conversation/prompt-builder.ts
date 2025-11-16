import type {
  ConversationPromptInput,
  ConversationGenerationAIResponse,
  GeneratedMessage
} from '@/types/conversation';
import { getAllElevenLabsTags, getAllCameraAngles, getAllShotDistances } from '@/lib/db';

/**
 * Build a conversation generation prompt for the AI model
 * Fetches the latest emotion tags from database
 */
export async function buildConversationPrompt(input: ConversationPromptInput): Promise<string> {
  // Fetch latest emotion tags from database
  const emotionTags = await getAllElevenLabsTags();
  const charactersSection = input.characters
    .map(
      (char, idx) => `
### キャラクター${idx + 1}: ${char.name}
- 説明: ${char.description}
- 性格: ${char.personality}
- 話し方: ${char.speakingStyle}
- セリフ例: ${char.sampleDialogues.map((d) => `"${d.line}"`).join(', ')}
`
    )
    .join('\n');

  const previousMessagesSection =
    input.previousMessages && input.previousMessages.length > 0
      ? `
## これまでの会話
${input.previousMessages.map((m) => `${m.speaker}: ${m.message}`).join('\n')}
`
      : '';

  const toneDescription = {
    casual: 'カジュアルで親しみやすい',
    formal: '丁寧でフォーマル',
    dramatic: 'ドラマチックで感情的',
    humorous: 'ユーモラスで面白い'
  }[input.tone || 'casual'];

  // Build emotion tags section from database
  const emotionTagsSection = emotionTags && emotionTags.length > 0
    ? emotionTags.map(tag => `  - ${tag.name}: ${tag.description || tag.description_ja || ''}`).join('\n')
    : `  - emotional: 感情を込めた音声（感動的なシーンや重要な告白など）
  - calm: 落ち着いた優しい音声（穏やかな会話や慰めのシーンなど）
  - energetic: 元気で活気のある音声（楽しい会話や興奮しているシーンなど）
  - professional: ビジネス的で正式な音声（真面目な会話や報告など）
  - friendly: 親しみやすい音声（カジュアルな友人との会話など）
  - serious: 真剣で権威のある音声（重要な決断や厳粛なシーンなど）`;

  return `
あなたはキャラクター間の自然な会話を生成するAIです。
以下の情報に基づいて、キャラクターらしい会話を生成してください。

## キャラクター情報
${charactersSection}

## 会話設定
- シチュエーション: ${input.situation}
- 会話の雰囲気: ${toneDescription}
- 生成するメッセージ数: ${input.messageCount}
${previousMessagesSection}

## 出力形式
以下のJSON形式で会話を生成してください。各キャラクターの性格と話し方を必ず反映させてください。

\`\`\`json
{
  "messages": [
    {
      "speaker": "キャラクター名",
      "message": "セリフ内容",
      "emotion": "happy|sad|angry|neutral|surprised|excited|confused",
      "emotionTag": "感情を表すタグ（下記の利用可能な感情タグから1つ選択）",
      "scene": "このメッセージが発せられた具体的な場面の描写（キャラクターの表情、動作、周囲の状況など）",
      "scenePromptJa": "シーンを画像生成するための日本語プロンプト（100-150文字程度、視覚的な要素を詳細に描写）",
      "scenePromptEn": "シーンを画像生成するための英語プロンプト（Stable Diffusion/DALL-E形式、high quality, detailed, anime styleなどの品質タグを含む）"
    }
  ]
}
\`\`\`

## 重要な注意事項
- 各キャラクターの性格と話し方の特徴を必ず反映してください
- speakerフィールドには必ずキャラクター名のいずれかを使用してください
- 自然な会話の流れを作ってください
- 感情(emotion)は会話の文脈に合わせて適切に設定してください
- **emotionTag（感情タグ）は、メッセージの音声化に使用されます。以下の利用可能な感情タグから適切なものを選んでください：**
${emotionTagsSection}
- **scene（場面）フィールドには、そのメッセージが発せられた時の具体的な場面を描写してください**
  - キャラクターの表情や仕草（笑顔、驚いた顔、俯く、手を振る、など）
  - 体の動き（近づく、振り向く、立ち上がる、など）
  - 周囲の状況や雰囲気（静かな図書室、夕日が差し込む教室、など）
  - 視覚的にイメージできる具体的な描写を心がけてください
- **scenePromptJa（日本語シーンプロンプト）には、このメッセージのシーンを画像生成するための日本語プロンプトを記述してください**
  - 100-150文字程度で、場所、時間帯、キャラクターの配置、表情、周囲の雰囲気などを含める
  - 視覚的な要素を詳細に描写する
  - 例: 「夕暮れ時の学校の屋上。主人公が柵に寄りかかり、遠くを見つめている。オレンジ色の空が背景に広がり、穏やかな風が吹いている。」
- **scenePromptEn（英語シーンプロンプト）には、画像生成AIに渡す英語プロンプトを記述してください**
  - Stable Diffusion/DALL-E形式で、high quality, detailed, anime styleなどの品質タグを含める
  - シーンの視覚的な要素を英語で具体的に記述
  - 例: "rooftop scene at sunset, male student leaning on fence, looking into distance, orange sky background, gentle breeze, anime style, high quality, detailed, cinematic lighting"
- メッセージ数は正確に${input.messageCount}個生成してください

自然で魅力的な会話を生成してください。
`.trim();
}

/**
 * Parse AI response to extract conversation messages
 */
export async function parseAIResponse(
  aiResponse: string
): Promise<ConversationGenerationAIResponse> {
  // Try to extract JSON block from markdown code fence
  const jsonMatch = aiResponse.match(/```json\s*\n([\s\S]*?)\n```/);

  let jsonText: string;
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    // Try to find JSON without code fence
    const directJsonMatch = aiResponse.match(/\{[\s\S]*"messages"[\s\S]*\}/);
    if (directJsonMatch) {
      jsonText = directJsonMatch[0];
    } else {
      throw new Error('AI response does not contain valid JSON');
    }
  }

  try {
    const parsed = JSON.parse(jsonText);

    // Validate response structure
    if (!parsed.messages || !Array.isArray(parsed.messages)) {
      throw new Error('Invalid response format: missing messages array');
    }

    // Validate each message
    for (const msg of parsed.messages) {
      if (!msg.speaker || typeof msg.speaker !== 'string') {
        throw new Error('Invalid message: missing or invalid speaker');
      }
      if (!msg.message || typeof msg.message !== 'string') {
        throw new Error('Invalid message: missing or invalid message text');
      }
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('AI Response:', aiResponse);
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate character names in generated messages
 */
export function validateMessageSpeakers(
  messages: GeneratedMessage[],
  validCharacterNames: string[]
): { valid: boolean; invalidSpeakers: string[] } {
  const invalidSpeakers: string[] = [];

  for (const msg of messages) {
    if (!validCharacterNames.includes(msg.speaker)) {
      if (!invalidSpeakers.includes(msg.speaker)) {
        invalidSpeakers.push(msg.speaker);
      }
    }
  }

  return {
    valid: invalidSpeakers.length === 0,
    invalidSpeakers
  };
}

/**
 * Build a scene image generation prompt based on the conversation
 * Fetches the latest camera angles and shot distances from database
 */
export async function buildScenePrompt(
  situation: string,
  characters: Array<{ name: string; description: string }>,
  messages: GeneratedMessage[]
): Promise<string> {
  // Fetch latest camera angles and shot distances from database
  const cameraAngles = await getAllCameraAngles();
  const shotDistances = await getAllShotDistances();

  const charactersSection = characters
    .map((char) => `- ${char.name}: ${char.description}`)
    .join('\n');

  const conversationSummary = messages
    .slice(0, 5) // Take first 5 messages for context
    .map((m) => `${m.speaker}: ${m.message}`)
    .join('\n');

  const cameraAnglesSection = cameraAngles && cameraAngles.length > 0
    ? `\n## 利用可能なカメラアングル\n${cameraAngles.map(a => `- ${a.name}: ${a.description}`).join('\n')}`
    : '';

  const shotDistancesSection = shotDistances && shotDistances.length > 0
    ? `\n## 利用可能なショット距離\n${shotDistances.map(s => `- ${s.name}: ${s.description}`).join('\n')}`
    : '';

  return `
あなたは会話シーンのビジュアル描写とイラスト生成プロンプトを作成するAIです。
以下の会話情報に基づいて、シーンの詳細な描写とイラスト生成用のプロンプトを作成してください。

## シチュエーション
${situation}

## 登場キャラクター
${charactersSection}

## 会話の始まり
${conversationSummary}
${cameraAnglesSection}
${shotDistancesSection}

## 出力形式
以下のJSON形式で出力してください：

\`\`\`json
{
  "sceneDescription": "シーンの詳細な視覚的描写（200文字程度）",
  "imagePrompt": "イラスト生成用の英語プロンプト（Stable Diffusion/DALL-E形式）",
  "cameraAngle": "選択したカメラアングル名（上記リストから1つ選択）",
  "shotDistance": "選択したショット距離名（上記リストから1つ選択）"
}
\`\`\`

## 要件
- sceneDescription: 日本語で、場所、時間帯、雰囲気、キャラクターの位置関係などを含む詳細な描写
- imagePrompt: 英語で、high quality, detailed, anime style などの品質タグを含む具体的なプロンプト
  - **選択したカメラアングルとショット距離を必ずプロンプトに含めてください**（例: "from low angle, medium close-up shot"）
- cameraAngle: 会話の内容や雰囲気に最も適したカメラアングルを選択してください
- shotDistance: シーンの雰囲気や強調したい要素に応じて適切なショット距離を選択してください
- キャラクターの外見や特徴を反映させてください
- 会話の雰囲気に合った視覚的な描写を心がけてください
`.trim();
}

/**
 * Parse AI response for scene prompt generation
 */
export async function parseScenePromptResponse(
  aiResponse: string
): Promise<{
  sceneDescription: string;
  imagePrompt: string;
  cameraAngle?: string;
  shotDistance?: string;
}> {
  // Try to extract JSON block from markdown code fence
  const jsonMatch = aiResponse.match(/```json\s*\n([\s\S]*?)\n```/);

  let jsonText: string;
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    // Try to find JSON without code fence
    const directJsonMatch = aiResponse.match(/\{[\s\S]*"sceneDescription"[\s\S]*\}/);
    if (directJsonMatch) {
      jsonText = directJsonMatch[0];
    } else {
      throw new Error('AI response does not contain valid JSON for scene prompt');
    }
  }

  try {
    const parsed = JSON.parse(jsonText);

    // Validate response structure
    if (!parsed.sceneDescription || typeof parsed.sceneDescription !== 'string') {
      throw new Error('Invalid response format: missing or invalid sceneDescription');
    }
    if (!parsed.imagePrompt || typeof parsed.imagePrompt !== 'string') {
      throw new Error('Invalid response format: missing or invalid imagePrompt');
    }

    return {
      sceneDescription: parsed.sceneDescription,
      imagePrompt: parsed.imagePrompt,
      cameraAngle: parsed.cameraAngle,
      shotDistance: parsed.shotDistance
    };
  } catch (error) {
    console.error('Failed to parse scene prompt response:', error);
    console.error('AI Response:', aiResponse);
    throw new Error(`Failed to parse scene prompt response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
