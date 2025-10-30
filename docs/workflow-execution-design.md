# ワークフロー実行画面 設計書

## 1. 概要

本設計書は、Kazika Studioにおけるワークフロー実行機能の実装について定義します。現在、個別のGeminiノードは実行可能ですが、ワークフロー全体を順次実行する機能が不足しています。本設計により、ユーザーは作成したワークフローを一括で実行し、その進捗と結果を視覚的に確認できるようになります。

## 2. 現状の課題

### 2.1 既存機能
- ワークフローの作成・編集・保存・削除
- React Flowによる視覚的なワークフローデザイン
- 個別のGeminiノードの手動実行
- ノードタイプ: `input`, `process`, `output`, `gemini`

### 2.2 不足している機能
- ワークフロー全体の一括実行機能
- ノード間のデータフロー管理
- 実行順序の自動解決（トポロジカルソート）
- 実行状態の可視化
- 実行ログ・履歴の管理
- エラーハンドリングと回復機能

## 3. システムアーキテクチャ

### 3.1 技術スタック
- **フロントエンド**: Next.js 16, React 19, TypeScript
- **UI**: React Flow, Material-UI, Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: Supabase (PostgreSQL)
- **AI**: Google Gemini API

### 3.2 アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                     ワークフロー実行画面                       │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 実行コントロール    │  │ 実行ログビュー      │                │
│  │ - 実行ボタン       │  │ - リアルタイムログ   │                │
│  │ - 停止ボタン       │  │ - エラー表示       │                │
│  │ - 実行状態表示     │  │ - 実行時間         │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌─────────────────────────────────────────┐                │
│  │        ワークフローキャンバス               │                │
│  │  ┌────┐    ┌────┐    ┌────┐           │                │
│  │  │Node│───▶│Node│───▶│Node│           │                │
│  │  └────┘    └────┘    └────┘           │                │
│  │   (実行状態を色で表示)                  │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                           ▼
              ┌─────────────────────────┐
              │  Workflow Execution API  │
              │  /api/workflows/execute  │
              └─────────────────────────┘
                           ▼
              ┌─────────────────────────┐
              │   実行エンジン            │
              │  - トポロジカルソート      │
              │  - データフロー管理        │
              │  - ノード実行制御          │
              │  - エラーハンドリング      │
              └─────────────────────────┘
                           ▼
              ┌─────────────────────────┐
              │   Supabase Database      │
              │  - workflow_executions   │
              │  - execution_logs        │
              └─────────────────────────┘
```

## 4. データベース設計

### 4.1 新規テーブル

#### workflow_executions
ワークフローの実行履歴を管理

```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  execution_data JSONB, -- 実行時のワークフローのスナップショット
  result JSONB, -- 実行結果
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
```

#### execution_logs
個別ノードの実行ログを管理

```sql
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  node_id VARCHAR(255) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  input JSONB,
  output JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX idx_execution_logs_node_id ON execution_logs(node_id);
```

### 4.2 RLS (Row Level Security) ポリシー

```sql
-- workflow_executions
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workflow executions"
ON workflow_executions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workflow executions"
ON workflow_executions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflow executions"
ON workflow_executions FOR UPDATE
USING (auth.uid() = user_id);

-- execution_logs
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their own executions"
ON execution_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workflow_executions
    WHERE workflow_executions.id = execution_logs.execution_id
    AND workflow_executions.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert execution logs"
ON execution_logs FOR INSERT
WITH CHECK (true); -- サーバーサイドで制御
```

## 5. API設計

### 5.1 ワークフロー実行API

#### POST /api/workflows/[id]/execute
ワークフローの実行を開始

**リクエスト:**
```json
{
  "inputData": {
    "nodeId": "any input data"
  }
}
```

**レスポンス (成功):**
```json
{
  "success": true,
  "executionId": "uuid",
  "status": "running"
}
```

**レスポンス (エラー):**
```json
{
  "success": false,
  "error": "Error message"
}
```

#### GET /api/workflows/[id]/executions
ワークフローの実行履歴を取得

**クエリパラメータ:**
- `limit`: 取得件数（デフォルト: 10）
- `offset`: オフセット（デフォルト: 0）

**レスポンス:**
```json
{
  "success": true,
  "executions": [
    {
      "id": "uuid",
      "workflowId": "uuid",
      "status": "completed",
      "startedAt": "2024-01-01T00:00:00Z",
      "completedAt": "2024-01-01T00:01:00Z",
      "result": {}
    }
  ],
  "total": 100
}
```

#### GET /api/workflows/[id]/executions/[executionId]
特定の実行の詳細とログを取得

**レスポンス:**
```json
{
  "success": true,
  "execution": {
    "id": "uuid",
    "workflowId": "uuid",
    "status": "completed",
    "startedAt": "2024-01-01T00:00:00Z",
    "completedAt": "2024-01-01T00:01:00Z",
    "logs": [
      {
        "nodeId": "node-1",
        "nodeType": "gemini",
        "status": "completed",
        "startedAt": "2024-01-01T00:00:00Z",
        "completedAt": "2024-01-01T00:00:30Z",
        "input": {},
        "output": {},
        "error": null
      }
    ]
  }
}
```

#### POST /api/workflows/[id]/executions/[executionId]/cancel
実行中のワークフローをキャンセル

**レスポンス:**
```json
{
  "success": true,
  "message": "Execution cancelled"
}
```

## 6. 実行エンジン設計

### 6.1 実行フロー

```
1. 実行開始
   ↓
2. ワークフロー検証
   - ノードの存在確認
   - エッジの整合性確認
   - 循環参照チェック
   ↓
3. トポロジカルソート
   - 実行順序の決定
   - 並列実行可能なノードの特定
   ↓
4. 実行レコード作成
   - workflow_executions テーブルに挿入
   ↓
5. ノード順次実行
   For each node:
     a. execution_logs レコード作成
     b. 前ノードの出力を入力として受け取る
     c. ノードタイプに応じた処理実行
     d. 出力を次ノードへ渡す
     e. ログを更新
   ↓
6. 実行完了
   - 実行レコード更新
   - 最終結果を保存
```

### 6.2 トポロジカルソート実装

```typescript
interface WorkflowNode {
  id: string;
  type: string;
  data: any;
}

interface WorkflowEdge {
  source: string;
  target: string;
}

function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // グラフ構築
  nodes.forEach(node => {
    graph.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    graph.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  // トポロジカルソート
  const queue: string[] = [];
  const result: string[] = [];

  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    graph.get(nodeId)?.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // 循環参照チェック
  if (result.length !== nodes.length) {
    throw new Error('Circular dependency detected in workflow');
  }

  return result;
}
```

### 6.3 ノード実行処理

```typescript
interface ExecutionContext {
  executionId: string;
  nodeOutputs: Map<string, any>;
  userId: string;
}

async function executeNode(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<any> {
  // ログレコード作成
  const logId = await createExecutionLog(context.executionId, node.id, 'running');

  try {
    let result: any;

    switch (node.data.type) {
      case 'input':
        result = await executeInputNode(node, context);
        break;

      case 'process':
        result = await executeProcessNode(node, context);
        break;

      case 'output':
        result = await executeOutputNode(node, context);
        break;

      case 'gemini':
        result = await executeGeminiNode(node, context);
        break;

      default:
        throw new Error(`Unknown node type: ${node.data.type}`);
    }

    // 成功ログ更新
    await updateExecutionLog(logId, 'completed', result);

    return result;
  } catch (error) {
    // エラーログ更新
    await updateExecutionLog(logId, 'failed', null, error);
    throw error;
  }
}

async function executeGeminiNode(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<any> {
  const { prompt, model } = node.data.config;

  // 前ノードの出力を取得
  const inputs = getNodeInputs(node.id, context);

  // プロンプトに入力データを埋め込む（テンプレート処理）
  const processedPrompt = replaceVariables(prompt, inputs);

  // Gemini API呼び出し
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: processedPrompt,
      model: model || 'gemini-1.5-flash',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Gemini API call failed');
  }

  return {
    response: data.response,
    timestamp: new Date().toISOString(),
  };
}

function replaceVariables(template: string, inputs: any): string {
  // {{nodeId.property}} 形式の変数を置換
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = getValueByPath(inputs, path);
    return value !== undefined ? String(value) : `{{${path}}}`;
  });
}
```

## 7. UI設計

### 7.1 ワークフロー実行画面の構成

#### 7.1.1 実行コントロールパネル

```tsx
// components/workflow/ExecutionControl.tsx
interface ExecutionControlProps {
  workflowId: string;
  onExecutionStart: (executionId: string) => void;
  onExecutionStop: () => void;
}

export function ExecutionControl({
  workflowId,
  onExecutionStart,
  onExecutionStop,
}: ExecutionControlProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setExecutionId(data.executionId);
        onExecutionStart(data.executionId);
      }
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    if (!executionId) return;

    await fetch(`/api/workflows/${workflowId}/executions/${executionId}/cancel`, {
      method: 'POST',
    });

    onExecutionStop();
  };

  return (
    <Box>
      <Button
        variant="contained"
        color="primary"
        startIcon={<PlayArrowIcon />}
        onClick={handleExecute}
        disabled={isExecuting}
      >
        実行
      </Button>

      {isExecuting && (
        <Button
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={handleCancel}
        >
          停止
        </Button>
      )}
    </Box>
  );
}
```

#### 7.1.2 実行ログビューア

```tsx
// components/workflow/ExecutionLogs.tsx
interface ExecutionLogsProps {
  executionId: string;
}

export function ExecutionLogs({ executionId }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);

  useEffect(() => {
    // WebSocketまたはポーリングでリアルタイムログを取得
    const interval = setInterval(async () => {
      const response = await fetch(`/api/workflows/executions/${executionId}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.execution.logs);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [executionId]);

  return (
    <Box>
      <Typography variant="h6">実行ログ</Typography>

      <List>
        {logs.map((log) => (
          <ListItem key={log.id}>
            <ListItemIcon>
              {getStatusIcon(log.status)}
            </ListItemIcon>
            <ListItemText
              primary={`${log.nodeId} - ${log.nodeType}`}
              secondary={
                <>
                  <span>Status: {log.status}</span>
                  {log.completedAt && (
                    <span> | Duration: {calculateDuration(log.startedAt, log.completedAt)}</span>
                  )}
                  {log.error && (
                    <span style={{ color: 'red' }}> | Error: {log.error}</span>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
```

#### 7.1.3 ノードの実行状態表示

ワークフローエディタ上で、各ノードの実行状態を視覚的に表示します。

**ノードの状態と色分け:**
- **待機中 (pending)**: グレー
- **実行中 (running)**: 青色 + アニメーション
- **完了 (completed)**: 緑色 + チェックマーク
- **失敗 (failed)**: 赤色 + エラーアイコン
- **スキップ (skipped)**: 黄色

```tsx
// components/workflow/CustomNode.tsx に追加
const getNodeStyle = (status?: string) => {
  switch (status) {
    case 'pending':
      return { borderColor: '#9e9e9e', backgroundColor: '#f5f5f5' };
    case 'running':
      return { borderColor: '#2196f3', backgroundColor: '#e3f2fd', animation: 'pulse 1s infinite' };
    case 'completed':
      return { borderColor: '#4caf50', backgroundColor: '#e8f5e9' };
    case 'failed':
      return { borderColor: '#f44336', backgroundColor: '#ffebee' };
    case 'skipped':
      return { borderColor: '#ff9800', backgroundColor: '#fff3e0' };
    default:
      return {};
  }
};
```

### 7.2 実行履歴画面

```tsx
// app/workflow/executions/page.tsx
export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);

  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    const response = await fetch('/api/workflows/executions');
    const data = await response.json();

    if (data.success) {
      setExecutions(data.executions);
    }
  };

  return (
    <Box>
      <Typography variant="h4">実行履歴</Typography>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ワークフロー名</TableCell>
              <TableCell>実行日時</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>実行時間</TableCell>
              <TableCell>アクション</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => (
              <TableRow key={execution.id}>
                <TableCell>{execution.workflowName}</TableCell>
                <TableCell>{formatDate(execution.startedAt)}</TableCell>
                <TableCell>{getStatusBadge(execution.status)}</TableCell>
                <TableCell>{calculateDuration(execution.startedAt, execution.completedAt)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => viewExecutionDetails(execution.id)}
                  >
                    詳細
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
```

## 8. エラーハンドリング

### 8.1 エラーの種類

1. **バリデーションエラー**
   - ノード設定不足
   - 必須入力の欠落
   - 循環参照

2. **実行時エラー**
   - APIコールの失敗
   - タイムアウト
   - データ形式エラー

3. **システムエラー**
   - データベース接続エラー
   - 認証エラー
   - リソース不足

### 8.2 エラーハンドリング戦略

```typescript
async function executeWorkflow(workflowId: string, userId: string) {
  const executionId = await createExecution(workflowId, userId);

  try {
    // 1. バリデーション
    const workflow = await validateWorkflow(workflowId);

    // 2. 実行順序決定
    const executionOrder = topologicalSort(workflow.nodes, workflow.edges);

    // 3. ノード実行
    for (const nodeId of executionOrder) {
      const node = workflow.nodes.find(n => n.id === nodeId);

      try {
        await executeNode(node, context);
      } catch (error) {
        // ノード単位のエラー処理
        await handleNodeError(executionId, nodeId, error);

        // 失敗時の動作設定に応じて継続または中断
        if (node.data.config?.stopOnError !== false) {
          throw error; // ワークフロー全体を中断
        }
      }
    }

    // 4. 成功時の処理
    await completeExecution(executionId, 'completed');

  } catch (error) {
    // ワークフロー全体のエラー処理
    await completeExecution(executionId, 'failed', error);
    throw error;
  }
}
```

## 9. パフォーマンス最適化

### 9.1 並列実行

依存関係のないノードは並列で実行可能にします。

```typescript
function groupNodesByLevel(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[][] {
  const levels: string[][] = [];
  const processed = new Set<string>();

  while (processed.size < nodes.length) {
    const currentLevel = nodes
      .filter(node => !processed.has(node.id))
      .filter(node => {
        // 依存する全ノードが処理済みかチェック
        const dependencies = edges
          .filter(edge => edge.target === node.id)
          .map(edge => edge.source);

        return dependencies.every(dep => processed.has(dep));
      })
      .map(node => node.id);

    if (currentLevel.length === 0) {
      throw new Error('Circular dependency detected');
    }

    levels.push(currentLevel);
    currentLevel.forEach(id => processed.add(id));
  }

  return levels;
}

async function executeWorkflowParallel(workflowId: string, userId: string) {
  const workflow = await getWorkflow(workflowId);
  const levels = groupNodesByLevel(workflow.nodes, workflow.edges);

  for (const level of levels) {
    // 同一レベルのノードを並列実行
    await Promise.all(
      level.map(nodeId => {
        const node = workflow.nodes.find(n => n.id === nodeId);
        return executeNode(node, context);
      })
    );
  }
}
```

### 9.2 キャッシング

実行結果をキャッシュし、同じ入力に対する再実行を高速化します。

```typescript
interface CacheKey {
  nodeId: string;
  nodeConfig: any;
  inputs: any;
}

const executionCache = new Map<string, any>();

function getCacheKey(key: CacheKey): string {
  return JSON.stringify(key);
}

async function executeNodeWithCache(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<any> {
  const cacheKey = getCacheKey({
    nodeId: node.id,
    nodeConfig: node.data.config,
    inputs: getNodeInputs(node.id, context),
  });

  if (executionCache.has(cacheKey)) {
    return executionCache.get(cacheKey);
  }

  const result = await executeNode(node, context);
  executionCache.set(cacheKey, result);

  return result;
}
```

## 10. セキュリティ考慮事項

### 10.1 認証・認可
- 全APIエンドポイントで認証を必須化
- RLSポリシーによるデータアクセス制御
- ワークフロー実行権限の確認

### 10.2 入力検証
- ユーザー入力のサニタイゼーション
- SQLインジェクション対策
- XSS対策

### 10.3 レート制限
```typescript
// app/api/workflows/[id]/execute/route.ts
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];

  // 過去1時間のリクエストをフィルタ
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < 3600000
  );

  if (recentRequests.length >= 100) {
    return false; // レート制限超過
  }

  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);

  return true;
}
```

## 11. テスト戦略

### 11.1 単体テスト
- トポロジカルソート関数
- ノード実行関数
- エラーハンドリング

### 11.2 統合テスト
- API エンドポイント
- データベース操作
- Gemini API統合

### 11.3 E2Eテスト
- ワークフロー作成から実行までの全フロー
- エラーケース
- 並列実行

## 12. 実装フェーズ

### Phase 1: 基盤実装 (2週間)
- [ ] データベーステーブル作成
- [ ] 基本API実装 (execute, get executions)
- [ ] トポロジカルソート実装
- [ ] 基本的なノード実行エンジン

### Phase 2: UI実装 (2週間)
- [ ] 実行コントロールパネル
- [ ] 実行ログビューア
- [ ] ノード状態の視覚化
- [ ] 実行履歴画面

### Phase 3: 高度な機能 (2週間)
- [ ] 並列実行
- [ ] エラーハンドリング強化
- [ ] キャッシング
- [ ] レート制限

### Phase 4: 最適化とテスト (1週間)
- [ ] パフォーマンス最適化
- [ ] テスト実装
- [ ] ドキュメント作成
- [ ] バグ修正

## 13. 将来の拡張性

### 13.1 リアルタイム通信
WebSocketを使用して実行状態をリアルタイムで配信

```typescript
// WebSocket接続
const ws = new WebSocket(`wss://api.example.com/ws/executions/${executionId}`);

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  updateNodeStatus(update.nodeId, update.status);
};
```

### 13.2 スケジュール実行
Cron式によるワークフローの定期実行

```sql
CREATE TABLE workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 13.3 条件分岐ノード
if/else ロジックを持つ条件分岐ノードの追加

```typescript
interface ConditionalNode extends WorkflowNode {
  data: {
    type: 'conditional';
    config: {
      condition: string; // JavaScript式
      trueBranch: string; // 次ノードID
      falseBranch: string; // 次ノードID
    };
  };
}
```

### 13.4 カスタムノードプラグイン
ユーザー定義のカスタムノードタイプ

```typescript
interface CustomNodePlugin {
  type: string;
  name: string;
  description: string;
  execute: (input: any, config: any) => Promise<any>;
  validateConfig: (config: any) => boolean;
}
```

## 14. 参考資料

- [React Flow Documentation](https://reactflow.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [トポロジカルソート - Wikipedia](https://ja.wikipedia.org/wiki/トポロジカルソート)

---

## 付録A: ディレクトリ構造

```
kazika-studio/
├── app/
│   ├── api/
│   │   └── workflows/
│   │       ├── route.ts                    # 既存
│   │       ├── [id]/
│   │       │   ├── route.ts                # 既存
│   │       │   ├── execute/
│   │       │   │   └── route.ts            # 新規: 実行API
│   │       │   └── executions/
│   │       │       ├── route.ts            # 新規: 履歴取得API
│   │       │       └── [executionId]/
│   │       │           ├── route.ts        # 新規: 実行詳細API
│   │       │           └── cancel/
│   │       │               └── route.ts    # 新規: キャンセルAPI
│   ├── workflow/
│   │   ├── page.tsx                        # 既存: エディタ画面
│   │   └── executions/
│   │       └── page.tsx                    # 新規: 実行履歴画面
│   └── components/
│       └── WorkflowList.tsx                # 既存
├── components/
│   └── workflow/
│       ├── WorkflowEditor.tsx              # 既存
│       ├── ExecutionControl.tsx            # 新規: 実行コントロール
│       ├── ExecutionLogs.tsx               # 新規: ログビューア
│       ├── ExecutionHistory.tsx            # 新規: 履歴一覧
│       └── ExecutionDetails.tsx            # 新規: 実行詳細
├── lib/
│   ├── workflow/
│   │   ├── executor.ts                     # 新規: 実行エンジン
│   │   ├── topological-sort.ts             # 新規: ソートロジック
│   │   └── node-executors/                 # 新規: ノード実行関数
│   │       ├── input-executor.ts
│   │       ├── process-executor.ts
│   │       ├── output-executor.ts
│   │       └── gemini-executor.ts
│   └── supabase/
│       └── server.ts                       # 既存
└── docs/
    └── workflow-execution-design.md        # 本ドキュメント
```

## 付録B: 環境変数

```env
# .env.local に追加
WORKFLOW_EXECUTION_TIMEOUT=300000  # 5分
WORKFLOW_MAX_NODES=100
WORKFLOW_RATE_LIMIT=100  # 1時間あたりの実行回数制限
```

## 付録C: サンプルワークフロー

```json
{
  "id": "workflow-1",
  "name": "記事生成ワークフロー",
  "nodes": [
    {
      "id": "input-1",
      "type": "custom",
      "data": {
        "type": "input",
        "config": {
          "name": "トピック入力",
          "description": "記事のトピックを入力"
        }
      }
    },
    {
      "id": "gemini-1",
      "type": "gemini",
      "data": {
        "type": "gemini",
        "config": {
          "name": "アウトライン生成",
          "prompt": "以下のトピックについて記事のアウトラインを作成してください: {{input-1.value}}",
          "model": "gemini-1.5-flash"
        }
      }
    },
    {
      "id": "gemini-2",
      "type": "gemini",
      "data": {
        "type": "gemini",
        "config": {
          "name": "本文生成",
          "prompt": "以下のアウトラインに基づいて記事の本文を作成してください:\n{{gemini-1.response}}",
          "model": "gemini-1.5-pro"
        }
      }
    },
    {
      "id": "output-1",
      "type": "custom",
      "data": {
        "type": "output",
        "config": {
          "name": "記事出力",
          "description": "生成された記事を出力"
        }
      }
    }
  ],
  "edges": [
    { "source": "input-1", "target": "gemini-1" },
    { "source": "gemini-1", "target": "gemini-2" },
    { "source": "gemini-2", "target": "output-1" }
  ]
}
```

---

**作成日**: 2024-01-XX
**最終更新**: 2024-01-XX
**作成者**: Kazika Studio Development Team
**バージョン**: 1.0
