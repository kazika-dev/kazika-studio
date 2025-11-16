# 会話からスタジオ作成時のワークフロー設定自動化

**作成日**: 2025-11-16

## 概要

会話データからスタジオを作成する際、ワークフローステップの `input_config.nodeOverrides` を使って、ElevenLabsノードとNanobanaノードの設定を会話データから**自動的に設定**する機能です。

## 目的

- **手作業の削減**: 各ボード（メッセージ）ごとにノード設定を手動で入力する必要がなくなる
- **データの一貫性**: 会話生成時のデータ（音声ID、シーンプロンプト、キャラクター画像など）がワークフローに自動反映される
- **ワークフロー実行の簡素化**: スタジオ作成後、すぐにワークフローを実行できる状態になる

## 実装内容

### 対応ノードタイプ

#### 1. ElevenLabsノード

会話メッセージから以下の設定を自動取得：

```typescript
{
  text: message.message_text,           // メッセージテキスト（感情タグ付き）
  voiceId: message.character?.elevenlabs_voice_id || 'JBFqnCBsd6RMkjVDRZzb',
  modelId: node.data?.config?.modelId || 'eleven_turbo_v2_5'
}
```

**データソース**:
- `text`: `conversation_messages.message_text` (例: `[friendly] こんにちは！`)
- `voiceId`: `character_sheets.elevenlabs_voice_id` → なければデフォルト（George）
- `modelId`: ワークフローノードの既存設定 → なければ `eleven_turbo_v2_5`

#### 2. Nanobanaノード

会話メッセージから以下の設定を自動取得：

```typescript
{
  prompt: message.scene_prompt_en || message.scene_prompt_ja || message.metadata?.scene || '',
  aspectRatio: node.data?.config?.aspectRatio || '16:9',
  selectedCharacterSheetIds: message.character_id ? [message.character_id] : []
}
```

**データソース**:
- `prompt`:
  1. `conversation_messages.scene_prompt_en` (優先)
  2. `conversation_messages.scene_prompt_ja` (英語がない場合)
  3. `conversation_messages.metadata.scene` (シーン説明)
  4. 空文字列
- `aspectRatio`: ワークフローノードの既存設定 → なければ `16:9`
- `selectedCharacterSheetIds`: `conversation_messages.character_id` (キャラクターの画像を自動設定)

## データフロー

```
会話生成
  ↓
conversation_messages テーブル
  ├─ message_text: "[friendly] こんにちは！"
  ├─ scene_prompt_en: "rooftop scene at sunset, anime style..."
  ├─ scene_prompt_ja: "夕暮れ時の学校の屋上。..."
  ├─ character_id: 123
  └─ metadata: { emotion: "happy", emotionTag: "friendly", scene: "..." }
  ↓
character_sheets テーブル
  └─ elevenlabs_voice_id: "ja-JP-Wavenet-A"
  ↓
スタジオ作成 API (/api/conversations/[id]/create-studio)
  ↓
studio_board_workflow_steps テーブル
  └─ input_config:
      ├─ character_id: 123
      ├─ character_name: "主人公"
      ├─ scene_prompt_en: "rooftop scene at sunset..."
      ├─ scene_prompt_ja: "夕暮れ時の学校の屋上..."
      └─ nodeOverrides:
          ├─ "elevenlabs-1": {
          │    text: "[friendly] こんにちは！",
          │    voiceId: "ja-JP-Wavenet-A",
          │    modelId: "eleven_turbo_v2_5"
          │  }
          └─ "nanobana-1": {
               prompt: "rooftop scene at sunset, anime style...",
               aspectRatio: "16:9",
               selectedCharacterSheetIds: [123]
             }
  ↓
ワークフロー実行 (/api/workflows/execute)
  └─ nodeOverrides が node.data.config にマージされる
  ↓
各ノードが設定された値で実行
```

## 技術的詳細

### スタジオ作成時の処理

**ファイル**: `/app/api/conversations/[id]/create-studio/route.ts`

```typescript
// ワークフローからノードを抽出
const elevenLabsNodes = workflowNodes.filter(
  (node: any) => node.data?.type === 'elevenlabs' || node.type === 'elevenlabs'
);
const nanobanaNodes = workflowNodes.filter(
  (node: any) => node.data?.type === 'nanobana' || node.type === 'nanobana'
);

// 各メッセージごとにnodeOverridesを生成
const workflowStepsToInsert = boards.map((board, idx) => {
  const message = messages[idx];
  const nodeOverrides: any = {};

  // ElevenLabsノードの設定
  elevenLabsNodes.forEach((node: any) => {
    nodeOverrides[node.id] = {
      text: message.message_text,
      voiceId: message.character?.elevenlabs_voice_id || 'JBFqnCBsd6RMkjVDRZzb',
      modelId: node.data?.config?.modelId || 'eleven_turbo_v2_5',
    };
  });

  // Nanobanaノードの設定
  nanobanaNodes.forEach((node: any) => {
    const nodeConfig: any = {
      prompt: message.scene_prompt_en || message.scene_prompt_ja || message.metadata?.scene || '',
      aspectRatio: node.data?.config?.aspectRatio || '16:9',
    };
    if (message.character_id) {
      nodeConfig.selectedCharacterSheetIds = [message.character_id];
    }
    nodeOverrides[node.id] = nodeConfig;
  });

  return {
    board_id: board.id,
    workflow_id: workflowId,
    input_config: {
      character_id: message.character_id,
      character_name: message.speaker_name,
      scene_prompt_en: message.scene_prompt_en,
      scene_prompt_ja: message.scene_prompt_ja,
      nodeOverrides: nodeOverrides, // ← ここに設定が格納される
    }
  };
});
```

### ワークフロー実行時の処理

**ファイル**: `/app/api/studios/steps/[id]/execute/route.ts`

```typescript
// input_config.nodeOverrides を node.data.config にマージ
// IMPORTANT: この処理は applyInputsToNodes() の最後に実行される
// これにより、他の入力処理で上書きされることを防ぐ
if (step?.input_config?.nodeOverrides) {
  Object.entries(step.input_config.nodeOverrides).forEach(([nodeId, overrides]) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      node.data.config = {
        ...node.data.config,
        ...overrides, // ← ここでマージされる（最優先）
      };
    }
  });
}
```

**重要**: `nodeOverrides` は `applyInputsToNodes()` の**最後**に適用されます。これにより、以下の処理による上書きを防ぎます：
- `inputs.prompt` による上書き
- `inputs.workflowInputs` のプロンプトフィールドによる追加

この処理により、スタジオ作成時に設定した `nodeOverrides` が、ワークフロー実行時に各ノードの設定として**確実に**反映されます。

## CLAUDE.mdの原則との整合性

### 設定の一元管理

- ノード設定は `/lib/workflow/formConfigGenerator.ts` の `getNodeTypeConfig()` で定義
- `nodeOverrides` は `node.data.config` にマージされるため、**既存のノード設定システムと完全に互換性がある**

### 後方互換性

- `nodeOverrides` が存在しない場合は、ワークフローノードの既存設定がそのまま使用される
- 既存のワークフローには影響なし

## 使用例

### 1. 会話を生成

```typescript
// POST /api/conversations/generate
{
  "characterIds": [1, 2],
  "situation": "学校の屋上で将来について語る",
  "messageCount": 10
}
```

**生成されたメッセージ**:
```json
{
  "message_text": "[friendly] こんにちは！今日はいい天気だね。",
  "scene_prompt_en": "school rooftop at daytime, clear blue sky, two students chatting casually, anime style, high quality",
  "scene_prompt_ja": "晴れた日の学校の屋上。青空が広がり、2人の生徒が気軽に話している。",
  "character_id": 1,
  "metadata": {
    "emotion": "happy",
    "emotionTag": "friendly"
  }
}
```

### 2. ワークフローを作成

ワークフローエディタで以下のノードを配置：

```
[Input] → [ElevenLabs] → [Nanobana] → [Output]
```

**ElevenLabsノード設定**:
- modelId: `eleven_turbo_v2_5` (デフォルト値として保存)

**Nanobanaノード設定**:
- aspectRatio: `16:9` (デフォルト値として保存)

### 3. スタジオを作成

```typescript
// POST /api/conversations/[id]/create-studio
{
  "workflowId": "workflow-123"
}
```

**作成されるワークフローステップ**:
```json
{
  "board_id": 1,
  "workflow_id": "workflow-123",
  "input_config": {
    "character_id": 1,
    "character_name": "主人公",
    "scene_prompt_en": "school rooftop at daytime...",
    "scene_prompt_ja": "晴れた日の学校の屋上...",
    "nodeOverrides": {
      "elevenlabs-1": {
        "text": "[friendly] こんにちは！今日はいい天気だね。",
        "voiceId": "ja-JP-Wavenet-A",
        "modelId": "eleven_turbo_v2_5"
      },
      "nanobana-1": {
        "prompt": "school rooftop at daytime, clear blue sky, two students chatting casually, anime style, high quality",
        "aspectRatio": "16:9",
        "selectedCharacterSheetIds": [1]
      }
    }
  }
}
```

### 4. ワークフローを実行

スタジオボードからワークフローを実行すると、`nodeOverrides` が自動的に適用され、以下のように実行されます：

- **ElevenLabsノード**:
  - テキスト: `[friendly] こんにちは！今日はいい天気だね。`
  - 音声ID: `ja-JP-Wavenet-A` (キャラクターのカスタム音声)
  - モデル: `eleven_turbo_v2_5`

- **Nanobanaノード**:
  - プロンプト: `school rooftop at daytime, clear blue sky...`
  - アスペクト比: `16:9`
  - キャラクター画像: キャラクターシート #1 の画像が自動的に使用される

## 影響範囲

### メリット

1. **手作業の削減**: 会話データからスタジオを作成した時点で、すべてのノード設定が自動的に完了
2. **データの一貫性**: 会話生成時のAI出力がそのままワークフローに反映される
3. **拡張性**: 新しいノードタイプを追加する場合も、同じパターンで実装可能

### 制限事項

- `nodeOverrides` は**上書き**されるため、スタジオ作成後にワークフローノードの設定を変更しても、ステップ実行時には `nodeOverrides` の値が優先される
- 個別にカスタマイズしたい場合は、`/form` ページから実行するか、ワークフローステップの `input_config.nodeOverrides` を直接編集する必要がある

## 関連ファイル

- `/app/api/conversations/[id]/create-studio/route.ts` - スタジオ作成API（nodeOverrides生成）
- `/app/api/workflows/execute/route.ts` - ワークフロー実行API（nodeOverridesマージ）
- `/lib/workflow/formConfigGenerator.ts` - ノード設定の一元管理
- `/types/conversation.ts` - 会話データの型定義

## 参考資料

- [CLAUDE.md](/CLAUDE.md) - アーキテクチャの原則
- [会話生成機能の拡張](/docs/conversation-generation-enhancements.md) - 感情タグ・シーンプロンプトの詳細
- [ワークフロー設定値のデフォルト値反映](/docs/workflow-config-default-values.md) - `node.data.config` のデフォルト値の仕組み
