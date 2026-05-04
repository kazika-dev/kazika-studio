-- =====================================================
-- プロンプトキュー機能
-- 画像生成用のプロンプトと参照画像をキューとして保存・管理
-- =====================================================

-- =====================================================
-- 1. prompt_queues テーブル（メインテーブル）
-- =====================================================
CREATE TABLE IF NOT EXISTS kazikastudio.prompt_queues (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,                                          -- キュー名（任意の識別名）
  prompt TEXT NOT NULL,                               -- 画像生成プロンプト
  negative_prompt TEXT,                               -- ネガティブプロンプト
  model TEXT DEFAULT 'gemini-2.5-flash-image',        -- 使用するモデル
  aspect_ratio TEXT DEFAULT '16:9',                   -- アスペクト比
  priority INTEGER NOT NULL DEFAULT 0,                -- 優先度（高いほど先に処理）
  status TEXT NOT NULL DEFAULT 'pending',             -- ステータス
  metadata JSONB DEFAULT '{}',                        -- その他のメタデータ
  error_message TEXT,                                 -- エラーメッセージ（失敗時）
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,  -- 生成結果のoutput ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ                             -- 実行日時
);

-- ステータス値のチェック制約
ALTER TABLE kazikastudio.prompt_queues
  ADD CONSTRAINT chk_prompt_queues_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- インデックス
CREATE INDEX IF NOT EXISTS idx_prompt_queues_user_id ON kazikastudio.prompt_queues(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_queues_status ON kazikastudio.prompt_queues(status);
CREATE INDEX IF NOT EXISTS idx_prompt_queues_priority_created ON kazikastudio.prompt_queues(priority DESC, created_at ASC);

-- RLS有効化
ALTER TABLE kazikastudio.prompt_queues ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のキューのみアクセス可能
DROP POLICY IF EXISTS "Users can view own prompt_queues" ON kazikastudio.prompt_queues;
CREATE POLICY "Users can view own prompt_queues"
  ON kazikastudio.prompt_queues
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own prompt_queues" ON kazikastudio.prompt_queues;
CREATE POLICY "Users can insert own prompt_queues"
  ON kazikastudio.prompt_queues
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own prompt_queues" ON kazikastudio.prompt_queues;
CREATE POLICY "Users can update own prompt_queues"
  ON kazikastudio.prompt_queues
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own prompt_queues" ON kazikastudio.prompt_queues;
CREATE POLICY "Users can delete own prompt_queues"
  ON kazikastudio.prompt_queues
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at自動更新用トリガー
CREATE OR REPLACE FUNCTION kazikastudio.update_prompt_queues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_prompt_queues_updated_at ON kazikastudio.prompt_queues;
CREATE TRIGGER update_prompt_queues_updated_at
  BEFORE UPDATE ON kazikastudio.prompt_queues
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_prompt_queues_updated_at();

-- パーミッション付与
GRANT ALL ON kazikastudio.prompt_queues TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.prompt_queues_id_seq TO anon, authenticated;

-- =====================================================
-- 2. prompt_queue_images テーブル（参照画像、多対多関係）
-- 1つのキューに対して最大8枚までの参照画像を登録可能
-- =====================================================
CREATE TABLE IF NOT EXISTS kazikastudio.prompt_queue_images (
  id BIGSERIAL PRIMARY KEY,
  queue_id BIGINT NOT NULL REFERENCES kazikastudio.prompt_queues(id) ON DELETE CASCADE,
  image_type TEXT NOT NULL,                           -- 画像タイプ: 'character_sheet' or 'output'
  reference_id BIGINT NOT NULL,                       -- 参照先のID
  display_order INTEGER NOT NULL DEFAULT 0,           -- 表示順序（0〜7）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 画像タイプのチェック制約
ALTER TABLE kazikastudio.prompt_queue_images
  ADD CONSTRAINT chk_prompt_queue_images_type
  CHECK (image_type IN ('character_sheet', 'output'));

-- 表示順序の範囲制限（最大8枚）
ALTER TABLE kazikastudio.prompt_queue_images
  ADD CONSTRAINT chk_prompt_queue_images_order
  CHECK (display_order >= 0 AND display_order < 8);

-- 同じ画像の重複登録を防止
ALTER TABLE kazikastudio.prompt_queue_images
  ADD CONSTRAINT uq_prompt_queue_images_unique
  UNIQUE (queue_id, image_type, reference_id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_prompt_queue_images_queue_id ON kazikastudio.prompt_queue_images(queue_id);
CREATE INDEX IF NOT EXISTS idx_prompt_queue_images_order ON kazikastudio.prompt_queue_images(queue_id, display_order);

-- RLS有効化
ALTER TABLE kazikastudio.prompt_queue_images ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: キューの所有者のみアクセス可能
DROP POLICY IF EXISTS "Users can view own prompt_queue_images" ON kazikastudio.prompt_queue_images;
CREATE POLICY "Users can view own prompt_queue_images"
  ON kazikastudio.prompt_queue_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.prompt_queues
      WHERE prompt_queues.id = prompt_queue_images.queue_id
      AND prompt_queues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own prompt_queue_images" ON kazikastudio.prompt_queue_images;
CREATE POLICY "Users can insert own prompt_queue_images"
  ON kazikastudio.prompt_queue_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.prompt_queues
      WHERE prompt_queues.id = prompt_queue_images.queue_id
      AND prompt_queues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own prompt_queue_images" ON kazikastudio.prompt_queue_images;
CREATE POLICY "Users can update own prompt_queue_images"
  ON kazikastudio.prompt_queue_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.prompt_queues
      WHERE prompt_queues.id = prompt_queue_images.queue_id
      AND prompt_queues.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own prompt_queue_images" ON kazikastudio.prompt_queue_images;
CREATE POLICY "Users can delete own prompt_queue_images"
  ON kazikastudio.prompt_queue_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.prompt_queues
      WHERE prompt_queues.id = prompt_queue_images.queue_id
      AND prompt_queues.user_id = auth.uid()
    )
  );

-- パーミッション付与
GRANT ALL ON kazikastudio.prompt_queue_images TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.prompt_queue_images_id_seq TO anon, authenticated;

-- =====================================================
-- コメント
-- =====================================================
COMMENT ON TABLE kazikastudio.prompt_queues IS 'プロンプトキュー - 画像生成用のプロンプトと参照画像を保存';
COMMENT ON COLUMN kazikastudio.prompt_queues.status IS 'ステータス: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN kazikastudio.prompt_queues.priority IS '優先度 - 高いほど先に処理される';
COMMENT ON COLUMN kazikastudio.prompt_queues.output_id IS '生成結果のworkflow_outputs.id';

COMMENT ON TABLE kazikastudio.prompt_queue_images IS 'プロンプトキューの参照画像 - キャラクターシートまたはアウトプットから最大8枚';
COMMENT ON COLUMN kazikastudio.prompt_queue_images.image_type IS '画像タイプ: character_sheet または output';
COMMENT ON COLUMN kazikastudio.prompt_queue_images.reference_id IS 'character_sheets.id または workflow_outputs.id';
COMMENT ON COLUMN kazikastudio.prompt_queue_images.display_order IS '表示順序（0〜7）- 画像生成時に左から順に配置';
