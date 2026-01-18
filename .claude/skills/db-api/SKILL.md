---
name: db-api
description: kazika-studio のデータベース操作スキル。ワークフロー、スタジオ、会話、出力データ、キャラクターシート、プロンプトキュー、マスタテーブルなどのCRUD操作を行う際に使用する。
user-invocable: true
---

# DB API スキル

kazika-studio のデータベース操作ガイド。

## 主要テーブル

| テーブル | 用途 |
|----------|------|
| `workflows` | ワークフロー定義 |
| `studios` | スタジオ（プロジェクト） |
| `studio_boards` | ストーリーボード |
| `studio_board_workflow_steps` | 実行ステップ |
| `conversations` | 会話 |
| `conversation_messages` | メッセージ |
| `workflow_outputs` | 生成出力 |
| `character_sheets` | キャラクターシート |
| `prompt_queues` | プロンプトキュー |

## DB関数 (`/lib/db.ts`)

### Workflows

```typescript
import { getWorkflowsByUserId, getWorkflowById, createWorkflow, updateWorkflow, deleteWorkflow } from '@/lib/db';

const workflows = await getWorkflowsByUserId(userId);
const workflow = await getWorkflowById(id);
const newWorkflow = await createWorkflow({ user_id, name, nodes, edges, form_config });
await updateWorkflow(id, { name, nodes, edges });
await deleteWorkflow(id);
```

### Studios

```typescript
import { getStudiosByUserId, getStudioById, createStudio, updateStudio, deleteStudio } from '@/lib/db';

const studios = await getStudiosByUserId(userId);
const studio = await getStudioById(id);
const newStudio = await createStudio({ user_id, name, description });
await updateStudio(id, { name, thumbnail_url });
await deleteStudio(id);  // CASCADE: boards, steps も削除
```

### Studio Boards

```typescript
import { getBoardsByStudioId, getBoardById, createBoard, updateBoard, deleteBoard, reorderBoards } from '@/lib/db';

const boards = await getBoardsByStudioId(studioId);
const board = await getBoardById(id);
const newBoard = await createBoard({ studio_id, workflow_id, sequence_order });
await updateBoard(id, { status, output_ids });
await deleteBoard(id);
await reorderBoards(studioId, [boardId1, boardId2]);  // sequence_order更新
```

### Workflow Steps

```typescript
import { getStepsByBoardId, getStepById, createStep, updateStep, deleteStep } from '@/lib/db';

const steps = await getStepsByBoardId(boardId, includeDetails);
const step = await getStepById(id);
const newStep = await createStep({ board_id, workflow_id, input_config, status: 'pending' });
await updateStep(id, { output_data, status: 'completed' });
await deleteStep(id);
```

### Workflow Outputs

```typescript
import { createWorkflowOutput, getWorkflowOutputById, getWorkflowOutputsByWorkflowId } from '@/lib/db';

const output = await createWorkflowOutput({
  user_id, workflow_id, output_type: 'image',
  output_url: storagePath, metadata: { nodeId, width, height }
});
const outputs = await getWorkflowOutputsByWorkflowId(workflowId);
```

### Character Sheets

```typescript
import { getCharacterSheetsByUserId, getCharacterSheetById, createCharacterSheet, updateCharacterSheet, deleteCharacterSheet } from '@/lib/db';

const sheets = await getCharacterSheetsByUserId(userId, limit, offset);
const sheet = await getCharacterSheetById(id);
const newSheet = await createCharacterSheet({ user_id, name, storage_path, width, height });
await updateCharacterSheet(id, { name, is_favorite: true });
await deleteCharacterSheet(id);
```

### Conversations

```typescript
import { getConversationsByStudioId, createConversation, deleteConversation } from '@/lib/db';
import { getMessageCharacters, addCharacterToMessage, removeCharacterFromMessage } from '@/lib/db';

const conversations = await getConversationsByStudioId(studioId);
const conv = await createConversation({ user_id, studio_id, title });
await deleteConversation(id);

// シーンキャラクター
const characters = await getMessageCharacters(messageId);
await addCharacterToMessage(messageId, characterId, { display_order: 1 });
await removeCharacterFromMessage(messageId, characterId);
```

### Stories & Scenes

```typescript
import { getStoriesByUserId, createStory, getScenesByStoryId, createStoryScene, getStoriesTreeByUserId } from '@/lib/db';

const stories = await getStoriesByUserId(userId);
const story = await createStory({ user_id, title, description });
const scenes = await getScenesByStoryId(storyId);
const scene = await createStoryScene({ story_id, title, sequence_order });
const tree = await getStoriesTreeByUserId(userId);  // 階層構造取得
```

### Prompt Queue

```typescript
import { getPromptQueuesByUserId, getPromptQueueById, createPromptQueue, updatePromptQueue, deletePromptQueue, getPendingPromptQueues } from '@/lib/db';

const { queues, total } = await getPromptQueuesByUserId(userId, { status: 'pending', limit: 10, offset: 0 });
const queue = await getPromptQueueById(id);
const newQueue = await createPromptQueue({ user_id, prompt, model, aspect_ratio, status: 'pending' });
await updatePromptQueue(id, { status: 'completed', enhanced_prompt });
await deletePromptQueue(id);
const pending = await getPendingPromptQueues(userId);
```

## 詳細リファレンス

- [APIエンドポイント一覧](references/api-endpoints.md) - 全APIのメソッド・パス・用途
- [テーブルスキーマ](references/table-schemas.md) - 全テーブルのカラム定義

## RLSポリシー

全テーブルに `user_id` カラムがあり、Row Level Securityで自動的に所有者のみアクセス可能。サーバーサイドでは `authenticateRequest()` で認証済みユーザーを取得。

```typescript
import { authenticateRequest } from '@/lib/auth/apiAuth';

const user = await authenticateRequest(request);
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

## マイグレーション注意

**DBへのマイグレーションやdeleteは確認なしで行わない。** マイグレーションファイルは `/supabase/migrations/` に配置。
