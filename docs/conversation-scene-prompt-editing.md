# 会話メッセージのシーンプロンプト編集機能

## 概要

`/conversations` ページのメッセージごとにシーンプロンプト（日本語・英語）を編集できる機能を実装しました。日本語プロンプトをGemini AIで自動的に英語に翻訳する機能も含まれています。

## 実装日

2025-11-23

## 目的

- 会話メッセージのシーンプロンプトを後から編集できるようにする
- 日本語で入力したプロンプトを、Gemini AIで画像生成に最適な英語プロンプトに自動翻訳する
- 画像生成ワークフローで使用するプロンプトの品質を向上させる

## 変更内容

### 1. バックエンド: 翻訳APIエンドポイント

**ファイル**: `/app/api/conversations/messages/[id]/translate-prompt/route.ts`

**機能**:
- 日本語のシーンプロンプトを英語に翻訳
- Gemini AI (`gemini-2.0-flash-exp`) を使用
- Stable Diffusion/DALL-E形式に最適化した英語プロンプトを生成
- 品質タグ（high quality, detailed, anime style など）を自動追加

**エンドポイント**: `POST /api/conversations/messages/[id]/translate-prompt`

**リクエスト**:
```json
{
  "japanesePrompt": "夕暮れ時の学校の屋上。主人公が柵に寄りかかり、遠くを見つめている。オレンジ色の空が背景に広がり、穏やかな風が吹いている。"
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "japanesePrompt": "夕暮れ時の学校の屋上...",
    "englishPrompt": "rooftop scene at sunset, male student leaning on fence, looking into distance, orange sky background, gentle breeze, anime style, high quality, detailed, cinematic lighting"
  }
}
```

**所有権チェック**:
- 会話 → スタジオ/ストーリー → ユーザーの階層で所有権を検証
- 他のユーザーのメッセージは翻訳できない

### 2. フロントエンド: シーンプロンプト編集UI

**ファイル**: `/components/studio/conversation/ConversationViewer.tsx`

**追加機能**:
1. **編集ボタン**: シーンプロンプト表示エリアの右上に編集ボタン（鉛筆アイコン）を配置
2. **編集モード**:
   - 日本語プロンプト入力フィールド（複数行）
   - 英語プロンプト入力フィールド（複数行）
   - 翻訳ボタン（日本語→英語）
   - 保存・キャンセルボタン

3. **翻訳ボタン**:
   - 日本語プロンプトが入力されている場合のみ有効
   - クリックすると `/api/conversations/messages/[id]/translate-prompt` を呼び出し
   - 翻訳結果を英語プロンプトフィールドに自動入力
   - 翻訳中は「翻訳中...」と表示してボタンを無効化

**状態管理**:
```typescript
const [editingScenePromptMessageId, setEditingScenePromptMessageId] = useState<number | null>(null);
const [editScenePromptJa, setEditScenePromptJa] = useState('');
const [editScenePromptEn, setEditScenePromptEn] = useState('');
const [translating, setTranslating] = useState(false);
```

**ハンドラー**:
- `handleEditScenePrompts()` - 編集モードに切り替え
- `handleSaveScenePrompts()` - 変更を保存
- `handleCancelScenePromptEdit()` - 編集をキャンセル
- `handleTranslatePrompt()` - 翻訳APIを呼び出し

### 3. 型定義の拡張

**ファイル**: `/types/conversation.ts`

```typescript
export interface UpdateMessageRequest {
  messageText?: string;
  characterId?: number;
  scenePromptJa?: string;  // 追加
  scenePromptEn?: string;  // 追加
  metadata?: ConversationMessage['metadata'];
}

interface ConversationViewerProps {
  onUpdateMessage?: (
    messageId: number,
    updates: {
      messageText?: string;
      characterId?: number;
      scenePromptJa?: string;  // 追加
      scenePromptEn?: string;  // 追加
    }
  ) => Promise<void>;
  // ...
}
```

### 4. APIエンドポイントの更新

**ファイル**: `/app/api/conversations/messages/[id]/route.ts`

**PATCH メソッド**に以下のフィールドを追加:
```typescript
if (body.scenePromptJa !== undefined) {
  updates.scene_prompt_ja = body.scenePromptJa;
}
if (body.scenePromptEn !== undefined) {
  updates.scene_prompt_en = body.scenePromptEn;
}
```

### 5. /conversations ページの更新

**ファイル**: `/app/conversations/page.tsx`

```typescript
const handleUpdateMessage = async (
  messageId: number,
  updates: {
    messageText?: string;
    characterId?: number;
    scenePromptJa?: string;  // 追加
    scenePromptEn?: string;  // 追加
  }
) => {
  // ...
};
```

## UI/UX

### 表示モード

- シーンプロンプトがある場合、メッセージの下に表示
- 日本語プロンプト: 青い左ボーダー（`borderLeft: '3px solid #2196f3'`）
- 英語プロンプト: 緑の左ボーダー（`borderLeft: '3px solid #4caf50'`）
- 編集ボタン（鉛筆アイコン）が右上に表示

### 編集モード

- 日本語プロンプト入力欄（3行）
  - プレースホルダー: "シーンの説明を日本語で入力してください"
  - 青い左ボーダー
- 英語プロンプト入力欄（3行）
  - プレースホルダー: "Scene description in English (for image generation)"
  - 緑の左ボーダー
  - 右上に「日本語から翻訳」ボタン（地球儀アイコン）
- 保存・キャンセルボタン（右下）

### 翻訳機能

- 日本語プロンプトが空の場合は翻訳ボタンが無効化
- 翻訳中は「翻訳中...」と表示
- 保存・キャンセルボタンも翻訳中は無効化

## データフロー

1. ユーザーがシーンプロンプトの編集ボタンをクリック
2. 編集モードに切り替わり、現在の日本語・英語プロンプトが入力欄に表示
3. ユーザーが日本語プロンプトを編集
4. 「日本語から翻訳」ボタンをクリック
5. `POST /api/conversations/messages/[id]/translate-prompt` を呼び出し
6. Gemini AIが英語プロンプトを生成
7. 英語プロンプト入力欄に自動入力
8. ユーザーが必要に応じて微調整
9. 保存ボタンをクリック
10. `PATCH /api/conversations/messages/[id]` で更新
11. データベースの `scene_prompt_ja`, `scene_prompt_en` を更新
12. UIを表示モードに戻す

## 技術的詳細

### 翻訳プロンプト

```typescript
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
```

### エラーハンドリング

- 翻訳APIエラー: `alert('翻訳に失敗しました: ' + error.message)`
- 保存エラー: `alert('シーンプロンプトの更新に失敗しました')`
- 所有権エラー: `401 Unauthorized` または `403 Forbidden`

## 影響範囲

- `/conversations` ページで会話メッセージのシーンプロンプトを編集可能に
- 日本語で入力したプロンプトを画像生成に最適な英語形式に自動翻訳
- 既存の会話データには影響なし（後方互換性を維持）
- Nanobanaノード実行時に `scene_prompt_en` が使用される

## 将来の拡張可能性

- 複数の翻訳スタイルを選択可能に（アニメ風、リアル風、ファンタジー風など）
- 翻訳履歴の保存と復元
- プロンプトテンプレートの提供
- 他の言語への翻訳対応

## 使用例

### 編集前

```json
{
  "scene_prompt_ja": "夕暮れ時の学校の屋上",
  "scene_prompt_en": "school rooftop at sunset"
}
```

### 編集後

```json
{
  "scene_prompt_ja": "夕暮れ時の学校の屋上。主人公が柵に寄りかかり、遠くを見つめている。オレンジ色の空が背景に広がり、穏やかな風が吹いている。真剣な表情で将来について考えている。",
  "scene_prompt_en": "rooftop scene at sunset, male student leaning on fence, looking into distance, orange sky background, gentle breeze, serious expression thinking about future, anime style, high quality, detailed, cinematic lighting"
}
```

## 関連ドキュメント

- [会話生成機能の拡張（感情タグ、カメラ情報、シーンプロンプト）](/docs/conversation-generation-enhancements.md)
- [会話からスタジオ作成時のワークフロー設定自動化](/docs/conversation-to-studio-workflow.md)
- [メッセージごとのシーンキャラクターシート設定機能](/docs/message-scene-character-sheets.md)
