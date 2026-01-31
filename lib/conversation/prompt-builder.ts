import type {
  ConversationPromptInput,
  ConversationGenerationAIResponse,
  GeneratedMessage
} from '@/types/conversation';
import {
  getAllElevenLabsTags,
  getAllCameraAngles,
  getAllShotDistances,
  getConversationPromptTemplateById,
  getDefaultConversationPromptTemplate
} from '@/lib/db';
import type { ModelProvider } from '@/lib/vertex-ai/constants';

/**
 * Build character section based on model provider
 * Claude prefers XML-style structured data, Gemini uses markdown
 */
function buildCharacterSection(
  characters: ConversationPromptInput['characters'],
  modelProvider: ModelProvider = 'google-genai'
): string {
  if (modelProvider === 'vertex-anthropic') {
    // Claude prefers XML-style structured data
    return characters
      .map(
        (char) => `<character id="${char.id}" name="${char.name}">
  <description>${char.description}</description>
  <personality>${char.personality}</personality>
  <speaking_style>${char.speakingStyle}</speaking_style>
  <sample_dialogues>
${char.sampleDialogues.map((d) => `    <dialogue situation="${d.situation}">${d.line}</dialogue>`).join('\n')}
  </sample_dialogues>
</character>`
      )
      .join('\n\n');
  }

  // Gemini and default: markdown format
  return characters
    .map(
      (char, idx) => `
### キャラクター${idx + 1}: ${char.name} (ID: ${char.id})
- 説明: ${char.description}
- 性格: ${char.personality}
- 話し方: ${char.speakingStyle}
- セリフ例: ${char.sampleDialogues.map((d) => `"${d.line}"`).join(', ')}
`
    )
    .join('\n');
}

/**
 * Build a conversation generation prompt for the AI model using a template
 * Fetches the latest emotion tags from database and applies template variables
 * @param modelProvider - The model provider (affects prompt format for Claude vs Gemini)
 */
export async function buildConversationPrompt(
  input: ConversationPromptInput,
  templateId?: number,
  modelProvider: ModelProvider = 'google-genai'
): Promise<string> {
  // Fetch template (use provided templateId or get default)
  let template;
  if (templateId) {
    template = await getConversationPromptTemplateById(templateId);
    if (!template) {
      console.warn(`Template with ID ${templateId} not found, falling back to default`);
      template = await getDefaultConversationPromptTemplate();
    }
  } else {
    template = await getDefaultConversationPromptTemplate();
  }

  if (!template) {
    throw new Error('No conversation prompt template found');
  }

  // Fetch latest emotion tags from database
  const emotionTags = await getAllElevenLabsTags();

  // Build template variables using model-specific format
  const charactersSection = buildCharacterSection(input.characters, modelProvider);

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

  const characterIdsList = input.characters.map(c => c.id).join(', ');
  const characterNamesList = input.characters.map(c => `"${c.name}"`).join(', ');

  // Replace template variables
  let prompt = template.template_text;
  prompt = prompt.replace(/\{\{charactersSection\}\}/g, charactersSection);
  prompt = prompt.replace(/\{\{situation\}\}/g, input.situation);
  prompt = prompt.replace(/\{\{toneDescription\}\}/g, toneDescription);
  prompt = prompt.replace(/\{\{messageCount\}\}/g, input.messageCount.toString());
  prompt = prompt.replace(/\{\{previousMessagesSection\}\}/g, previousMessagesSection);
  prompt = prompt.replace(/\{\{emotionTagsSection\}\}/g, emotionTagsSection);
  prompt = prompt.replace(/\{\{characterIdsList\}\}/g, characterIdsList);
  prompt = prompt.replace(/\{\{characterNamesList\}\}/g, characterNamesList);

  return prompt.trim();
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
      // Either speaker or speakerId must be present
      if ((!msg.speaker || typeof msg.speaker !== 'string') &&
          (msg.speakerId === undefined || msg.speakerId === null)) {
        throw new Error('Invalid message: missing or invalid speaker/speakerId');
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
    // Type guard: speaker must be defined
    if (!msg.speaker) continue;

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
  - **【必須】選択したカメラアングルとショット距離をプロンプトの先頭に必ず含めてください**
  - フォーマット: "from [選択したカメラアングル], [選択したショット距離], [シーンの内容]"
  - 例: "from low angle, medium close-up shot, rooftop scene at sunset, male student leaning on fence"
  - カメラアングルとショット距離を省略しないでください
- cameraAngle: 会話の内容や雰囲気に最も適したカメラアングルを上記リストから1つ選択してください（必須）
- shotDistance: シーンの雰囲気や強調したい要素に応じて適切なショット距離を上記リストから1つ選択してください（必須）
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

/**
 * Build a prompt to re-analyze emotion tags for a single message
 */
export async function buildEmotionTagReanalysisPrompt(
  messageText: string,
  speakerName: string,
  context?: {
    previousMessages?: Array<{ speaker: string; message: string }>;
    situation?: string;
  }
): Promise<string> {
  // Fetch latest emotion tags from database
  const emotionTags = await getAllElevenLabsTags();

  const emotionTagsSection = emotionTags && emotionTags.length > 0
    ? emotionTags.map(tag => `  - ${tag.name}: ${tag.description || tag.description_ja || ''}`).join('\n')
    : `  - emotional: 感情を込めた音声（感動的なシーンや重要な告白など）
  - calm: 落ち着いた優しい音声（穏やかな会話や慰めのシーンなど）
  - energetic: 元気で活気のある音声（楽しい会話や興奮しているシーンなど）
  - professional: ビジネス的で正式な音声（真面目な会話や報告など）
  - friendly: 親しみやすい音声（カジュアルな友人との会話など）
  - serious: 真剣で権威のある音声（重要な決断や厳粛なシーンなど）`;

  const previousMessagesSection = context?.previousMessages && context.previousMessages.length > 0
    ? `\n## これまでの会話の流れ\n${context.previousMessages.map(m => `${m.speaker}: ${m.message}`).join('\n')}\n`
    : '';

  const situationSection = context?.situation
    ? `\n## シチュエーション\n${context.situation}\n`
    : '';

  return `
あなたは会話の感情分析の専門家です。以下のメッセージに最も適したElevenLabs音声感情タグを選択してください。
${situationSection}${previousMessagesSection}
## 分析対象のメッセージ
話者: ${speakerName}
メッセージ: ${messageText}

## 利用可能な感情タグ（ElevenLabs用）
${emotionTagsSection}

## タスク
上記のメッセージ内容と会話の文脈から、最も適切な感情タグを**1つだけ**選択してください。

## 出力形式
以下のJSON形式で出力してください：

\`\`\`json
{
  "emotionTag": "選択した感情タグ名",
  "reason": "この感情タグを選んだ理由（簡潔に）"
}
\`\`\`

## 要件
- emotionTagは上記リストの中から**必ず1つ**選択してください
- reasonは日本語で50文字程度の簡潔な説明にしてください
- メッセージの内容、トーン、話者の感情を総合的に判断してください
`.trim();
}

/**
 * Parse AI response for emotion tag reanalysis
 */
export async function parseEmotionTagReanalysisResponse(
  aiResponse: string
): Promise<{
  emotionTag: string;
  reason: string;
}> {
  // Try to extract JSON block from markdown code fence
  const jsonMatch = aiResponse.match(/```json\s*\n([\s\S]*?)\n```/);

  let jsonText: string;
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    // Try to find JSON without code fence
    const directJsonMatch = aiResponse.match(/\{[\s\S]*"emotionTag"[\s\S]*\}/);
    if (directJsonMatch) {
      jsonText = directJsonMatch[0];
    } else {
      throw new Error('AI response does not contain valid JSON for emotion tag analysis');
    }
  }

  try {
    const parsed = JSON.parse(jsonText);

    // Validate response structure
    if (!parsed.emotionTag || typeof parsed.emotionTag !== 'string') {
      throw new Error('Invalid response format: missing or invalid emotionTag');
    }

    return {
      emotionTag: parsed.emotionTag,
      reason: parsed.reason || 'No reason provided'
    };
  } catch (error) {
    console.error('Failed to parse emotion tag reanalysis response:', error);
    console.error('AI Response:', aiResponse);
    throw new Error(`Failed to parse emotion tag response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
