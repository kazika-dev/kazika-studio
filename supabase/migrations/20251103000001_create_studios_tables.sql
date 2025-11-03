-- =====================================================
-- スタジオ機能のテーブル作成
-- =====================================================
-- 動画生成スタジオ機能のためのテーブルを作成します
-- - kazikastudio.studios: スタジオ（動画プロジェクト）
-- - kazikastudio.studio_boards: ストーリーボード（時系列シーン）
-- =====================================================

-- =====================================================
-- 1. スタジオテーブル (kazikastudio.studios)
-- =====================================================

-- Create studios table
CREATE TABLE IF NOT EXISTS kazikastudio.studios (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_studios_user_id ON kazikastudio.studios(user_id);
CREATE INDEX IF NOT EXISTS idx_studios_created_at ON kazikastudio.studios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studios_updated_at ON kazikastudio.studios(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE kazikastudio.studios ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own studios"
  ON kazikastudio.studios
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studios"
  ON kazikastudio.studios
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own studios"
  ON kazikastudio.studios
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own studios"
  ON kazikastudio.studios
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_studios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_studios_updated ON kazikastudio.studios;
CREATE TRIGGER on_studios_updated
  BEFORE UPDATE ON kazikastudio.studios
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_studios_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.studios IS '動画プロジェクト（スタジオ）を管理するテーブル';
COMMENT ON COLUMN kazikastudio.studios.name IS 'プロジェクト名';
COMMENT ON COLUMN kazikastudio.studios.description IS 'プロジェクトの説明';
COMMENT ON COLUMN kazikastudio.studios.thumbnail_url IS 'プロジェクトのサムネイル画像URL';
COMMENT ON COLUMN kazikastudio.studios.metadata IS '追加メタデータ（解像度、フレームレート等）';

-- Grant permissions
GRANT ALL ON kazikastudio.studios TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.studios_id_seq TO anon, authenticated;

-- =====================================================
-- 2. ストーリーボードテーブル (kazikastudio.studio_boards)
-- =====================================================

-- Create studio_boards table
CREATE TABLE IF NOT EXISTS kazikastudio.studio_boards (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT REFERENCES kazikastudio.studios(id) ON DELETE CASCADE NOT NULL,
  sequence_order INTEGER NOT NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',

  -- ワークフロー連携
  workflow_id BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE SET NULL,

  -- 生成コンテンツへの参照
  audio_output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  image_output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  video_output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,

  -- 直接入力されたコンテンツ（ワークフロー以外から）
  custom_audio_url TEXT,
  custom_image_url TEXT,
  custom_video_url TEXT,

  -- プロンプトと設定
  prompt_text TEXT DEFAULT '',
  duration_seconds DECIMAL(10, 2),

  -- ステータス
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'error')),
  error_message TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- ユニーク制約（同じstudio内でsequence_orderは一意）
  CONSTRAINT unique_studio_sequence UNIQUE (studio_id, sequence_order)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_studio_boards_studio_id ON kazikastudio.studio_boards(studio_id);
CREATE INDEX IF NOT EXISTS idx_studio_boards_sequence ON kazikastudio.studio_boards(studio_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_studio_boards_workflow_id ON kazikastudio.studio_boards(workflow_id);
CREATE INDEX IF NOT EXISTS idx_studio_boards_status ON kazikastudio.studio_boards(status);
CREATE INDEX IF NOT EXISTS idx_studio_boards_created_at ON kazikastudio.studio_boards(created_at DESC);

-- Enable Row Level Security
ALTER TABLE kazikastudio.studio_boards ENABLE ROW LEVEL SECURITY;

-- Create policies (studio_boardsは所属するstudioの所有者のみアクセス可能)
CREATE POLICY "Users can view own studio boards"
  ON kazikastudio.studio_boards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = studio_boards.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own studio boards"
  ON kazikastudio.studio_boards
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = studio_boards.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own studio boards"
  ON kazikastudio.studio_boards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = studio_boards.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own studio boards"
  ON kazikastudio.studio_boards
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = studio_boards.studio_id
      AND studios.user_id = auth.uid()
    )
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_studio_boards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_studio_boards_updated ON kazikastudio.studio_boards;
CREATE TRIGGER on_studio_boards_updated
  BEFORE UPDATE ON kazikastudio.studio_boards
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_studio_boards_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.studio_boards IS '時系列で並ぶストーリーボード（各シーン）を管理するテーブル';
COMMENT ON COLUMN kazikastudio.studio_boards.studio_id IS '所属するスタジオID';
COMMENT ON COLUMN kazikastudio.studio_boards.sequence_order IS '時系列順序（0から始まる整数）';
COMMENT ON COLUMN kazikastudio.studio_boards.title IS 'シーンのタイトル';
COMMENT ON COLUMN kazikastudio.studio_boards.description IS 'シーンの説明';
COMMENT ON COLUMN kazikastudio.studio_boards.workflow_id IS '使用するワークフローID';
COMMENT ON COLUMN kazikastudio.studio_boards.audio_output_id IS '生成された音声のID';
COMMENT ON COLUMN kazikastudio.studio_boards.image_output_id IS '生成された画像のID';
COMMENT ON COLUMN kazikastudio.studio_boards.video_output_id IS '生成された動画のID';
COMMENT ON COLUMN kazikastudio.studio_boards.custom_audio_url IS 'カスタムアップロードされた音声URL';
COMMENT ON COLUMN kazikastudio.studio_boards.custom_image_url IS 'カスタムアップロードされた画像URL';
COMMENT ON COLUMN kazikastudio.studio_boards.custom_video_url IS 'カスタムアップロードされた動画URL';
COMMENT ON COLUMN kazikastudio.studio_boards.prompt_text IS 'このシーンのプロンプト';
COMMENT ON COLUMN kazikastudio.studio_boards.duration_seconds IS 'シーンの長さ（秒）';
COMMENT ON COLUMN kazikastudio.studio_boards.status IS 'ステータス: draft, processing, completed, error';
COMMENT ON COLUMN kazikastudio.studio_boards.error_message IS 'エラー時のメッセージ';
COMMENT ON COLUMN kazikastudio.studio_boards.metadata IS '追加メタデータ（トランジション効果等）';

-- Grant permissions
GRANT ALL ON kazikastudio.studio_boards TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.studio_boards_id_seq TO anon, authenticated;

-- =====================================================
-- マイグレーション完了
-- =====================================================
