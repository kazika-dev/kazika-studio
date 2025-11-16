# バグ修正: nodeOverrides適用順序の問題

**修正日**: 2025-11-16
**ブランチ**: `vk/ada0-scene-prompt-en`
**関連Issue**: `scene_prompt_en` がスタジオのワークフローステップのNanobanaノードに設定されない

## 問題の概要

会話からスタジオを作成した際、`conversation_messages.scene_prompt_en` が返されているにもかかわらず、スタジオのワークフローステップで Nanobana ノードの `prompt` に設定されない問題が発生していました。

## 根本原因

`/app/api/studios/steps/[id]/execute/route.ts` の `applyInputsToNodes()` 関数で、`nodeOverrides` を関数の**最初**に適用していたため、その後の処理で上書きされる可能性がありました。

### 問題のあった処理順序

```typescript
async function applyInputsToNodes(nodes, inputs, workflow, step) {
  // 1. nodeOverrides を適用 ← ここで scene_prompt_en を設定
  if (step?.input_config?.nodeOverrides) {
    Object.entries(step.input_config.nodeOverrides).forEach(([nodeId, overrides]) => {
      node.data.config = { ...node.data.config, ...overrides };
    });
  }

  // 2. inputs.prompt で上書き ← ここで空になる可能性
  if (inputs.prompt) {
    node.data.config = { ...node.data.config, prompt: inputs.prompt };
  }

  // 3. inputs.workflowInputs で追加/上書き ← ここでも上書きされる可能性
  if (inputs.workflowInputs) {
    // プロンプトフィールドを処理
  }
}
```

この順序だと、`nodeOverrides` で設定した `prompt` が後続の処理で上書きされてしまいます。

## 修正内容

`nodeOverrides` の適用を**関数の最後**に移動し、他の処理で上書きされないことを保証しました。

### 修正後の処理順序

```typescript
async function applyInputsToNodes(nodes, inputs, workflow, step) {
  // 1. inputs.prompt を適用
  if (inputs.prompt) {
    node.data.config = { ...node.data.config, prompt: inputs.prompt };
  }

  // 2. inputs.workflowInputs を適用
  if (inputs.workflowInputs) {
    // プロンプトフィールドを処理
  }

  // 3. nodeOverrides を適用（最優先）← ここで確定
  if (step?.input_config?.nodeOverrides) {
    Object.entries(step.input_config.nodeOverrides).forEach(([nodeId, overrides]) => {
      node.data.config = { ...node.data.config, ...overrides };
    });
  }
}
```

## 変更ファイル

### 1. `/app/api/studios/steps/[id]/execute/route.ts`

**変更箇所**: 538-808行目の `applyInputsToNodes()` 関数

**Before**:
```typescript
async function applyInputsToNodes(nodes, inputs, workflow, step) {
  // Apply nodeOverrides from step.input_config
  if (step?.input_config?.nodeOverrides) {
    // ...適用処理
  }

  if (!inputs || Object.keys(inputs).length === 0) {
    console.log('No inputs to apply');
    return; // ← 早期リターンで nodeOverrides のみが適用される
  }

  // 以下、inputs の処理
}
```

**After**:
```typescript
async function applyInputsToNodes(nodes, inputs, workflow, step) {
  if (!inputs || Object.keys(inputs).length === 0) {
    console.log('No inputs to apply (besides nodeOverrides)');
    // Even if no inputs, we still need to apply nodeOverrides at the end
  }

  // inputs の処理（従来通り）
  // ...

  // Apply nodeOverrides from step.input_config (LAST, so they are not overridden by other inputs)
  if (step?.input_config?.nodeOverrides) {
    console.log('=== Applying nodeOverrides from step.input_config (final) ===');
    // ...適用処理（最優先）
  }
}
```

### 2. `/app/api/conversations/[id]/create-studio/route.ts`

**変更箇所**: 197-201行目

**TypeScript型エラーの修正**:

```typescript
// Before
const characterVoiceId = message.character?.elevenlabs_voice_id;

// After
const character = Array.isArray(message.character) ? message.character[0] : message.character;
const characterVoiceId = character?.elevenlabs_voice_id;
```

**理由**: Supabase の `.select()` で外部テーブルを取得した場合、TypeScript は配列として推論するため、型アサーションが必要。

### 3. `/lib/conversation/prompt-builder.ts`

**変更箇所**: 171-180行目

**TypeScript型エラーの修正**:

```typescript
// Before
for (const msg of messages) {
  if (!validCharacterNames.includes(msg.speaker)) {
    // ...
  }
}

// After
for (const msg of messages) {
  // Type guard: speaker must be defined
  if (!msg.speaker) continue;

  if (!validCharacterNames.includes(msg.speaker)) {
    // ...
  }
}
```

**理由**: `msg.speaker` が `string | undefined` の可能性があるため、型ガードが必要。

## 影響範囲

### 修正により解決される問題

1. **会話からスタジオ作成時の `scene_prompt_en` が Nanobana ノードに確実に設定される**
   - `nodeOverrides` で設定した値が最優先で適用される
   - 他の入力処理で上書きされることがない

2. **その他の `nodeOverrides` の設定も確実に反映される**
   - `voiceId` (ElevenLabs)
   - `aspectRatio` (Nanobana)
   - `selectedCharacterSheetIds` (Nanobana)
   - その他、将来追加される `nodeOverrides` の設定

3. **TypeScript ビルドエラーの解消**
   - `create-studio/route.ts` の型エラー
   - `prompt-builder.ts` の型エラー

### 後方互換性

- 既存のワークフローステップには影響なし
- `nodeOverrides` が存在しない場合は、従来通りの動作を維持

## テスト方法

### 1. 会話を生成

```bash
POST /api/conversations/generate
{
  "characterIds": [1],
  "situation": "学校の屋上で将来について語る",
  "messageCount": 5
}
```

### 2. スタジオを作成

```bash
POST /api/conversations/[id]/create-studio
{
  "workflowIds": [123]  # Nanobana ノードを含むワークフロー
}
```

### 3. ワークフローステップを実行

```bash
POST /api/studios/steps/[step_id]/execute
```

### 4. 確認

- ログで `=== Applying nodeOverrides from step.input_config (final) ===` が表示される
- Nanobana ノードの `prompt` に `scene_prompt_en` が設定されている
- 実行結果の画像が `scene_prompt_en` に基づいて生成されている

## 関連ドキュメント

- [会話からスタジオ作成時のワークフロー設定自動化](/docs/conversation-to-studio-workflow.md)
- [CLAUDE.md](/CLAUDE.md) - アーキテクチャの原則

## 今後の改善案

1. **ユニットテストの追加**: `applyInputsToNodes()` の動作を保証するテストケースを追加
2. **型定義の改善**: Supabase の外部テーブル取得時の型推論を改善（型アサーション不要にする）
3. **nodeOverrides のバリデーション**: ノードIDが存在しない場合の警告を強化
