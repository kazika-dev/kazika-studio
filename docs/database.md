# データベース接続とスキーマ構造

## データベース接続方法

### 環境変数の設定

`.env.local`ファイルに以下の環境変数を設定してください：

```bash
# Supabase Database Configuration
SUPABASE_DB_HOST=your-project.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-password

# または直接接続文字列を指定
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
```

### コードからの接続

`lib/db.ts`でデータベース接続を管理しています：

```typescript
import { getPool, query } from '@/lib/db';

// クエリ実行の例
const result = await query('SELECT * FROM kazikastudio.workflows WHERE id = $1', [id]);
```

### 接続設定の詳細

- **SSL**: 開発環境では`rejectUnauthorized: false`を使用
- **接続プール**: 最大20接続
- **アイドルタイムアウト**: 30秒
- **接続タイムアウト**: 10秒

## スキーマ構造

このプロジェクトでは2つのスキーマを使用しています：

### 1. `public` スキーマ
認証関連のテーブルを格納

| テーブル名 | 説明 |
|-----------|------|
| profiles | ユーザープロフィール情報 |

### 2. `kazikastudio` スキーマ
アプリケーション固有のすべてのテーブルを格納

| テーブル名 | 説明 |
|-----------|------|
| workflows | ワークフロー定義（ノード＆エッジ） |
| workflow_outputs | ワークフロー実行結果（画像、動画、音声など） |
| studios | 動画プロジェクト（スタジオ） |
| studio_boards | ストーリーボード（時系列シーン） |
| studio_board_workflow_steps | ボードのワークフローステップ |
| comfyui_queue | ComfyUIワークフロー処理キュー |
| character_sheets | キャラクターシート情報 |

---

## テーブル詳細

### profiles (public.profiles)

**説明**: ユーザーのプロフィール情報を保存

**カラム**:
```sql
id              UUID PRIMARY KEY REFERENCES auth.users(id)
email           TEXT
full_name       TEXT
avatar_url      TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**RLSポリシー**:
- ユーザーは自分のプロフィールのみ閲覧・編集可能

**トリガー**:
- 新規ユーザー作成時に自動的にプロフィールレコードを作成
- 更新時に`updated_at`を自動更新

---

### workflows (kazikastudio.workflows)

**説明**: ワークフロー定義を保存（ノードとエッジのグラフ構造）

**カラム**:
```sql
id              BIGSERIAL PRIMARY KEY
user_id         UUID NOT NULL REFERENCES auth.users(id)
name            TEXT NOT NULL
description     TEXT DEFAULT ''
nodes           JSONB NOT NULL DEFAULT '[]'
edges           JSONB NOT NULL DEFAULT '[]'
form_config     JSONB DEFAULT NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**インデックス**:
- `idx_workflows_user_id` - ユーザーIDでの検索用
- `idx_workflows_created_at` - 作成日時での並び替え用
- `idx_workflows_updated_at` - 更新日時での並び替え用

**RLSポリシー**:
- ユーザーは自分のワークフローのみ閲覧・作成・編集・削除可能

**使用例**:
```typescript
import { getWorkflowById } from '@/lib/db';

const workflow = await getWorkflowById(123);
```

---

### workflow_outputs (kazikastudio.workflow_outputs)

**説明**: ワークフローステップの実行結果を保存

**カラム**:
```sql
id              BIGSERIAL PRIMARY KEY
workflow_id     BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE CASCADE
step_id         BIGINT REFERENCES kazikastudio.studio_board_workflow_steps(id) ON DELETE CASCADE
output_type     TEXT NOT NULL CHECK (output_type IN ('image', 'video', 'audio', 'text', 'other'))
node_id         TEXT NOT NULL
output_url      TEXT
output_data     JSONB
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**インデックス**:
- `idx_workflow_outputs_workflow_id` - ワークフローIDでの検索用
- `idx_workflow_outputs_step_id` - ステップIDでの検索用
- `idx_workflow_outputs_type` - 出力タイプでのフィルタリング用
- `idx_workflow_outputs_created_at` - 作成日時での並び替え用

**RLSポリシー**:
- ワークフローの所有者のみアクセス可能

**使用例**:
```typescript
import { createWorkflowOutput, getWorkflowOutputsByStepId } from '@/lib/db';

// 出力を保存
const output = await createWorkflowOutput({
  user_id: 'user-uuid',
  workflow_id: 123,
  step_id: 456,
  output_type: 'image',
  node_id: 'image_output_node',
  output_url: 'storage/path/to/image.png',
  metadata: { width: 1024, height: 1024 }
});

// ステップの出力を取得
const outputs = await getWorkflowOutputsByStepId(456);
```

---

### studios (kazikastudio.studios)

**説明**: 動画プロジェクト（スタジオ）を管理

**カラム**:
```sql
id              BIGSERIAL PRIMARY KEY
user_id         UUID NOT NULL REFERENCES auth.users(id)
name            TEXT NOT NULL
description     TEXT DEFAULT ''
thumbnail_url   TEXT
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**インデックス**:
- `idx_studios_user_id` - ユーザーIDでの検索用
- `idx_studios_created_at` - 作成日時での並び替え用
- `idx_studios_updated_at` - 更新日時での並び替え用

**RLSポリシー**:
- ユーザーは自分のスタジオのみ閲覧・作成・編集・削除可能

**使用例**:
```typescript
import { getStudiosByUserId, createStudio } from '@/lib/db';

// スタジオ一覧を取得
const studios = await getStudiosByUserId('user-uuid');

// 新規スタジオを作成
const studio = await createStudio({
  user_id: 'user-uuid',
  name: 'My Video Project',
  description: 'A cool video project'
});
```

---

### studio_boards (kazikastudio.studio_boards)

**説明**: ストーリーボード（時系列で並ぶシーン）を管理

**カラム**:
```sql
id                  BIGSERIAL PRIMARY KEY
studio_id           BIGINT NOT NULL REFERENCES kazikastudio.studios(id) ON DELETE CASCADE
sequence_order      INTEGER NOT NULL
title               TEXT DEFAULT ''
description         TEXT DEFAULT ''
workflow_id         BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE SET NULL
audio_output_id     BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL
image_output_id     BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL
video_output_id     BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL
custom_audio_url    TEXT
custom_image_url    TEXT
custom_video_url    TEXT
prompt_text         TEXT DEFAULT ''
duration_seconds    DECIMAL(10, 2)
status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'error'))
error_message       TEXT
metadata            JSONB DEFAULT '{}'
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()

CONSTRAINT unique_studio_sequence UNIQUE (studio_id, sequence_order)
```

**インデックス**:
- `idx_studio_boards_studio_id` - スタジオIDでの検索用
- `idx_studio_boards_sequence` - 順序での並び替え用
- `idx_studio_boards_workflow_id` - ワークフローIDでの検索用
- `idx_studio_boards_status` - ステータスでのフィルタリング用

**RLSポリシー**:
- スタジオの所有者のみアクセス可能

**使用例**:
```typescript
import { getBoardsByStudioId, createBoard } from '@/lib/db';

// スタジオのボード一覧を取得
const boards = await getBoardsByStudioId(123);

// 新規ボードを作成
const board = await createBoard({
  studio_id: 123,
  sequence_order: 0,
  title: 'Opening Scene',
  description: 'The opening scene of the video'
});
```

---

### studio_board_workflow_steps (kazikastudio.studio_board_workflow_steps)

**説明**: ボードのワークフローステップを管理

**カラム**:
```sql
id                  BIGSERIAL PRIMARY KEY
board_id            BIGINT NOT NULL REFERENCES kazikastudio.studio_boards(id) ON DELETE CASCADE
workflow_id         BIGINT NOT NULL REFERENCES kazikastudio.workflows(id)
step_order          INTEGER NOT NULL
input_config        JSONB DEFAULT '{}'
execution_status    TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'running', 'completed', 'failed'))
output_data         JSONB
error_message       TEXT
metadata            JSONB DEFAULT '{}'
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()

CONSTRAINT unique_board_step_order UNIQUE (board_id, step_order)
```

**インデックス**:
- `idx_board_workflow_steps_board_id` - ボードIDでの検索用
- `idx_board_workflow_steps_workflow_id` - ワークフローIDでの検索用
- `idx_board_workflow_steps_status` - ステータスでのフィルタリング用

**RLSポリシー**:
- ボードの所有者のみアクセス可能

**使用例**:
```typescript
import { getStepsByBoardId, createStep, updateStep } from '@/lib/db';

// ボードのステップ一覧を取得
const steps = await getStepsByBoardId(456);

// ステップを作成
const step = await createStep({
  board_id: 456,
  workflow_id: 789,
  step_order: 0,
  input_config: { prompt: 'A beautiful sunset' }
});

// ステップを更新
await updateStep(step.id, {
  execution_status: 'completed',
  output_data: { image_url: 'path/to/output.png' }
});
```

---

### comfyui_queue (kazikastudio.comfyui_queue)

**説明**: ComfyUIワークフロー処理のキュー管理

**カラム**:
```sql
id                          SERIAL PRIMARY KEY
user_id                     TEXT NOT NULL
comfyui_workflow_name       TEXT NOT NULL
workflow_json               JSONB NOT NULL
prompt                      TEXT
img_gcp_storage_paths       JSONB DEFAULT '[]'
status                      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
priority                    INTEGER DEFAULT 0
comfyui_prompt_id           TEXT
started_at                  TIMESTAMPTZ
completed_at                TIMESTAMPTZ
output_gcp_storage_paths    JSONB DEFAULT '[]'
output_data                 JSONB
error_message               TEXT
metadata                    JSONB DEFAULT '{}'
created_at                  TIMESTAMPTZ DEFAULT NOW()
updated_at                  TIMESTAMPTZ DEFAULT NOW()
```

**インデックス**:
- `idx_comfyui_queue_status_priority` - ステータスと優先度でのキュー取得用
- `idx_comfyui_queue_user_id` - ユーザーIDでの検索用
- `idx_comfyui_queue_prompt_id` - ComfyUI prompt IDでの検索用

**使用例**:
```typescript
import { createComfyUIQueueItem, getNextPendingComfyUIQueueItem, updateComfyUIQueueItem } from '@/lib/db';

// キューアイテムを作成
const queueItem = await createComfyUIQueueItem({
  user_id: 'user-uuid',
  comfyui_workflow_name: 'text_to_image',
  workflow_json: { /* ComfyUI workflow definition */ },
  prompt: 'A beautiful landscape',
  priority: 1
});

// 次の処理待ちアイテムを取得
const nextItem = await getNextPendingComfyUIQueueItem();

// ステータスを更新
await updateComfyUIQueueItem(queueItem.id, {
  status: 'processing',
  comfyui_prompt_id: 'comfyui-prompt-123',
  started_at: new Date()
});
```

---

### character_sheets (kazikastudio.character_sheets)

**説明**: キャラクターシート情報を保存

**カラム**:
```sql
id              BIGSERIAL PRIMARY KEY
user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
name            TEXT NOT NULL
image_url       TEXT NOT NULL
description     TEXT
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**インデックス**:
- `idx_character_sheets_user_id` - ユーザーIDでの検索用
- `idx_character_sheets_created_at` - 作成日時での並び替え用

**RLSポリシー**:
- ユーザーは自分のキャラクターシートのみ閲覧・作成・編集・削除可能

**使用例**:
```typescript
import { getCharacterSheetsByUserId, createCharacterSheet, updateCharacterSheet } from '@/lib/db';

// ユーザーのキャラクターシート一覧を取得
const sheets = await getCharacterSheetsByUserId('user-uuid');

// キャラクターシートを作成
const sheet = await createCharacterSheet({
  user_id: 'user-uuid',
  name: 'Hero Character',
  image_url: 'storage/path/to/character.png',
  description: 'The main protagonist'
});

// キャラクターシートを更新
await updateCharacterSheet(sheet.id, {
  name: 'Updated Hero Name',
  description: 'Updated description'
});
```

---

## マイグレーション

### マイグレーションファイルの場所

マイグレーションファイルは`supabase/migrations/`ディレクトリに配置されています：

```
supabase/migrations/
├── 00000000000000_initial_setup.sql
├── 20250126000001_create_profiles_table.sql
├── 20250126000002_create_workflows_table.sql
├── 20250126000003_create_generated_images_table.sql
├── 20251103000001_create_studios_tables.sql
├── 20251103000002_create_board_workflow_steps.sql
├── 20251104000001_add_metadata_to_workflow_steps.sql
├── 20251104000002_create_workflow_outputs.sql
├── 20251104000003_add_step_columns_to_workflow_outputs.sql
├── 20251105000001_create_character_sheets_table.sql
└── 20251106000001_move_character_sheets_to_kazikastudio.sql
```

### マイグレーション実行方法

```bash
# マイグレーションを実行
node scripts/run-migration.js supabase/migrations/<migration-file>.sql

# マイグレーション検証
node scripts/verify-migration.js
```

---

## Row Level Security (RLS)

すべてのテーブルでRLSが有効化されており、以下のポリシーが適用されています：

### 基本ポリシーパターン

1. **SELECT**: ユーザーは自分のデータのみ閲覧可能
   ```sql
   USING (auth.uid() = user_id)
   ```

2. **INSERT**: ユーザーは自分のデータのみ作成可能
   ```sql
   WITH CHECK (auth.uid() = user_id)
   ```

3. **UPDATE**: ユーザーは自分のデータのみ更新可能
   ```sql
   USING (auth.uid() = user_id)
   ```

4. **DELETE**: ユーザーは自分のデータのみ削除可能
   ```sql
   USING (auth.uid() = user_id)
   ```

### 関連テーブルのポリシー

関連テーブル（例：`studio_boards`, `workflow_outputs`）では、親テーブルの所有者チェックを経由してアクセス制御を行います：

```sql
-- studio_boardsのSELECTポリシー
USING (
  EXISTS (
    SELECT 1 FROM kazikastudio.studios
    WHERE studios.id = studio_boards.studio_id
    AND studios.user_id = auth.uid()
  )
)
```

---

## トラブルシューティング

### 接続エラー

**問題**: `connection timeout`エラーが発生する

**解決策**:
1. `.env.local`の接続情報を確認
2. ファイアウォール設定を確認
3. SupabaseのIPホワイトリストを確認

### RLSエラー

**問題**: `permission denied`エラーが発生する

**解決策**:
1. ユーザーが認証されているか確認
2. RLSポリシーが正しく設定されているか確認
3. `auth.uid()`が正しく取得できているか確認

### マイグレーションエラー

**問題**: マイグレーション実行時にエラーが発生する

**解決策**:
1. 既存のテーブルやカラムが存在していないか確認
2. 依存関係のある他のテーブルが先に作成されているか確認
3. SQLの構文エラーを確認

---

## 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
