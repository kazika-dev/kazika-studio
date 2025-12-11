-- =====================================================
-- workflow_outputs テーブルに favorite カラムを追加
-- =====================================================
-- お気に入り機能のためのカラム追加
-- =====================================================

-- favorite カラムを追加（デフォルト: false）
ALTER TABLE kazikastudio.workflow_outputs
ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;

-- お気に入りフィルタリング用インデックスを作成
-- ユーザーIDとお気に入りフラグの複合インデックス
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_user_favorite
ON kazikastudio.workflow_outputs(user_id, favorite DESC);

-- お気に入りと作成日時の複合インデックス（お気に入り一覧のページング用）
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_favorite_created
ON kazikastudio.workflow_outputs(user_id, favorite, created_at DESC);

-- コメント追加
COMMENT ON COLUMN kazikastudio.workflow_outputs.favorite IS 'お気に入りフラグ（true: お気に入り登録済み）';

-- =====================================================
-- マイグレーション完了
-- =====================================================
