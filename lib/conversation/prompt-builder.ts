import type {
  ConversationPromptInput,
  ConversationGenerationAIResponse,
  GeneratedMessage
} from '@/types/conversation';

/**
 * Build a conversation generation prompt for the AI model
 */
export function buildConversationPrompt(input: ConversationPromptInput): string {
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
      "emotion": "happy|sad|angry|neutral|surprised|excited|confused"
    }
  ]
}
\`\`\`

## 重要な注意事項
- 各キャラクターの性格と話し方の特徴を必ず反映してください
- speakerフィールドには必ずキャラクター名のいずれかを使用してください
- 自然な会話の流れを作ってください
- 感情(emotion)は会話の文脈に合わせて適切に設定してください
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
 * Build a scene image generation prompt based on conversation context
 */
export function buildScenePrompt(
  situation: string,
  characters: Array<{ name: string; description: string }>,
  messages: GeneratedMessage[]
): string {
  const characterDescriptions = characters
    .map(char => `${char.name}: ${char.description}`)
    .join(', ');

  const conversationSummary = messages
    .map(msg => `${msg.speaker}: ${msg.message}`)
    .join('\n');

  return `
あなたはシーン画像生成のためのプロンプトを作成するAIです。
以下の会話内容に基づいて、シーンを視覚化するための詳細な画像生成プロンプトを作成してください。

## シチュエーション
${situation}

## 登場キャラクター
${characterDescriptions}

## 会話内容
${conversationSummary}

## 出力形式
以下のJSON形式でシーン画像生成プロンプトを作成してください。

\`\`\`json
{
  "sceneDescription": "シーンの詳細な説明（日本語）",
  "imagePrompt": "英語での画像生成プロンプト（Stable Diffusion/DALL-E用）"
}
\`\`\`

## 重要な注意事項
- sceneDescriptionには、シーンの雰囲気、キャラクターの配置、背景などを日本語で詳細に記述してください
- imagePromptには、画像生成AIが理解しやすい英語のプロンプトを作成してください
- imagePromptには、キャラクターの外見的特徴、シーンの構図、照明、雰囲気などを含めてください
- imagePromptは具体的で視覚的に明確な表現を使用してください

視覚的に魅力的なシーン画像プロンプトを生成してください。
`.trim();
}

/**
 * Parse scene prompt AI response
 */
export async function parseScenePromptResponse(
  aiResponse: string
): Promise<{ sceneDescription: string; imagePrompt: string }> {
  const jsonMatch = aiResponse.match(/```json\s*\n([\s\S]*?)\n```/);

  let jsonText: string;
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  } else {
    const directJsonMatch = aiResponse.match(/\{[\s\S]*"sceneDescription"[\s\S]*\}/);
    if (directJsonMatch) {
      jsonText = directJsonMatch[0];
    } else {
      throw new Error('AI response does not contain valid scene prompt JSON');
    }
  }

  try {
    const parsed = JSON.parse(jsonText);

    if (!parsed.sceneDescription || typeof parsed.sceneDescription !== 'string') {
      throw new Error('Invalid response: missing or invalid sceneDescription');
    }
    if (!parsed.imagePrompt || typeof parsed.imagePrompt !== 'string') {
      throw new Error('Invalid response: missing or invalid imagePrompt');
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse scene prompt response:', error);
    console.error('AI Response:', aiResponse);
    throw new Error(`Failed to parse scene prompt response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
