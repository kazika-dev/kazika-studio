# 会話生成機能の拡張

## 概要

会話生成システムに以下の機能を追加しました：

1. **感情タグ（Emotion Tags）の自動設定**: ElevenLabs音声生成用の感情タグを会話の内容に応じて自動設定
2. **メッセージテキストへの感情タグ追加**: 生成されたメッセージに `[emotionTag]` プレフィックスを追加
3. **カメラアングルとショット距離の自動選択**: シーン生成時にカメラアングルとショット距離を自動的に選択し、画像生成プロンプトに含める

## 感情タグ機能

### 概要

会話生成時に、AIが各メッセージの内容に応じて適切な感情タグを選択します。感情タグは `kazikastudio.eleven_labs_tags` テーブルから取得され、ElevenLabs音声生成APIに渡されます。

### 利用可能な感情タグ

| タグ名 | 説明 | 使用シーン |
|--------|------|------------|
| `emotional` | 感情を込めた音声 | 感動的なシーンや重要な告白など |
| `calm` | 落ち着いた優しい音声 | 穏やかな会話や慰めのシーンなど |
| `energetic` | 元気で活気のある音声 | 楽しい会話や興奮しているシーンなど |
| `professional` | ビジネス的で正式な音声 | 真面目な会話や報告など |
| `friendly` | 親しみやすい音声 | カジュアルな友人との会話など |
| `serious` | 真剣で権威のある音声 | 重要な決断や厳粛なシーンなど |

### 実装詳細

#### 1. データベース駆動のプロンプト生成（`lib/conversation/prompt-builder.ts`）

`buildConversationPrompt()` を**async関数**に変更し、呼び出されるたびに `kazikastudio.eleven_labs_tags` テーブルから**最新の感情タグ**を取得してプロンプトに含めるように修正：

```typescript
export async function buildConversationPrompt(input: ConversationPromptInput): Promise<string> {
  // Fetch latest emotion tags from database
  const emotionTags = await getAllElevenLabsTags();

  // Build emotion tags section from database
  const emotionTagsSection = emotionTags && emotionTags.length > 0
    ? emotionTags.map(tag => `  - ${tag.name}: ${tag.description || tag.description_ja || ''}`).join('\n')
    : /* fallback */;

  // Include emotion tags in the prompt
  return `...
  - **emotionTag（感情タグ）は、メッセージの音声化に使用されます。以下の利用可能な感情タグから適切なものを選んでください：**
  ${emotionTagsSection}
  ...`;
}
```

これにより、マスターテーブルに新しい感情タグを追加すると、次回の会話生成から**自動的にAIが利用可能**になります。

AIに感情タグの選択を指示するようプロンプトを修正：

```typescript
{
  "speaker": "キャラクター名",
  "message": "セリフ内容",
  "emotion": "happy|sad|angry|neutral|surprised|excited|confused",
  "emotionTag": "emotional|calm|energetic|professional|friendly|serious",
  "scene": "このメッセージが発せられた具体的な場面の描写"
}
```

#### 2. メッセージ保存処理（`app/api/conversations/generate/route.ts`）

生成されたメッセージに感情タグをプレフィックスとして追加：

```typescript
// 例: "こんにちは！" → "[friendly] こんにちは！"
const emotionTagPrefix = msg.emotionTag ? `[${msg.emotionTag}] ` : '';
const messageTextWithTag = emotionTagPrefix + msg.message;
```

#### 3. メタデータへの保存

感情タグは `conversation_messages.metadata.emotionTag` にも保存されます：

```typescript
metadata: {
  emotion: msg.emotion || 'neutral',
  emotionTag: msg.emotionTag || 'neutral',
  scene: msg.scene || ''
}
```

### 使用例

**入力（シチュエーション）**:
```
学校の屋上で、主人公が友人に悩みを打ち明けるシーン
```

**出力（生成されたメッセージ）**:
```json
{
  "speaker": "主人公",
  "message": "実は最近、将来のことで悩んでいるんだ...",
  "emotion": "sad",
  "emotionTag": "serious",
  "scene": "主人公は柵に寄りかかり、遠くを見つめながら話す"
}
```

**データベース保存（message_text）**:
```
[serious] 実は最近、将来のことで悩んでいるんだ...
```

---

## カメラアングル・ショット距離機能

### 概要

シーン生成時に、AIがシーンの内容に応じて適切なカメラアングルとショット距離を選択します。選択された情報は画像生成プロンプトに含まれ、より映像的な表現が可能になります。

### 利用可能なカメラアングル（`kazikastudio.m_camera_angles`）

| アングル名 | 説明 | 効果 |
|-----------|------|------|
| ローアングル | Low Angle - 被写体を下から見上げる | 迫力、威圧感、英雄的な印象 |
| ハイアングル | High Angle - 被写体を上から見下ろす | 脆弱性、孤独感、客観的な視点 |
| アイレベル | Eye Level - 被写体と同じ目線の高さ | 自然、親近感、会話的な雰囲気 |
| バーズアイビュー | Bird's Eye View - 真上から見下ろす | 全体像の把握、空間的な広がり |
| ワームズアイビュー | Worm's Eye View - 真下から見上げる | 圧倒的な迫力、非日常的な視点 |
| ダッチアングル | Dutch Angle - カメラを傾けた構図 | 不安定感、緊張感、混乱 |

### 利用可能なショット距離（`kazikastudio.m_shot_distances`）

| 距離名 | 説明 | 効果 |
|--------|------|------|
| エクストリームクローズアップ | Extreme Close-Up (ECU) | 細部の強調、感情の集中 |
| クローズアップ | Close-Up (CU) - 顔全体 | 表情の詳細、感情表現 |
| ミディアムクローズアップ | Medium Close-Up (MCU) - 胸から上 | 会話シーン、表情と身振り |
| ミディアムショット | Medium Shot (MS) - 腰から上 | 自然な会話、インタビュー |
| ミディアムロングショット | Medium Long Shot (MLS) - 膝から上 | 体の動きと環境のバランス |
| ロングショット | Long Shot (LS) - 全身 | 人物と環境の関係、アクション |
| エクストリームロングショット | Extreme Long Shot (ELS) | 環境全体、空間的な広がり |

### 実装詳細

#### 1. データベース駆動のプロンプト生成（`lib/conversation/prompt-builder.ts`）

`buildScenePrompt()` を**async関数**に変更し、呼び出されるたびに `kazikastudio.m_camera_angles` と `kazikastudio.m_shot_distances` テーブルから**最新のカメラ情報**を取得してプロンプトに含めるように修正：

```typescript
export async function buildScenePrompt(
  situation: string,
  characters: Array<{ name: string; description: string }>,
  messages: GeneratedMessage[]
): Promise<string> {
  // Fetch latest camera angles and shot distances from database
  const cameraAngles = await getAllCameraAngles();
  const shotDistances = await getAllShotDistances();

  // Build camera sections from database
  const cameraAnglesSection = cameraAngles && cameraAngles.length > 0
    ? `\n## 利用可能なカメラアングル\n${cameraAngles.map(a => `- ${a.name}: ${a.description}`).join('\n')}`
    : '';

  // Include camera info in the prompt
  return `...
  ${cameraAnglesSection}
  ${shotDistancesSection}
  ...`;
}
```

これにより、マスターテーブルに新しいカメラアングルやショット距離を追加すると、次回のシーン生成から**自動的にAIが利用可能**になります。

#### 2. データベースヘルパー関数（`lib/db.ts`）

カメラ情報と感情タグを取得するための関数を追加：

```typescript
// 全ての感情タグを取得
export async function getAllElevenLabsTags()

// 全てのカメラアングルを取得
export async function getAllCameraAngles()

// 全てのショット距離を取得
export async function getAllShotDistances()

// ランダムにカメラアングルを1つ取得
export async function getRandomCameraAngle()

// ランダムにショット距離を1つ取得
export async function getRandomShotDistance()
```

#### 3. API呼び出しの変更（`app/api/conversations/generate/route.ts`）

プロンプト生成関数が**async**になったため、`await`で呼び出すように変更：

```typescript
// Before: 同期関数
const prompt = buildConversationPrompt({ ... });

// After: async関数（データベースから最新の感情タグを取得）
const prompt = await buildConversationPrompt({ ... });

// Before: カメラ情報を引数で渡す
const cameraAngles = await getAllCameraAngles();
const shotDistances = await getAllShotDistances();
const scenePrompt = buildScenePrompt(situation, characters, messages, cameraAngles, shotDistances);

// After: async関数（内部でデータベースから最新のカメラ情報を取得）
const scenePrompt = await buildScenePrompt(situation, characters, messages);
```

これにより、プロンプト生成のたびに**最新のマスターデータ**が自動的に使用されます。

#### 4. シーンプロンプト修正（削除された引数）

**変更前**:
```typescript
export function buildScenePrompt(
  situation: string,
  characters: Array<{ name: string; description: string }>,
  messages: GeneratedMessage[],
  cameraAngles?: Array<{ name: string; description: string }>,
  shotDistances?: Array<{ name: string; description: string }>
): string
```

**変更後**:
```typescript
export async function buildScenePrompt(
  situation: string,
  characters: Array<{ name: string; description: string }>,
  messages: GeneratedMessage[]
): Promise<string>
```

カメラ情報は関数内部でデータベースから取得するため、引数として渡す必要がなくなりました。

**出力フォーマット**:
```json
{
  "sceneDescription": "シーンの詳細な視覚的描写",
  "imagePrompt": "from low angle, medium close-up shot, ...",
  "cameraAngle": "ローアングル",
  "shotDistance": "ミディアムクローズアップ"
}
```

#### 3. シーン生成処理（`app/api/conversations/generate/route.ts`）

##### 自動シーン生成（会話全体）

会話全体の最初のシーンを生成する際、AIが適切なカメラ情報を選択：

```typescript
// Fetch camera angles and shot distances from database
const cameraAngles = await getAllCameraAngles();
const shotDistances = await getAllShotDistances();

const scenePrompt = buildScenePrompt(
  body.situation,
  characters.map(c => ({ name: c.name, description: c.description })),
  parsed.messages,
  cameraAngles,
  shotDistances
);

// Save scene to database with camera info
const { data: scene } = await supabase
  .from('conversation_scenes')
  .insert({
    conversation_id: conversation.id,
    scene_number: 1,
    scene_description: scenePromptData.sceneDescription,
    image_generation_prompt: scenePromptData.imagePrompt,
    metadata: {
      cameraAngle: scenePromptData.cameraAngle || null,
      shotDistance: scenePromptData.shotDistance || null
    }
  });
```

##### メッセージグループごとのシーン生成

会話を3〜5メッセージごとにグループ化し、各グループに**ランダムな**カメラ情報を割り当て：

```typescript
// Get random camera angle and shot distance for variety
const randomCameraAngle = cameraAngles[Math.floor(Math.random() * cameraAngles.length)];
const randomShotDistance = shotDistances[Math.floor(Math.random() * shotDistances.length)];

// Create image generation prompt with camera info
const cameraInfo = `, ${randomCameraAngle.name}, ${randomShotDistance.name}`;
const imagePrompt = `${body.situation}の場面で、...${cameraInfo}。`;

scenesToInsert.push({
  // ...
  metadata: {
    // ...
    cameraAngle: randomCameraAngle?.name || null,
    shotDistance: randomShotDistance?.name || null
  }
});
```

### 使用例

**入力（シチュエーション）**:
```
学校の屋上で、主人公が友人に悩みを打ち明けるシーン
```

**出力（シーンプロンプト）**:
```json
{
  "sceneDescription": "夕暮れ時の学校の屋上。主人公は柵に寄りかかり、友人は少し離れたところに立っている。オレンジ色の空が背景に広がる。",
  "imagePrompt": "rooftop scene at sunset, two students talking, one leaning on fence, orange sky, from low angle, medium close-up shot, anime style, high quality, detailed",
  "cameraAngle": "ローアングル",
  "shotDistance": "ミディアムクローズアップ"
}
```

**データベース保存（conversation_scenes）**:
```json
{
  "scene_number": 1,
  "scene_description": "夕暮れ時の学校の屋上。主人公は柵に寄りかかり...",
  "image_generation_prompt": "rooftop scene at sunset, two students talking, one leaning on fence, orange sky, from low angle, medium close-up shot, anime style, high quality, detailed",
  "metadata": {
    "cameraAngle": "ローアングル",
    "shotDistance": "ミディアムクローズアップ",
    "message_ids": [1, 2, 3, 4]
  }
}
```

---

## データベーススキーマの変更

### conversation_messages.metadata

```typescript
metadata: {
  emotion?: 'happy' | 'sad' | 'angry' | 'neutral' | 'surprised' | 'excited' | 'confused';
  emotionTag?: 'emotional' | 'calm' | 'energetic' | 'professional' | 'friendly' | 'serious'; // 新規追加
  scene?: string;
  voice_preset?: string;
  audio_url?: string;
  regenerated?: boolean;
  prompt_version?: string;
}
```

### conversation_scenes.metadata

```typescript
metadata: {
  message_ids?: number[];
  start_sequence?: number;
  end_sequence?: number;
  dialogue_preview?: string;
  cameraAngle?: string; // 新規追加
  shotDistance?: string; // 新規追加
}
```

---

## 影響範囲

### 変更されたファイル

1. **`lib/db.ts`** - カメラアングル・ショット距離取得関数を追加
2. **`lib/conversation/prompt-builder.ts`** - プロンプトにemotionTag、カメラ情報を追加
3. **`types/conversation.ts`** - GeneratedMessage、ConversationMessageにemotionTag型を追加
4. **`app/api/conversations/generate/route.ts`** - メッセージ保存時にemotionTagをプレフィックス化、シーン生成時にカメラ情報を追加

### 後方互換性

- 既存の会話データには影響なし（metadataはオプショナル）
- emotionTagが存在しない場合はプレフィックスなしで保存
- カメラ情報が存在しない場合はnullで保存

---

## 今後の拡張案

1. **ユーザー指定のカメラ設定**: UIでユーザーがカメラアングル・ショット距離を手動選択できるようにする
2. **シーンごとの感情タグ**: メッセージだけでなく、シーン全体の雰囲気に応じた感情タグを設定
3. **カメラムーブメント**: パン、チルト、ズームなどのカメラの動きを追加（`m_camera_movements`テーブル）
4. **感情タグのカスタマイズ**: ユーザーが独自の感情タグを追加できる機能
5. **音声生成との連携**: ElevenLabs APIに感情タグを渡して、より表現豊かな音声を生成

---

## 参考資料

- [ElevenLabs Tags機能](/docs/elevenlabs-tags-feature.md)
- [データベーススキーマ](/DATABASE.md)
- [会話生成API仕様](/docs/conversation-api.md)
