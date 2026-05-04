-- =====================================================
-- studio_board_workflow_stepsテーブルにmetadataカラムを追加
-- =====================================================

ALTER TABLE kazikastudio.studio_board_workflow_steps
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- コメントを追加
COMMENT ON COLUMN kazikastudio.studio_board_workflow_steps.metadata IS '実行時のリクエストデータなど、追加のメタデータ';
