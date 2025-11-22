-- Create conversation_prompt_templates table
-- This table stores customizable prompt templates for conversation generation

CREATE TABLE IF NOT EXISTS kazikastudio.conversation_prompt_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_text TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add comment
COMMENT ON TABLE kazikastudio.conversation_prompt_templates IS '会話生成プロンプトのテンプレート管理テーブル';

-- Create indexes
CREATE INDEX idx_conversation_prompt_templates_user_id ON kazikastudio.conversation_prompt_templates(user_id);
CREATE INDEX idx_conversation_prompt_templates_is_default ON kazikastudio.conversation_prompt_templates(is_default);

-- Enable RLS
ALTER TABLE kazikastudio.conversation_prompt_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view templates
CREATE POLICY "conversation_prompt_templates_select" ON kazikastudio.conversation_prompt_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own templates
CREATE POLICY "conversation_prompt_templates_insert" ON kazikastudio.conversation_prompt_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "conversation_prompt_templates_update" ON kazikastudio.conversation_prompt_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "conversation_prompt_templates_delete" ON kazikastudio.conversation_prompt_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert default template
INSERT INTO kazikastudio.conversation_prompt_templates (name, description, template_text, is_default, user_id) VALUES
(
  'デフォルト会話生成プロンプト',
  '標準的な会話生成用のプロンプトテンプレート',
  'あなたはキャラクター間の自然な会話を生成するAIです。
以下の情報に基づいて、キャラクターらしい会話を生成してください。

## キャラクター情報
{{charactersSection}}

## 会話設定
- シチュエーション: {{situation}}
- 会話の雰囲気: {{toneDescription}}
- 生成するメッセージ数: {{messageCount}}
{{previousMessagesSection}}

## 出力形式
以下のJSON形式で会話を生成してください。各キャラクターの性格と話し方を必ず反映させてください。

```json
{
  "characterIds": [このシーンに登場する全てのキャラクターIDの配列（数値、上記のキャラクター情報のIDを使用）],
  "messages": [
    {
      "speakerId": キャラクターID（数値、上記のキャラクター情報のIDを使用）,
      "message": "セリフ内容",
      "emotion": "happy|sad|angry|neutral|surprised|excited|confused",
      "emotionTag": "感情を表すタグ（下記の利用可能な感情タグから1つ選択）",
      "scene": "このメッセージが発せられた具体的な場面の描写（キャラクターの表情、動作、周囲の状況など）",
      "scenePromptJa": "シーンを画像生成するための日本語プロンプト（100-150文字程度、視覚的な要素を詳細に描写）",
      "scenePromptEn": "シーンを画像生成するための英語プロンプト（Stable Diffusion/DALL-E形式、high quality, detailed, anime styleなどの品質タグを含む）",
      "sceneCharacterIds": [このメッセージのシーンに登場するキャラクターIDの配列（数値）]
    }
  ]
}
```

## 重要な注意事項
- 各キャラクターの性格と話し方の特徴を必ず反映してください
- **【必須】characterIdsフィールドには、このシーンに登場する全てのキャラクターIDを配列で記載してください（例: {{characterIdsList}}）**
  - 会話に登場したキャラクターを全て含めてください
  - 登場しなかったキャラクターは含めないでください
- **【必須】speakerIdフィールドには、上記のキャラクター情報に記載されているID（数値）を正確に使用してください（例: {{characterIdsList}}）**
- **【オプション】speakerフィールドには、キャラクター名を記載してください（例: {{characterNamesList}}）**
  - speakerIdが正しく設定されていれば、speakerフィールドは省略可能です
- 自然な会話の流れを作ってください
- 感情(emotion)は会話の文脈に合わせて適切に設定してください
- **emotionTag（感情タグ）は、メッセージの音声化に使用されます。以下の利用可能な感情タグから適切なものを選んでください：**
{{emotionTagsSection}}
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
- **【必須】sceneCharacterIds（シーンキャラクターID）には、このメッセージのシーンに登場する全てのキャラクターIDを配列で記載してください**
  - 話者（speakerId）だけでなく、シーンに映り込む全てのキャラクターを含めてください
  - 例: 話者が「ミオ」で、背景に「カジカ」と「メスガキ」も映っている場合 → sceneCharacterIds: [12, 13, 14]
  - シーンプロンプト（scenePromptJa/En）に記載されているキャラクターを全て含めてください
  - 最大4人まで登録可能（画像生成の制約）
- メッセージ数は正確に{{messageCount}}個生成してください

自然で魅力的な会話を生成してください。',
  true,
  NULL
);
