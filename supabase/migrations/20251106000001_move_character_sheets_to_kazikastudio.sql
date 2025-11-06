-- =====================================================
-- character_sheetsテーブルをpublicスキーマからkazikastudioスキーマに移動
-- =====================================================

-- kazikastudioスキーマにcharacter_sheetsテーブルを作成
CREATE TABLE IF NOT EXISTS kazikastudio.character_sheets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 既存データを移行（public.character_sheetsが存在する場合）
INSERT INTO kazikastudio.character_sheets (id, user_id, name, image_url, description, metadata, created_at, updated_at)
SELECT id, user_id, name, image_url, description, metadata, created_at, updated_at
FROM public.character_sheets
ON CONFLICT (id) DO NOTHING;

-- シーケンスを更新（最大IDの次から開始）
SELECT setval('kazikastudio.character_sheets_id_seq',
  COALESCE((SELECT MAX(id) FROM kazikastudio.character_sheets), 0) + 1,
  false);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_character_sheets_user_id ON kazikastudio.character_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_character_sheets_created_at ON kazikastudio.character_sheets(created_at DESC);

-- RLSを有効化
ALTER TABLE kazikastudio.character_sheets ENABLE ROW LEVEL SECURITY;

-- RLSポリシーを作成
CREATE POLICY "Users can view their own character sheets"
  ON kazikastudio.character_sheets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own character sheets"
  ON kazikastudio.character_sheets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own character sheets"
  ON kazikastudio.character_sheets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own character sheets"
  ON kazikastudio.character_sheets
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at自動更新用の関数とトリガーを作成
CREATE OR REPLACE FUNCTION kazikastudio.update_character_sheets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_character_sheets_updated_at ON kazikastudio.character_sheets;
CREATE TRIGGER update_character_sheets_updated_at
  BEFORE UPDATE ON kazikastudio.character_sheets
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_character_sheets_updated_at();

-- パーミッションを付与
GRANT ALL ON kazikastudio.character_sheets TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.character_sheets_id_seq TO anon, authenticated;

-- コメントを追加
COMMENT ON TABLE kazikastudio.character_sheets IS 'キャラクターシート情報を保存するテーブル';

-- 旧テーブルを削除（データ移行後）
DROP TABLE IF EXISTS public.character_sheets CASCADE;

-- =====================================================
-- マイグレーション完了
-- =====================================================
