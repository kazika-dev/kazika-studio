-- =====================================================
-- ワークフロー出力テーブル作成
-- =====================================================
-- ワークフローステップの実行結果（画像、動画、音声など）を保存
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.workflow_outputs (
  id BIGSERIAL PRIMARY KEY,

  -- 関連テーブル
  workflow_id BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE CASCADE NOT NULL,
  step_id BIGINT REFERENCES kazikastudio.studio_board_workflow_steps(id) ON DELETE CASCADE,

  -- 出力タイプ
  output_type TEXT NOT NULL CHECK (output_type IN ('image', 'video', 'audio', 'text', 'other')),

  -- ノード情報
  node_id TEXT NOT NULL,

  -- 出力データ
  output_url TEXT, -- 画像、動画、音声のURL
  output_data JSONB, -- その他のデータ（imageData, audioDataなど）

  -- メタデータ
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_workflow_id ON kazikastudio.workflow_outputs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_step_id ON kazikastudio.workflow_outputs(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_type ON kazikastudio.workflow_outputs(output_type);
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_created_at ON kazikastudio.workflow_outputs(created_at DESC);

-- RLS有効化
ALTER TABLE kazikastudio.workflow_outputs ENABLE ROW LEVEL SECURITY;

-- RLSポリシー（ワークフローの所有者のみアクセス可能）
CREATE POLICY "Users can view own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.workflows
      WHERE workflows.id = workflow_outputs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.workflows
      WHERE workflows.id = workflow_outputs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.workflows
      WHERE workflows.id = workflow_outputs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.workflows
      WHERE workflows.id = workflow_outputs.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- トリガー関数作成
CREATE OR REPLACE FUNCTION kazikastudio.handle_workflow_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
DROP TRIGGER IF EXISTS on_workflow_outputs_updated ON kazikastudio.workflow_outputs;
CREATE TRIGGER on_workflow_outputs_updated
  BEFORE UPDATE ON kazikastudio.workflow_outputs
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_workflow_outputs_updated_at();

-- コメント追加
COMMENT ON TABLE kazikastudio.workflow_outputs IS 'ワークフローステップの実行結果（画像、動画、音声など）を保存';
COMMENT ON COLUMN kazikastudio.workflow_outputs.workflow_id IS '実行されたワークフローID';
COMMENT ON COLUMN kazikastudio.workflow_outputs.step_id IS '実行されたステップID（studio_board_workflow_steps）';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_type IS '出力タイプ: image, video, audio, text, other';
COMMENT ON COLUMN kazikastudio.workflow_outputs.node_id IS 'ワークフロー内のノードID';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_url IS '出力のURL（画像、動画、音声の場合）';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_data IS 'その他の出力データ（JSONB形式）';
COMMENT ON COLUMN kazikastudio.workflow_outputs.metadata IS 'メタデータ（jobId、durationなど）';

-- パーミッション付与
GRANT ALL ON kazikastudio.workflow_outputs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.workflow_outputs_id_seq TO anon, authenticated;

-- =====================================================
-- マイグレーション完了
-- =====================================================
