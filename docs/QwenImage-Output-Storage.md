# QwenImage 出力をアウトプット一覧に表示する方法

## 概要

QwenImageノードの画像生成結果を `/outputs` ページに表示するためのDB保存方法について説明します。

## データフロー

```
QwenImageノード実行
  ↓
kazikastudio.comfyui_queues にキュー登録
  - comfyui_workflow_name: 'qwen_image'
  - prompt: プロンプト
  - img_gcp_storage_paths: 参照画像パス（配列）
  - status: 'pending'
  ↓
ワーカープロセスが処理
  - Qwen APIで画像生成
  - GCP Storageにアップロード
  - output_gcp_storage_paths に保存
  - status: 'completed'
  ↓
QwenImageNode がポーリングで確認
  - GET /api/qwen-image/[id]
  - output_gcp_storage_paths から署名付きURLを取得
  - ノードに画像を表示
  ↓
workflow_outputs テーブルに保存
  - output_type: 'image'
  - content_url: GCP Storageパス
  - prompt: 使用したプロンプト
  ↓
/outputs ページで表示
```

## 実装箇所

### 1. ステップ実行時の出力保存

**ファイル**: `/workspaces/kazika-studio/app/api/studios/steps/[id]/execute/route.ts`

#### 1-1. ステップ詳細記録用（全ノード）

```typescript
// 177-192行目
// 画像URL出力
if (output.imageUrl) {
  await createWorkflowOutput({
    user_id: user.id,
    workflow_id: step.workflow_id,
    step_id: step.id,
    output_type: 'image',
    node_id: nodeId,
    output_url: output.imageUrl,
    metadata: {
      jobId: output.jobId,
      nodeId: output.nodeId,
    },
  });
  console.log(`Saved image URL output for node ${nodeId}`);
}
```

#### 1-2. アウトプット一覧表示用（最終ノードのみ）

```typescript
// 278-304行目（修正後）
if (nodeType === 'nanobana' || nodeType === 'higgsfield' || nodeType === 'seedream4' || nodeType === 'qwenImage') {
  // 画像生成ノード
  const contentUrl = output.storagePath || output.imageUrl;
  if (contentUrl) {
    const insertData: any = {
      user_id: user.id,
      workflow_id: step.workflow_id,
      output_type: 'image',
      content_url: contentUrl,
      prompt: prompt,
      metadata: {
        nodeId,
        nodeType,
        nodeName: node?.data?.config?.name,
        aspectRatio: node?.data?.config?.aspectRatio,
        stepId: step.id,
        boardId: step.board_id,
      },
    };

    savePromises.push(
      supabase.from('workflow_outputs').insert(insertData).select()
    );
  }
}
```

### 2. executor.ts での output 構造

**ファイル**: `/workspaces/kazika-studio/lib/workflow/executor.ts`

```typescript
// QwenImageノードのexecutor処理（1149-1160行目）
output = {
  queueItemId: qwenResult.queueItemId,
  status: 'queued',
  nodeId: node.id,
};

// ポーリング完了後、QwenImageNodeで更新される
// imageUrl: 署名付きURL
```

### 3. QwenImageNode でのステート更新

**ファイル**: `/workspaces/kazika-studio/components/workflow/QwenImageNode.tsx`

```typescript
// 123-140行目
if (result.status === 'completed') {
  // 完了
  const successEvent = new CustomEvent('update-node', {
    detail: {
      id,
      updates: {
        config: {
          ...data.config,
          status: 'success',
          imageUrl: result.imageUrl || null, // ← これがworkflow_outputsに保存される
        },
      },
    },
  });
  window.dispatchEvent(successEvent);
  setIsExecuting(false);
  setPollingCount(0);
  setElapsedTime(0);
}
```

## workflow_outputs テーブルのスキーマ

```sql
CREATE TABLE workflow_outputs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id INTEGER NOT NULL,
  step_id INTEGER,
  output_type TEXT NOT NULL,  -- 'image', 'video', 'audio', 'text'
  content_url TEXT,            -- GCP Storageパスまたは署名付きURL
  content_text TEXT,
  prompt TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## QwenImage 出力データの例

### executor の output
```json
{
  "queueItemId": 123,
  "status": "queued",
  "nodeId": "node-1234567890"
}
```

### QwenImageNode 更新後の config
```json
{
  "name": "Qwen ノード1",
  "description": "Qwenで画像を生成します",
  "prompt": "高品質な画像で\n\n森の中の小さな家",
  "status": "success",
  "imageUrl": "https://storage.googleapis.com/bucket/kazika/output/image-xxx.png?X-Goog-Algorithm=...",
  "queueItemId": 123
}
```

### workflow_outputs への保存データ
```json
{
  "user_id": "user-uuid",
  "workflow_id": 42,
  "output_type": "image",
  "content_url": "kazika/output/image-xxx.png",  // または署名付きURL
  "prompt": "高品質な画像で\n\n森の中の小さな家",
  "metadata": {
    "nodeId": "node-1234567890",
    "nodeType": "qwenImage",
    "nodeName": "Qwen ノード1",
    "stepId": 10,
    "boardId": 5
  }
}
```

## 実装チェックリスト

- [x] `formConfigGenerator.ts` に qwenImage フィールド追加
- [x] `executor.ts` に qwenImage ケース追加
- [x] `steps/[id]/execute/route.ts` の nodeType チェックに 'qwenImage' 追加
- [x] QwenImageNode のポーリング処理実装
- [x] QwenImageNode の imageUrl ステート管理
- [ ] ワーカープロセスで output_gcp_storage_paths に保存
- [ ] GET /api/qwen-image/[id] で署名付きURL生成

## 注意事項

1. **最終ノード判定**: QwenImageノードがワークフローの最終ノード（出力エッジがないノード）の場合のみ、workflow_outputsに保存される

2. **署名付きURL**: GCP Storageパスから署名付きURLを生成する必要がある（24時間有効）

3. **ポーリング**: QwenImageNodeは5秒ごとに最大60回（5分間）ポーリングする

4. **エラーハンドリング**: ポーリングタイムアウトや画像生成失敗時の処理が必要

## 参考

- ComfyUIノード: `/workspaces/kazika-studio/components/workflow/ComfyUINode.tsx`
- Nanobanaノード出力処理: `steps/[id]/execute/route.ts` 278-304行目
- DB関数: `/workspaces/kazika-studio/lib/db.ts`
