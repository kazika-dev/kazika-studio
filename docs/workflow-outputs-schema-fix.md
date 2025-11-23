# Workflow Outputs Schema Fix

## 問題

`workflow_outputs` テーブルのスキーマが本番環境と開発環境で異なっていたため、ステップ実行時に以下のエラーが発生していました:

```
error: column "step_id" of relation "workflow_outputs" does not exist
```

## 原因

`workflow_outputs` テーブルには3つの異なる CREATE TABLE マイグレーションが存在していました:

1. **本番環境で実際に適用されているスキーマ** (`20250126000003_create_generated_images_table.sql`):
   - カラム: `id`, `user_id`, `workflow_id`, `output_type`, `content_url`, `content_text`, `prompt`, `metadata`, `created_at`, `updated_at`
   - **`step_id` と `node_id` カラムは存在しない**

2. **後から追加された新しいスキーマ** (`20251104000002_create_workflow_outputs.sql`):
   - カラム: `id`, `workflow_id`, `step_id`, `output_type`, `node_id`, `output_url`, `output_data`, `metadata`, `created_at`, `updated_at`
   - `CREATE TABLE IF NOT EXISTS` のため、既存テーブルがある場合は実行されない

3. **カラム追加マイグレーション** (`20251104000003_add_step_columns_to_workflow_outputs.sql`):
   - `step_id`, `node_id`, `output_url`, `output_data` カラムを追加
   - 本番環境に適用されていなかった可能性がある

## 解決策

`/lib/db.ts` の `createWorkflowOutput()` 関数を修正し、本番環境のスキーマに合わせて以下の変更を実施:

1. **`step_id` と `node_id` を `metadata` に格納**
   - 後方互換性を維持しつつ、本番環境で動作するようにする
   - 将来的にマイグレーションが適用された場合も、既存のデータは `metadata` に保存されるため問題なし

2. **`output_url` を `content_url` に変更**
   - 本番環境のカラム名に合わせる

3. **`getWorkflowOutputsByStepId()` を更新**
   - `WHERE step_id = $1` → `WHERE metadata->>'step_id' = $1`
   - メタデータからステップIDを検索するように変更

## 変更内容

### Before (開発環境想定のスキーマ):

```typescript
export async function createWorkflowOutput(data: {...}) {
  const result = await query(
    `INSERT INTO kazikastudio.workflow_outputs
     (user_id, workflow_id, step_id, output_type, node_id, output_url, output_data, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [...]
  );
  return result.rows[0];
}
```

### After (本番環境のスキーマに対応):

```typescript
export async function createWorkflowOutput(data: {...}) {
  // step_id と node_id を metadata にマージ
  const enrichedMetadata = {
    ...(data.metadata || {}),
    step_id: data.step_id,
    node_id: data.node_id,
  };

  const result = await query(
    `INSERT INTO kazikastudio.workflow_outputs
     (user_id, workflow_id, output_type, content_url, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.user_id,
      data.workflow_id,
      data.output_type,
      data.output_url || null,
      enrichedMetadata,
    ]
  );
  return result.rows[0];
}
```

## 影響範囲

- ✅ ステップ実行時のエラーが解消される
- ✅ 既存の `/outputs` ページは影響を受けない（`content_url` を正しく使用）
- ✅ 将来的にマイグレーションが適用されても後方互換性を維持
- ✅ `metadata` に `step_id` と `node_id` が保存されるため、検索・フィルタリングも可能

## 今後の対応

将来的に本番環境にマイグレーション `20251104000003_add_step_columns_to_workflow_outputs.sql` を適用する場合:

1. 既存の `metadata` に保存された `step_id` と `node_id` を専用カラムに移行するマイグレーションを作成
2. `/lib/db.ts` の関数を更新して、専用カラムを優先的に使用するように変更
3. 後方互換性のため、`metadata` からのフォールバックも維持

## 関連ファイル

- `/lib/db.ts` - `createWorkflowOutput()`, `getWorkflowOutputsByStepId()` を修正
- `/supabase/migrations/20250126000003_create_generated_images_table.sql` - 本番環境のスキーマ
- `/supabase/migrations/20251104000003_add_step_columns_to_workflow_outputs.sql` - 未適用のマイグレーション
