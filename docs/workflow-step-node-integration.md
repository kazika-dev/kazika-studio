# ワークフローステップとノード接続の統合計画

## 目次
1. [現状分析](#現状分析)
2. [問題点とギャップ](#問題点とギャップ)
3. [移行計画](#移行計画)
4. [実装ロードマップ](#実装ロードマップ)
5. [技術的詳細](#技術的詳細)

---

## 現状分析

### アーキテクチャの二層構造

現在のシステムは2つの層に分かれています：

#### 1. **ワークフロー層** - ノード内の実行制御
- **場所**: `/components/workflow/WorkflowEditor.tsx`
- **データ保存**: `kazikastudio.workflows` テーブル
  - `nodes`: ノード定義の配列
  - `edges`: ノード間接続の配列
- **実行エンジン**: `/lib/workflow/executor.ts` の `executeWorkflow()`
- **状態**: ✅ **エッジ情報を完全に活用している**

**実装の詳細** (`/lib/workflow/executor.ts`):
```typescript
// 1534-1562行: collectInputData() - エッジベースの入力収集
function collectInputData(nodeId: string, nodes: Node[], edges: Edge[]) {
  // ✅ エッジ情報を使って接続元ノードの出力を取得
  const incomingEdges = edges.filter(e => e.target === nodeId);

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode?.data.output) {
      // sourceHandle に応じて適切な入力を収集
      // 例: 'image' → previousImages に追加
      // 例: 'prompt' → prompts に追加
    }
  }
}

// 1568-1596行: topologicalSort() - DAGの依存順序解決
function topologicalSort(nodes: Node[], edges: Edge[]) {
  // ✅ Kahn アルゴリズムで実行順序を決定
  // 循環参照を検出して例外をスロー
}
```

**ワークフロー実行のデータフロー**:
```
executeWorkflow(nodes, edges)
  ↓
1. topologicalSort(nodes, edges)
   → 実行順序: [node-1, node-2, node-3]
  ↓
2. for each node (順序通り):
   - collectInputData(nodeId, nodes, edges)  ← edges を参照
   - executeNode(node, inputs)
   - node.data.output に結果を保存
  ↓
3. return { outputs: {...}, errors: [] }
```

#### 2. **スタジオステップ層** - ワークフロー間の実行制御
- **場所**: `/components/studio/WorkflowStepList.tsx`
- **データ保存**: `kazikastudio.studio_board_workflow_steps` テーブル
  - `step_order`: 実行順序（0, 1, 2, ...）
  - `workflow_id`: 実行するワークフロー
  - `input_config`: ステップへの入力設定
- **実行エンジン**: `/app/api/studios/steps/[id]/execute/route.ts`
- **状態**: ❌ **エッジ情報を全く使用していない**

**ステップテーブルスキーマ** (`supabase/migrations/20251103000002_create_board_workflow_steps.sql`):
```sql
CREATE TABLE kazikastudio.studio_board_workflow_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_board_id UUID REFERENCES kazikastudio.studio_boards(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES kazikastudio.workflows(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,  -- ← 線形実行順序のみ
  input_config JSONB,
  output_data JSONB,
  execution_status TEXT DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**ステップ実行のデータフロー** (`/app/api/studios/steps/[id]/execute/route.ts`):
```typescript
// 36-844行: POST ハンドラ
export async function POST(request: Request, context: Context) {
  // 1. ステップ情報を取得
  const step = await getStepById(stepId);
  const workflow = await getWorkflowById(step.workflow_id);

  // 2. 前のステップの出力を取得
  const previousStepOutputs = await getPreviousStepOutputs(
    step.studio_board_id,
    step.step_order
  );

  // ❌ 問題: edges を参照せず、全ノード出力を返す

  // 3. 入力を構築
  const inputs = buildInputs(step.input_config, previousStepOutputs);

  // 4. ワークフローを実行
  const result = await executeWorkflow(
    workflow.nodes,
    workflow.edges,  // ← edges は渡される
    inputs
  );

  // 5. 結果を保存
  await updateStep(stepId, {
    output_data: result.outputs,
    execution_status: 'completed'
  });
}
```

**getPreviousStepOutputs の実装** (500-540行):
```typescript
// ❌ 問題のある実装: edges を参照しない
async function getPreviousStepOutputs(studioBoardId, stepOrder) {
  // 前の全ステップを取得
  const allSteps = await getStepsByBoardId(studioBoardId);
  const previousSteps = allSteps.filter(s => s.step_order < stepOrder);

  // 全ノード出力を集約
  const previousOutputs = {};
  for (const step of previousSteps) {
    if (step.execution_status === 'completed' && step.output_data) {
      Object.assign(previousOutputs, step.output_data);
      // ← すべてのノード出力を混ぜる（edges を考慮しない）
    }
  }

  return previousOutputs;
}
```

---

## 問題点とギャップ

### 1. **エッジ情報の未活用**

**具体例**: 2段階パイプライン

```
Step 0: 画像生成ワークフロー
  nodes: [
    { id: 'input-1', type: 'textInput' },
    { id: 'nanobana-1', type: 'nanobana' }
  ]
  edges: [
    { source: 'input-1', target: 'nanobana-1', sourceHandle: 'prompt' }
  ]

  実行結果:
    output_data: {
      'input-1': { prompt: 'a beautiful landscape' },
      'nanobana-1': { image: 'https://storage/.../image.png' }
    }

Step 1: 音声生成ワークフロー
  nodes: [
    { id: 'elevenlabs-1', type: 'elevenlabs' }
  ]
  edges: []  // ← 接続なし（単独ノード）

  ❌ 問題:
    previousStepOutputs = {
      'input-1': { prompt: '...' },  ← 不要
      'nanobana-1': { image: '...' }  ← 不要
    }

    → buildInputs() が previousImages に 1個の画像を含める
    → elevenlabs-1 に imageInputNodes がないため使われない
    → 無駄なデータ転送
```

### 2. **複雑なグラフ構造への対応不足**

**現状**: ステップ間は `step_order` による線形実行のみ

**問題**:
- 分岐処理ができない（例: 画像生成 → 動画A + 動画B を並列実行）
- 条件分岐ができない（例: 画像品質チェック → OK/NG で次のステップを変更）
- 再利用性が低い（同じワークフローを異なる入力で複数回実行する場合）

### 3. **データフローの不透明性**

**現状**:
```typescript
// /app/api/studios/steps/[id]/execute/route.ts:574-644行
function buildInputs(inputConfig, previousOutputs) {
  // 全 previousOutputs を収集
  const allPreviousImages = [];
  const allPreviousVideos = [];
  const allPreviousAudios = [];

  Object.values(previousOutputs).forEach(output => {
    if (output.image) allPreviousImages.push(output.image);
    if (output.video) allPreviousVideos.push(output.video);
    if (output.audio) allPreviousAudios.push(output.audio);
  });

  // ❌ 問題: どのノードからの出力かが不明
  //    → デバッグが困難
  //    → 意図しないデータ混入の可能性
}
```

---

## 移行計画

### Phase 1: ステップ間でのエッジ情報活用（後方互換性維持）

**目標**: 既存の線形実行を維持しつつ、エッジ情報を使って不要なデータ転送を削減

**実装箇所**: `/app/api/studios/steps/[id]/execute/route.ts`

#### 1.1 getPreviousStepOutputs の改善

**変更内容**: Final nodes（出力エッジがないノード）の出力のみを抽出

```typescript
// Before (500-540行):
async function getPreviousStepOutputs(studioBoardId, stepOrder) {
  const previousOutputs = {};
  for (const step of previousSteps) {
    Object.assign(previousOutputs, step.output_data);  // ← 全て
  }
  return previousOutputs;
}

// After:
async function getPreviousStepOutputs(studioBoardId, stepOrder) {
  const previousOutputs = {};

  for (const step of previousSteps) {
    if (step.execution_status !== 'completed') continue;

    // ワークフローのエッジ情報を取得
    const workflow = await getWorkflowById(step.workflow_id);
    const { nodes, edges } = workflow;

    // Final nodes を特定（出力エッジがないノード）
    const sourceNodeIds = new Set(edges.map(e => e.source));
    const finalNodeIds = nodes
      .map(n => n.id)
      .filter(id => !sourceNodeIds.has(id));

    // Final nodes の出力のみを抽出
    Object.entries(step.output_data).forEach(([nodeId, output]) => {
      if (finalNodeIds.includes(nodeId)) {
        previousOutputs[nodeId] = output;
      }
    });
  }

  return previousOutputs;
}
```

**効果**:
- ✅ 中間ノードの出力を除外（例: TextInput ノードのプロンプト）
- ✅ データ転送量の削減
- ✅ 既存のステップ実行に影響なし（後方互換性を維持）

#### 1.2 buildInputs の改善

**変更内容**: ノードIDを保持したまま入力を構築

```typescript
// Before (574-644行):
const allPreviousImages = [];
Object.values(previousOutputs).forEach(output => {
  if (output.image) allPreviousImages.push(output.image);
});

// After:
const previousImagesByNode = {};
Object.entries(previousOutputs).forEach(([nodeId, output]) => {
  if (output.image) {
    previousImagesByNode[nodeId] = output.image;
  }
});

return {
  ...inputs,
  previousImages: Object.values(previousImagesByNode),
  previousImageMetadata: previousImagesByNode,  // ← 新規追加
};
```

**効果**:
- ✅ デバッグ時にどのノードからの出力かが分かる
- ✅ 将来の拡張（ノード指定の入力選択）に備える

### Phase 2: ステップ間の明示的マッピング定義

**目標**: ユーザーがステップ間のデータフローを明示的に制御できるようにする

**UI変更**: `/components/studio/WorkflowStepList.tsx`

```tsx
// ステップ作成ダイアログに入力マッピングを追加
<AddWorkflowStepDialog
  studioId={studioId}
  existingSteps={steps}
  onSave={async (newStep) => {
    // newStep.input_config に追加:
    // {
    //   usePreviousImage: true,
    //   previousOutputNodeIds: ['nanobana-1', 'higgsfield-1'],  // ← 明示的指定
    //   workflowInputs: {...}
    // }
  }}
/>
```

**バックエンド変更**: `/app/api/studios/steps/[id]/execute/route.ts`

```typescript
function buildInputs(inputConfig, previousOutputs) {
  const inputs = { ...inputConfig };

  // 明示的なノードID指定がある場合
  if (inputConfig.previousOutputNodeIds) {
    const selectedOutputs = inputConfig.previousOutputNodeIds
      .map(nodeId => previousOutputs[nodeId])
      .filter(Boolean);

    inputs.previousImages = selectedOutputs
      .map(o => o.image)
      .filter(Boolean);
  } else {
    // フォールバック: 全 Final nodes の出力を使用
    inputs.previousImages = Object.values(previousOutputs)
      .map(o => o.image)
      .filter(Boolean);
  }

  return inputs;
}
```

**データベーススキーマ変更不要** - `input_config` JSONB に格納可能

### Phase 3: ステップ間のグラフ構造対応（将来拡張）

**目標**: ステップ自体をDAGとして管理し、分岐・並列実行を可能にする

**新規テーブル**: `studio_board_step_edges`

```sql
CREATE TABLE kazikastudio.studio_board_step_edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  studio_board_id UUID REFERENCES kazikastudio.studio_boards(id) ON DELETE CASCADE,
  source_step_id UUID REFERENCES kazikastudio.studio_board_workflow_steps(id) ON DELETE CASCADE,
  target_step_id UUID REFERENCES kazikastudio.studio_board_workflow_steps(id) ON DELETE CASCADE,
  source_node_id TEXT,  -- ソースステップ内のどのノードの出力を使うか
  target_node_id TEXT,  -- ターゲットステップ内のどのノードに入力するか
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_step_id, target_step_id, source_node_id, target_node_id)
);
```

**実行エンジンの拡張**:
```typescript
// /app/api/studios/boards/[id]/execute/route.ts (新規作成)
export async function POST(request: Request, context: Context) {
  const boardId = context.params.id;

  // 1. ステップとエッジを取得
  const steps = await getStepsByBoardId(boardId);
  const stepEdges = await getStepEdgesByBoardId(boardId);

  // 2. トポロジカルソート
  const executionOrder = topologicalSortSteps(steps, stepEdges);

  // 3. 順次実行（並列実行可能な部分は Promise.all）
  const stepOutputs = {};
  for (const stepId of executionOrder) {
    const step = steps.find(s => s.id === stepId);

    // 前のステップの出力を収集（エッジベース）
    const inputs = collectStepInputs(stepId, stepEdges, stepOutputs);

    // ステップ実行
    const result = await executeStep(step, inputs);
    stepOutputs[stepId] = result;
  }

  return { success: true, outputs: stepOutputs };
}
```

---

## 実装ロードマップ

### 優先度: High（短期: 1-2週間）

**Phase 1.1**: Final nodes のみを抽出
- [ ] `/app/api/studios/steps/[id]/execute/route.ts` の `getPreviousStepOutputs()` を修正
- [ ] テストケース作成（単一ステップ、複数ステップ、複雑なグラフ）
- [ ] 既存のスタジオで動作確認

**Phase 1.2**: メタデータの追加
- [ ] `buildInputs()` に `previousImageMetadata` を追加
- [ ] ログ出力でデバッグ情報を確認

### 優先度: Medium（中期: 2-4週間）

**Phase 2**: 明示的マッピングUI
- [ ] `AddWorkflowStepDialog.tsx` に入力ノード選択UIを追加
- [ ] ドロップダウンで前のステップの Final nodes を表示
- [ ] `input_config.previousOutputNodeIds` をバックエンドで処理

### 優先度: Low（長期: 1-2ヶ月）

**Phase 3**: ステップ間DAG対応
- [ ] マイグレーション作成 (`studio_board_step_edges` テーブル)
- [ ] UI: ステップ間のエッジをビジュアル編集可能に（React Flow?）
- [ ] バックエンド: ステップレベルのトポロジカルソート実装
- [ ] 並列実行のサポート（Promise.all）

---

## 技術的詳細

### 関連ファイル一覧

**フロントエンド**:
- `/components/studio/WorkflowStepList.tsx` - ステップ一覧UI (173行)
- `/components/studio/AddWorkflowStepDialog.tsx` - ステップ作成ダイアログ
- `/components/workflow/WorkflowEditor.tsx` - ワークフロー定義UI (1-200行)

**バックエンドAPI**:
- `/app/api/studios/steps/[id]/execute/route.ts` - ステップ実行エンジン (36-844行)
- `/app/api/studios/steps/route.ts` - ステップCRUD
- `/app/api/workflows/execute/route.ts` - ワークフロー実行API

**ライブラリ**:
- `/lib/workflow/executor.ts` - ワークフロー実行エンジン (1700行以上)
  - `executeWorkflow()` - メイン実行関数
  - `topologicalSort()` - DAG解決 (1568-1596行)
  - `collectInputData()` - エッジベース入力収集 (1534-1562行)
- `/lib/workflow/types.ts` - 型定義とユーティリティ
- `/lib/db.ts` - データベース操作関数 (375-520行)
  - `getStepById()`
  - `getStepsByBoardId()`
  - `updateStep()`

**データベース**:
- `/supabase/migrations/20251103000002_create_board_workflow_steps.sql`
- `/supabase/migrations/20250126000002_create_workflows_table.sql`

### データ構造

**Workflow (workflows テーブル)**:
```typescript
interface Workflow {
  id: string;
  name: string;
  nodes: Node[];  // ReactFlow Node[]
  edges: Edge[];  // ReactFlow Edge[]
  form_config?: FormConfig;
}

interface Edge {
  id: string;
  source: string;  // ソースノードID
  target: string;  // ターゲットノードID
  sourceHandle?: string;  // 'image' | 'video' | 'audio' | 'prompt'
  targetHandle?: string;  // 'image-0' | 'character-0' | etc.
}
```

**WorkflowStep (studio_board_workflow_steps テーブル)**:
```typescript
interface WorkflowStep {
  id: string;
  studio_board_id: string;
  workflow_id: string;
  step_order: number;  // 0, 1, 2, ...
  input_config: {
    usePrompt?: boolean;
    usePreviousImage?: boolean;
    usePreviousVideo?: boolean;
    usePreviousAudio?: boolean;
    workflowInputs?: Record<string, any>;

    // Phase 2 で追加:
    previousOutputNodeIds?: string[];  // 前のステップの出力ノードIDを明示的に指定
  };
  output_data: Record<string, any>;  // { [nodeId]: { image?, video?, audio? } }
  execution_status: 'pending' | 'running' | 'completed' | 'failed';
}
```

### 実装例: Final Nodes 抽出

```typescript
// /app/api/studios/steps/[id]/execute/route.ts

/**
 * ワークフローの Final Nodes（出力エッジがないノード）を特定
 */
function getFinalNodeIds(workflow: Workflow): string[] {
  const { nodes, edges } = workflow;

  // エッジのソースになっているノードIDを収集
  const sourceNodeIds = new Set(edges.map(e => e.source));

  // ソースになっていないノード = Final Nodes
  return nodes
    .map(n => n.id)
    .filter(id => !sourceNodeIds.has(id));
}

/**
 * 前のステップの Final Nodes の出力のみを取得
 */
async function getPreviousStepOutputs(
  studioBoardId: string,
  currentStepOrder: number
): Promise<Record<string, any>> {
  const allSteps = await getStepsByBoardId(studioBoardId);
  const previousSteps = allSteps.filter(s => s.step_order < currentStepOrder);

  const previousOutputs: Record<string, any> = {};

  for (const step of previousSteps) {
    if (step.execution_status !== 'completed' || !step.output_data) {
      continue;
    }

    // ワークフロー情報を取得
    const workflow = await getWorkflowById(step.workflow_id);
    const finalNodeIds = getFinalNodeIds(workflow);

    // Final Nodes の出力のみを抽出
    Object.entries(step.output_data).forEach(([nodeId, output]) => {
      if (finalNodeIds.includes(nodeId)) {
        previousOutputs[`${step.id}_${nodeId}`] = output;
        // ← ステップIDを含めることで、複数ステップの同じノードIDを区別
      }
    });
  }

  return previousOutputs;
}
```

---

## まとめ

### 現状
- ✅ ワークフロー内（ノード間）のエッジ情報は完全に活用されている
- ❌ ステップ間のエッジ情報は全く使用されていない
- ❌ ステップ実行時に不要なデータも転送される

### 改善後（Phase 1 実装後）
- ✅ Final nodes の出力のみを次のステップに渡す
- ✅ データ転送量が削減される
- ✅ デバッグ情報が充実する（ノードIDを保持）

### 将来拡張（Phase 2-3）
- ✅ ユーザーが入力ノードを明示的に選択可能
- ✅ ステップ間のDAG構造をサポート（分岐・並列実行）
- ✅ より柔軟で効率的なマルチステップワークフロー実行

**次のステップ**: Phase 1.1 の実装から開始することを推奨します。

---

## 実装履歴

### 2025-11-24: Phase 1 実装完了

**実装内容**:

#### 1. Final Nodes 抽出機能を追加

**新規関数** (`/app/api/studios/steps/[id]/execute/route.ts:497-514`):
```typescript
function getFinalNodeIds(nodes: any[], edges: any[]): string[] {
  // エッジのソースになっているノードIDを収集
  const sourceNodeIds = new Set(edges.map((e: any) => e.source));

  // ソースになっていないノード = Final Nodes
  return nodes
    .map((n: any) => n.id)
    .filter((id: string) => !sourceNodeIds.has(id));
}
```

#### 2. getPreviousStepOutputs() を完全リニューアル

**変更箇所** (`/app/api/studios/steps/[id]/execute/route.ts:516-600`):

**主要な変更点**:
- ✅ 前のステップのワークフロー情報（nodes, edges）を取得
- ✅ `getFinalNodeIds()` で Final Nodes を特定
- ✅ Final Nodes の出力のみを `previousOutputs` に追加
- ✅ 中間ノード（TextInput など）の出力を除外
- ✅ ステップIDを含めたキー（`${stepId}_${nodeId}`）で重複を防止
- ✅ 詳細なログ出力（✓ Final Node / ✗ Intermediate Node）

**Before**:
```typescript
// 全ノード出力を無条件に追加
Object.assign(previousOutputs, step.output_data);
```

**After**:
```typescript
// Final Nodes のみを追加
if (finalNodeIds.includes(nodeId)) {
  const outputKey = `${step.id}_${nodeId}`;
  previousOutputs[outputKey] = output;
  console.log(`  ✓ Final Node ${nodeId}: output added`);
} else {
  console.log(`  ✗ Intermediate Node ${nodeId}: skipped`);
}
```

#### 3. buildInputs() にメタデータ追加

**変更箇所** (`/app/api/studios/steps/[id]/execute/route.ts:931-1001`):

**主要な変更点**:
- ✅ 各出力タイプ（画像、動画、音声、テキスト）ごとにメタデータマップを作成
- ✅ `previousImageMetadata`, `previousVideoMetadata` などに ノードID → データ のマッピングを保存
- ✅ `inputs` に metadata フィールドを追加してトレーサビリティを向上

**追加されたメタデータ**:
```typescript
inputs.previousImageMetadata = {
  "step-123_nanobana-1": {
    imageData: "...",
    storagePath: "workflows/...",
    imageUrl: "https://..."
  },
  "step-456_higgsfield-1": { ... }
};
```

**効果**:
- デバッグ時にどのステップ・ノードからの出力かを特定可能
- 将来的に特定ノードの出力を選択する UI 実装の準備
- ログで完全なトレーサビリティを実現

#### 4. ログ出力の改善

**追加されたログ**:
```
=== getPreviousStepOutputs for step abc-123 ===
Total steps in board: 3
Current step order: 2
Found previous completed step def-456 (order: 1)
Step def-456 workflow has 3 nodes, 2 edges
Final nodes (no outgoing edges): [nanobana-1]
Step def-456 has output_data with 3 nodes
  ✓ Final Node nanobana-1: has image (storagePath: workflows/...)
  ✗ Intermediate Node textinput-1: skipped (not a final node)
  ✗ Intermediate Node textinput-2: skipped (not a final node)
Total previous outputs (final nodes only): 1
```

**影響範囲**:
- ✅ ワークフローのエッジ情報をステップ間で活用開始
- ✅ 不要なデータ転送を削減（中間ノード出力を除外）
- ✅ デバッグとトレーサビリティが大幅に向上
- ✅ 既存のステップ実行との完全な後方互換性を維持
- ⚠️ ステップIDを含むキー形式に変更（`stepId_nodeId`）

**次のステップ**: Phase 2（明示的マッピングUI）の実装に進むことができます。
