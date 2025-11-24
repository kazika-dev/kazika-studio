# ワークフローステップのノード単位実行・結果表示機能

## 目的

ワークフローステップ内で、各ノードの実行結果を個別に確認し、ノードごとに順番に実行を進められるようにする。

## 要件

### 1. ノード接続の可視化

ワークフローエディタで設定したノード接続（エッジ）をステップカード上で表示する。

**例**:
```
Step 1: シーン生成ワークフロー
  ├─ TextInput-1 (プロンプト入力) ✓ 完了
  │   └─→ Gemini-1 (プロンプト生成)
  │
  ├─ Gemini-1 (プロンプト生成) ✓ 完了
  │   └─→ Nanobana-1 (画像生成)
  │
  └─ Nanobana-1 (画像生成) ⏸ 待機中
```

### 2. ノードごとの実行制御

- **個別実行ボタン**: 各ノードに「実行」ボタンを表示
- **依存関係チェック**: 前のノードが完了していない場合は実行不可
- **自動進行モード**: 全ノードを順番に自動実行するオプション

### 3. 結果表示UI

各ノードの実行結果を展開可能なカード形式で表示。

**表示内容**:
- **入力データ**: プロンプト、前のノードからの画像など
- **実行ステータス**: 待機中 / 実行中 / 完了 / エラー
- **出力データ**:
  - 画像 → サムネイル表示
  - 動画 → 動画プレーヤー
  - 音声 → 音声プレーヤー
  - テキスト → テキスト表示
- **実行時間**: 開始時刻、終了時刻、処理時間
- **エラー情報**: エラーメッセージ、スタックトレース

---

## 現状のデータ構造

### ステップ実行結果 (`studio_board_workflow_steps`)

```typescript
interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  execution_status: 'pending' | 'running' | 'completed' | 'failed';

  // ノードごとの出力
  output_data: {
    [nodeId: string]: {
      imageData?: string;
      imageUrl?: string;
      storagePath?: string;
      videoUrl?: string;
      audioData?: string;
      text?: string;
    };
  };

  // ノードごとのリクエストボディ
  metadata: {
    execution_requests: {
      [nodeId: string]: {
        prompt?: string;
        model?: string;
        aspectRatio?: string;
        // ... その他のパラメータ
      };
    };
  };
}
```

### ワークフロー定義 (`workflows`)

```typescript
interface Workflow {
  id: string;
  nodes: Node[];  // ReactFlow Node[]
  edges: Edge[];  // ReactFlow Edge[]
}

interface Node {
  id: string;
  type: 'gemini' | 'nanobana' | 'elevenlabs' | 'higgsfield' | 'seedream4' | 'textInput' | 'imageInput';
  data: {
    label: string;
    type: string;
    config?: Record<string, any>;
  };
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;  // ソースノードID
  target: string;  // ターゲットノードID
  sourceHandle?: string;  // 'image' | 'video' | 'audio' | 'prompt'
  targetHandle?: string;  // 'image-0' | 'character-0' | etc.
}
```

---

## 実装アプローチ

### Phase 1: ノード結果の可視化（読み取り専用）

**目標**: 既存のステップ実行結果をノードごとに表示する

#### 1.1 WorkflowStepCard にノード結果セクションを追加

**UI構成**:
```
WorkflowStepCard
  ├─ ヘッダー（既存）
  ├─ 入力設定サマリー（既存）
  ├─ 全体ステータス（既存）
  │
  └─ 【新規】ノード実行結果セクション
      ├─ ノード一覧（トポロジカルソート順）
      │   ├─ NodeExecutionCard (TextInput-1)
      │   │   ├─ ノード名・タイプ
      │   │   ├─ ステータスアイコン
      │   │   ├─ 入力データ表示（展開可能）
      │   │   └─ 出力データ表示（展開可能）
      │   │
      │   ├─ EdgeVisualization (→ Gemini-1)
      │   │
      │   ├─ NodeExecutionCard (Gemini-1)
      │   │   └─ ...
      │   │
      │   └─ ...
```

**新規コンポーネント**:

**`/components/studio/NodeExecutionCard.tsx`**:
```typescript
interface NodeExecutionCardProps {
  node: Node;
  output?: any;  // output_data[nodeId]
  request?: any;  // metadata.execution_requests[nodeId]
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  executionTime?: { start: string; end: string };
}

export default function NodeExecutionCard({ node, output, request, status }: NodeExecutionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardHeader
        avatar={<NodeTypeIcon type={node.data.type} />}
        title={node.data.label || node.id}
        subheader={node.data.type}
        action={
          <>
            <StatusChip status={status} />
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </>
        }
      />

      <Collapse in={expanded}>
        <CardContent>
          {/* 入力データ表示 */}
          {request && (
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>入力</Typography>
              <RequestDataDisplay request={request} />
            </Box>
          )}

          {/* 出力データ表示 */}
          {output && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>出力</Typography>
              <OutputDataDisplay output={output} nodeType={node.data.type} />
            </Box>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
}
```

**`/components/studio/OutputDataDisplay.tsx`**:
```typescript
interface OutputDataDisplayProps {
  output: any;
  nodeType: string;
}

export default function OutputDataDisplay({ output, nodeType }: OutputDataDisplayProps) {
  // 画像出力
  if (output.imageData || output.imageUrl || output.storagePath) {
    return <ImageOutput output={output} />;
  }

  // 動画出力
  if (output.videoUrl) {
    return <VideoOutput url={output.videoUrl} />;
  }

  // 音声出力
  if (output.audioData) {
    return <AudioOutput data={output.audioData} />;
  }

  // テキスト出力
  if (output.text) {
    return <TextOutput text={output.text} />;
  }

  return <Typography variant="body2" color="text.secondary">出力なし</Typography>;
}
```

#### 1.2 WorkflowStepCard の修正

**変更箇所**: `/components/studio/WorkflowStepCard.tsx`

```typescript
export default function WorkflowStepCard({ step, ... }: WorkflowStepCardProps) {
  const [workflowNodes, setWorkflowNodes] = useState<Node[]>([]);
  const [workflowEdges, setWorkflowEdges] = useState<Edge[]>([]);

  // ワークフロー情報を取得
  useEffect(() => {
    const loadWorkflow = async () => {
      if (expanded && step.workflow_id) {
        const response = await fetch(`/api/workflows/${step.workflow_id}`);
        const data = await response.json();

        if (data.workflow) {
          setWorkflowNodes(data.workflow.nodes);
          setWorkflowEdges(data.workflow.edges);
        }
      }
    };

    loadWorkflow();
  }, [expanded, step.workflow_id]);

  // トポロジカルソートで実行順序を取得
  const sortedNodeIds = useMemo(() => {
    if (workflowNodes.length === 0) return [];
    return topologicalSort(workflowNodes, workflowEdges);
  }, [workflowNodes, workflowEdges]);

  return (
    <Card>
      {/* 既存のヘッダーなど */}

      <Collapse in={expanded}>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>ノード実行結果</Typography>

          {sortedNodeIds.map((nodeId, index) => {
            const node = workflowNodes.find(n => n.id === nodeId);
            const output = detailedStep.output_data?.[nodeId];
            const request = detailedStep.metadata?.execution_requests?.[nodeId];

            // ノードのステータスを判定
            const nodeStatus = output ? 'completed' :
                             step.execution_status === 'failed' ? 'failed' :
                             'pending';

            return (
              <Box key={nodeId}>
                <NodeExecutionCard
                  node={node}
                  output={output}
                  request={request}
                  status={nodeStatus}
                />

                {/* 次のノードへの接続を表示 */}
                {index < sortedNodeIds.length - 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                    <ArrowDownwardIcon color="action" />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Card>
  );
}
```

**必要なユーティリティ関数**:

```typescript
// /lib/workflow/topologicalSort.ts (既存のものを再利用)
export function topologicalSort(nodes: Node[], edges: Edge[]): string[] {
  // 既存の実装を使用（/lib/workflow/types.ts:23-69）
}
```

---

### Phase 2: ノード単位の実行制御

**目標**: ノードを個別に実行できるようにする

#### 2.1 ノード単位実行API

**新規エンドポイント**: `/api/studios/steps/[id]/execute-node`

```typescript
// POST /api/studios/steps/[stepId]/execute-node
// Body: { nodeId: string }

export async function POST(request: NextRequest, context: Context) {
  const stepId = context.params.id;
  const { nodeId } = await request.json();

  // 1. ステップとワークフローを取得
  const step = await getStepById(stepId);
  const workflow = await getWorkflowById(step.workflow_id);

  // 2. 実行対象ノードを取得
  const node = workflow.nodes.find(n => n.id === nodeId);
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  }

  // 3. 依存ノードの出力を収集
  const inputs = collectNodeInputs(nodeId, workflow.edges, step.output_data);

  // 4. ノードを実行
  const result = await executeNode(node, inputs);

  // 5. 結果を保存（部分更新）
  const updatedOutputData = {
    ...(step.output_data || {}),
    [nodeId]: result.output,
  };

  await updateStep(stepId, {
    output_data: updatedOutputData,
    metadata: {
      ...(step.metadata || {}),
      execution_requests: {
        ...(step.metadata?.execution_requests || {}),
        [nodeId]: result.requestBody,
      },
      node_execution_times: {
        ...(step.metadata?.node_execution_times || {}),
        [nodeId]: {
          start: result.startTime,
          end: result.endTime,
          duration: result.duration,
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    nodeId,
    output: result.output,
  });
}

// 依存ノードの出力を収集
function collectNodeInputs(nodeId: string, edges: Edge[], outputData: any): any {
  const incomingEdges = edges.filter(e => e.target === nodeId);
  const inputs: any = {};

  for (const edge of incomingEdges) {
    const sourceOutput = outputData[edge.source];
    if (sourceOutput) {
      // sourceHandle に応じて入力を追加
      if (edge.sourceHandle === 'image') {
        inputs.previousImages = inputs.previousImages || [];
        inputs.previousImages.push(sourceOutput);
      } else if (edge.sourceHandle === 'prompt') {
        inputs.prompt = sourceOutput.text || sourceOutput.prompt;
      }
    }
  }

  return inputs;
}
```

#### 2.2 NodeExecutionCard に実行ボタンを追加

```typescript
export default function NodeExecutionCard({
  node,
  output,
  request,
  status,
  stepId,
  canExecute,  // 依存ノードが完了しているか
  onExecute,   // 実行ハンドラー
}: NodeExecutionCardProps) {
  const [executing, setExecuting] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(node.id);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        action={
          <>
            {/* 実行ボタン */}
            {status === 'pending' && canExecute && (
              <Button
                size="small"
                variant="contained"
                startIcon={executing ? <CircularProgress size={16} /> : <PlayArrow />}
                onClick={handleExecute}
                disabled={executing}
              >
                実行
              </Button>
            )}
            <StatusChip status={status} />
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </>
        }
      />
      {/* ... */}
    </Card>
  );
}
```

#### 2.3 WorkflowStepCard に実行制御を統合

```typescript
export default function WorkflowStepCard({ step, ... }: WorkflowStepCardProps) {
  // ノードの実行可能状態を計算
  const nodeExecutableStates = useMemo(() => {
    const states: Record<string, boolean> = {};

    for (const nodeId of sortedNodeIds) {
      // 依存ノード（入力エッジのソース）がすべて完了しているか
      const dependencies = workflowEdges
        .filter(e => e.target === nodeId)
        .map(e => e.source);

      const allDependenciesCompleted = dependencies.every(
        depId => detailedStep.output_data?.[depId]
      );

      states[nodeId] = allDependenciesCompleted;
    }

    return states;
  }, [sortedNodeIds, workflowEdges, detailedStep.output_data]);

  // ノード実行ハンドラー
  const handleExecuteNode = async (nodeId: string) => {
    try {
      const response = await fetch(`/api/studios/steps/${step.id}/execute-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });

      const data = await response.json();

      if (data.success) {
        // ステップデータをリフレッシュ
        const updatedStep = await fetch(`/api/studios/steps/${step.id}`).then(r => r.json());
        setDetailedStep(updatedStep.step);
        onUpdate(updatedStep.step);
      }
    } catch (error) {
      console.error('Failed to execute node:', error);
    }
  };

  return (
    <Card>
      {/* ... */}

      {sortedNodeIds.map((nodeId) => (
        <NodeExecutionCard
          key={nodeId}
          node={workflowNodes.find(n => n.id === nodeId)}
          output={detailedStep.output_data?.[nodeId]}
          request={detailedStep.metadata?.execution_requests?.[nodeId]}
          status={getNodeStatus(nodeId)}
          stepId={step.id}
          canExecute={nodeExecutableStates[nodeId]}
          onExecute={handleExecuteNode}
        />
      ))}
    </Card>
  );
}
```

---

## 実装ロードマップ

### Phase 1: ノード結果の可視化（1週間）

- [ ] `NodeExecutionCard` コンポーネントを作成
- [ ] `OutputDataDisplay` コンポーネントを作成（画像、動画、音声、テキスト対応）
- [ ] `WorkflowStepCard` にノード結果セクションを追加
- [ ] トポロジカルソート順でノードを表示
- [ ] 既存のステップ実行結果で動作確認

### Phase 2: ノード単位の実行制御（1週間）

- [ ] `/api/studios/steps/[id]/execute-node` エンドポイントを作成
- [ ] `collectNodeInputs()` 関数を実装（エッジベースの入力収集）
- [ ] `NodeExecutionCard` に実行ボタンを追加
- [ ] 依存関係チェック機能を実装
- [ ] 実行後のステップデータ更新処理

### Phase 3: UX改善（追加機能）

- [ ] 自動進行モード（全ノードを順番に自動実行）
- [ ] ノード実行のキャンセル機能
- [ ] 実行時間の表示
- [ ] エラー時のリトライ機能
- [ ] ノード実行履歴の表示

---

## 技術的詳細

### ノードステータスの判定ロジ��

```typescript
function getNodeStatus(
  nodeId: string,
  outputData: Record<string, any>,
  executionStatus: string,
  currentlyExecuting?: string
): 'pending' | 'running' | 'completed' | 'failed' {
  // 現在実行中
  if (currentlyExecuting === nodeId) {
    return 'running';
  }

  // 出力がある = 完了
  if (outputData[nodeId]) {
    return 'completed';
  }

  // ステップ全体が失敗している場合
  if (executionStatus === 'failed') {
    return 'failed';
  }

  // それ以外は待機中
  return 'pending';
}
```

### エッジベースの入力収集（既存の collectInputData を再利用）

`/lib/workflow/executor.ts:1534-1562` の `collectInputData()` を部分的に使用。

---

## まとめ

この実装により、以下が可能になります：

1. **ノード接続の可視化**: ワークフローエディタで設定した接続がステップカード上で確認できる
2. **ノードごとの結果確認**: 各ノードの入力・出力・ステータスを個別に表示
3. **段階的な実行**: ノードを一つずつ実行して結果を確認しながら進められる
4. **デバッグ容易性**: どのノードで問題が発生したかが明確になる

**次のステップ**: Phase 1（ノード結果の可視化）から実装を開始することを推奨します。

---

## 実装履歴

### 2025-11-24: Phase 1 実装完了 - ノード結果の可視化

**実装内容**:

#### 1. 新規コンポーネントの作成

**`NodeExecutionCard.tsx`** (`/components/studio/NodeExecutionCard.tsx`):
- ノードごとの実行結果を表示するカードコンポーネント
- ノードタイプ別のアイコン表示（Gemini, Nanobana, ElevenLabsなど）
- ステータスチップ（完了/実行中/待機中/失敗）
- 展開可能な詳細セクション:
  - 入力データ（JSON形式）
  - 出力データ（OutputDataDisplay経由）
  - エラーメッセージ

**`OutputDataDisplay.tsx`** (`/components/studio/OutputDataDisplay.tsx`):
- 出力データタイプに応じた適切な表示:
  - 画像 → サムネイル + クリックで拡大ダイアログ
  - 動画 → 動画プレーヤー（controls付き）
  - 音声 → 音声プレーヤー（controls付き）
  - テキスト → プレーンテキスト表示
  - その他 → JSON形式のフォールバック
- Next.js Image コンポーネントを使用した最適化

**`topologicalSort.ts`** (`/lib/workflow/topologicalSort.ts`):
- Kahnアルゴリズムによるトポロジカルソート実装
- ワークフローのノードを依存関係に基づいて実行順序にソート
- 循環参照の検出とフォールバック処理

#### 2. WorkflowStepCard の拡張

**追加機能**:
- ワークフロー情報（nodes, edges）の動的取得
- トポロジカルソートによる実行順序の計算
- ノードステータスの判定ロジック
- 「ノード実行結果」セクションの追加

**UI構成**:
```
WorkflowStepCard（展開時）
  ├─ 入力設定のサマリー（既存）
  ├─ ノード設定（既存）
  ├─ ワークフロー入力（既存）
  ├─ 実行時のAPIリクエスト（既存）
  │
  └─ 【新規】ノード実行結果
      ├─ ヘッダー（ノード数表示）
      ├─ NodeExecutionCard (TextInput-1)
      │   ├─ ノード名・タイプ
      │   ├─ ステータスチップ
      │   ├─ 入力データ
      │   └─ 出力データ
      ├─ ↓（矢印アイコン）
      ├─ NodeExecutionCard (Gemini-1)
      ├─ ↓
      └─ NodeExecutionCard (Nanobana-1)
```

**実装の詳細** (`/components/studio/WorkflowStepCard.tsx`):

```typescript
// ワークフロー情報を取得（展開時に1回のみ）
useEffect(() => {
  if (expanded && step.workflow_id && workflowNodes.length === 0) {
    const response = await fetch(`/api/workflows/${step.workflow_id}`);
    const data = await response.json();
    setWorkflowNodes(data.workflow.nodes);
    setWorkflowEdges(data.workflow.edges);
  }
}, [expanded, step.workflow_id]);

// トポロジカルソートで実行順序を取得
const sortedNodeIds = useMemo(() => {
  return topologicalSort(workflowNodes, workflowEdges);
}, [workflowNodes, workflowEdges]);

// ノードのステータスを判定
const getNodeStatus = (nodeId: string) => {
  if (detailedStep.output_data?.[nodeId]) return 'completed';
  if (step.execution_status === 'failed') return 'failed';
  return 'pending';
};

// ノードカードを順番に表示
{sortedNodeIds.map((nodeId, index) => {
  const node = workflowNodes.find(n => n.id === nodeId);
  const output = detailedStep.output_data?.[nodeId];
  const request = detailedStep.metadata?.execution_requests?.[nodeId];

  return (
    <NodeExecutionCard
      node={node}
      output={output}
      request={request}
      status={getNodeStatus(nodeId)}
    />
  );
})}
```

#### 3. データフロー

```
ユーザーがステップカードを展開
  ↓
1. ワークフロー情報を取得
   GET /api/workflows/{workflow_id}
   → nodes, edges を取得
  ↓
2. トポロジカルソートで実行順序を計算
   topologicalSort(nodes, edges)
   → [textinput-1, gemini-1, nanobana-1]
  ↓
3. 各ノードの状態を判定
   output_data[nodeId] の有無で completed/pending を判定
  ↓
4. NodeExecutionCard を順番に表示
   - 入力データ: metadata.execution_requests[nodeId]
   - 出力データ: output_data[nodeId]
   - ステータス: completed/pending/failed
```

**効果**:
- ✅ ワークフローのノード接続が視覚的に確認できる
- ✅ 各ノードの入力・出力・ステータスを個別に表示
- ✅ トポロジカルソート順で依存関係が明確
- ✅ 画像・動画・音声の出力を適切に表示
- ✅ 既存の「出力データ」セクションも後方互換性を維持

---

## Phase 2: ノード単位の実行制御（実装完了）

**実装日**: 2025-11-24

### 実装内容

#### 1. ノード単位実行API (`/app/api/studios/steps/[id]/execute-node/route.ts`)

特定のステップ内の特定のノードのみを実行するAPIエンドポイントを作成しました。

**主要機能**:
- ノードIDを指定して個別に実行
- エッジベースの入力収集（`collectNodeInputs()` 関数）
- 実行結果を `step.output_data[nodeId]` に部分更新
- 実行リクエストを `step.metadata.execution_requests[nodeId]` に保存
- 実行時間を `step.metadata.node_execution_times[nodeId]` に記録

**`collectNodeInputs()` 関数**:
```typescript
function collectNodeInputs(
  nodeId: string,
  edges: any[],
  outputData: Record<string, any>
): any {
  const inputs: any = {};

  // このノードへの入力エッジを取得
  const incomingEdges = edges.filter((e: any) => e.target === nodeId);

  for (const edge of incomingEdges) {
    const sourceNodeId = edge.source;
    const sourceOutput = outputData[sourceNodeId];

    if (!sourceOutput) continue;

    // sourceHandle に応じて入力を分類
    const sourceHandle = edge.sourceHandle;

    if (sourceHandle === 'image' || sourceOutput.imageData || sourceOutput.imageUrl) {
      inputs.previousImages = inputs.previousImages || [];
      inputs.previousImages.push({
        imageData: sourceOutput.imageData,
        imageUrl: sourceOutput.imageUrl,
        storagePath: sourceOutput.storagePath,
      });
    } else if (sourceHandle === 'prompt' || sourceOutput.text || sourceOutput.prompt) {
      const promptText = sourceOutput.text || sourceOutput.prompt || sourceOutput.response;
      if (!inputs.prompt) {
        inputs.prompt = promptText;
      } else {
        inputs.prompt += '\n' + promptText;
      }
    }
    // video, audio も同様に処理
  }

  return inputs;
}
```

#### 2. ノード実行ロジック (`/lib/workflow/nodeExecutor.ts`)

各ノードタイプの実行ロジックを `/lib/workflow/executor.ts` から抽出し、単一ノード実行に対応しました。

**対応ノードタイプ**:
- `textInput` - テキスト入力ノード
- `imageInput` - 画像入力ノード
- `gemini` - Gemini AIノード
- `nanobana` - Nanobana画像生成ノード
- `elevenlabs` - ElevenLabs音声生成ノード
- `higgsfield` - Higgsfield動画生成ノード
- `seedream4` - Seedream4動画生成ノード

**実行結果インターフェース**:
```typescript
interface NodeExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  requestBody?: any;
}
```

#### 3. 実行ボタンとUI更新 (`NodeExecutionCard.tsx`)

NodeExecutionCardコンポーネントに実行ボタンとローディング状態を追加しました。

**追加したプロップス**:
```typescript
interface NodeExecutionCardProps {
  node: Node;
  output?: any;
  request?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  canExecute?: boolean;  // 依存ノードが完了しているか
  onExecute?: (nodeId: string) => Promise<void>;  // 実行ハンドラー
  stepId?: string;  // ステップID
}
```

**実行ボタン**:
```typescript
{status === 'pending' && canExecute && onExecute && (
  <Button
    size="small"
    variant="contained"
    color="primary"
    startIcon={executing ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
    onClick={handleExecute}
    disabled={executing}
    sx={{ minWidth: 80 }}
  >
    {executing ? '実行中' : '実行'}
  </Button>
)}
```

#### 4. 依存関係チェック (`WorkflowStepCard.tsx`)

各ノードの実行可否を判定する `nodeExecutableStates` を追加しました。

**依存関係チェックロジック**:
```typescript
const nodeExecutableStates = useMemo(() => {
  const states: Record<string, boolean> = {};

  for (const nodeId of sortedNodeIds) {
    // このノードへの入力エッジを取得
    const dependencies = workflowEdges
      .filter((e) => e.target === nodeId)
      .map((e) => e.source);

    // すべての依存ノードが完了しているかチェック
    const allDependenciesCompleted = dependencies.every(
      (depId) => detailedStep.output_data?.[depId]
    );

    states[nodeId] = allDependenciesCompleted;
  }

  return states;
}, [sortedNodeIds, workflowEdges, detailedStep.output_data]);
```

**実行ハンドラー**:
```typescript
const handleExecuteNode = async (nodeId: string) => {
  try {
    const response = await fetch(`/api/studios/steps/${step.id}/execute-node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId }),
    });

    const data = await response.json();

    if (!data.success) {
      console.error('Node execution failed:', data.error);
      return;
    }

    console.log('Node execution succeeded:', data);

    // ステップ詳細を再取得して表示を更新
    await fetchStepDetails();
  } catch (error) {
    console.error('Error executing node:', error);
  }
};
```

**NodeExecutionCardに渡すプロップス**:
```typescript
<NodeExecutionCard
  node={node}
  output={output}
  request={request}
  status={nodeStatus}
  error={nodeStatus === 'failed' ? step.error_message || undefined : undefined}
  canExecute={nodeExecutableStates[nodeId]}
  onExecute={handleExecuteNode}
  stepId={step.id.toString()}
/>
```

### データフロー

```
ユーザーが「実行」ボタンをクリック
  ↓
1. handleExecuteNode(nodeId) が呼び出される
  ↓
2. POST /api/studios/steps/{stepId}/execute-node
   Body: { nodeId: "nanobana-1" }
  ↓
3. API側の処理:
   a. ステップ情報を取得
   b. ワークフロー情報（nodes, edges）を取得
   c. collectNodeInputs() で依存ノードの出力を収集
   d. executeNode() でノードを実行
   e. 結果を step.output_data[nodeId] に保存
   f. メタデータ（request, execution_time）を保存
  ↓
4. 成功レスポンス:
   {
     success: true,
     nodeId: "nanobana-1",
     output: { imageUrl: "...", storagePath: "..." },
     executionTime: { start: "...", end: "..." }
   }
  ↓
5. fetchStepDetails() でステップ情報を再取得
  ↓
6. UI更新:
   - ノードステータスが 'pending' → 'completed' に変化
   - 出力データが表示される
   - 次のノードの実行ボタンが有効化される
```

### 効果

- ✅ ノード単位で実行ボタンが表示される
- ✅ 依存関係を自動チェック（依存ノードが未完了の場合は実行不可）
- ✅ 実行中はローディング表示
- ✅ 実行後は自動的に結果が表示される
- ✅ 次のノードの実行ボタンが自動的に有効化される
- ✅ エッジベースの入力収集で正確なデータフローを実現
- ✅ 部分更新により既存の出力データを保持

### 使用例

**ワークフロー構成**: TextInput → Gemini → Nanobana

1. **初期状態**:
   - TextInput: 完了済み（入力データあり）
   - Gemini: 実行可能（依存ノードが完了）
   - Nanobana: 実行不可（Geminiが未完了）

2. **Geminiを実行**:
   - ユーザーが「実行」ボタンをクリック
   - TextInputの出力（prompt）を使用してGemini APIを呼び出し
   - 生成されたテキストを `output_data["gemini-1"]` に保存
   - Geminiのステータスが「完了」に変化

3. **Nanobanaが実行可能に**:
   - Geminiが完了したため、Nanobanaの実行ボタンが有効化
   - ユーザーが「実行」ボタンをクリック
   - Geminiの出力（prompt）を使用してNanobana APIを呼び出し
   - 生成された画像を `output_data["nanobana-1"]` に保存
   - Nanobanaのステータスが「完了」に変化

**実装完了**: Phase 2のノード単位実行制御機能が完全に実装され、動作可能な状態になりました。
