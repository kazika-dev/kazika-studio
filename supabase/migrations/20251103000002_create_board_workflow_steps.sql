-- =====================================================
-- ボードワークフローステップテーブル作成
-- =====================================================
-- ボード内で複数のワークフローを連鎖実行するための
-- ステップ管理テーブル
-- =====================================================

-- =====================================================
-- 1. ボードワークフローステップテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.board_workflow_steps (
  id BIGSERIAL PRIMARY KEY,
  board_id BIGINT REFERENCES kazikastudio.studio_boards(id) ON DELETE CASCADE NOT NULL,
  workflow_id BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,

  -- 入力設定
  input_config JSONB DEFAULT '{}'::jsonb,

  -- 実行結果
  execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'running', 'completed', 'failed')),
  output_data JSONB DEFAULT NULL,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- ユニーク制約（同じboard内でstep_orderは一意）
  CONSTRAINT unique_board_step UNIQUE (board_id, step_order)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_board_workflow_steps_board_id ON kazikastudio.board_workflow_steps(board_id);
CREATE INDEX IF NOT EXISTS idx_board_workflow_steps_step_order ON kazikastudio.board_workflow_steps(board_id, step_order);
CREATE INDEX IF NOT EXISTS idx_board_workflow_steps_workflow_id ON kazikastudio.board_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_board_workflow_steps_status ON kazikastudio.board_workflow_steps(execution_status);

-- Enable Row Level Security
ALTER TABLE kazikastudio.board_workflow_steps ENABLE ROW LEVEL SECURITY;

-- Create policies (board_workflow_stepsは所属するboardの所有者のみアクセス可能)
CREATE POLICY "Users can view own board workflow steps"
  ON kazikastudio.board_workflow_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studio_boards
      JOIN kazikastudio.studios ON studios.id = studio_boards.studio_id
      WHERE studio_boards.id = board_workflow_steps.board_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own board workflow steps"
  ON kazikastudio.board_workflow_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.studio_boards
      JOIN kazikastudio.studios ON studios.id = studio_boards.studio_id
      WHERE studio_boards.id = board_workflow_steps.board_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own board workflow steps"
  ON kazikastudio.board_workflow_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studio_boards
      JOIN kazikastudio.studios ON studios.id = studio_boards.studio_id
      WHERE studio_boards.id = board_workflow_steps.board_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own board workflow steps"
  ON kazikastudio.board_workflow_steps
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studio_boards
      JOIN kazikastudio.studios ON studios.id = studio_boards.studio_id
      WHERE studio_boards.id = board_workflow_steps.board_id
      AND studios.user_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_board_workflow_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_board_workflow_steps_updated ON kazikastudio.board_workflow_steps;
CREATE TRIGGER on_board_workflow_steps_updated
  BEFORE UPDATE ON kazikastudio.board_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_board_workflow_steps_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.board_workflow_steps IS 'ボード内で実行するワークフローステップを管理するテーブル';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.board_id IS '所属するボードID';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.workflow_id IS '実行するワークフローID';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.step_order IS 'ステップの実行順序（0から始まる）';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.input_config IS '入力設定（プロンプト、前ステップの出力使用フラグ等）';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.execution_status IS 'ステータス: pending, running, completed, failed';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.output_data IS '実行結果のデータ';
COMMENT ON COLUMN kazikastudio.board_workflow_steps.error_message IS 'エラー時のメッセージ';

-- Grant permissions
GRANT ALL ON kazikastudio.board_workflow_steps TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.board_workflow_steps_id_seq TO anon, authenticated;

-- =====================================================
-- マイグレーション完了
-- =====================================================
