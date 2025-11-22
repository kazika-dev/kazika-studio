-- =====================================================
-- 画像素材マスターテーブルの作成
-- =====================================================
-- 画像素材ファイル管理のためのマスターテーブル
-- 画像ファイルはGCP Storageに保存し、ファイル名で管理
-- =====================================================

-- =====================================================
-- 画像素材マスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_image_materials (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_name TEXT NOT NULL UNIQUE,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  category TEXT DEFAULT '背景',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_image_materials_name ON kazikastudio.m_image_materials(name);
CREATE INDEX IF NOT EXISTS idx_m_image_materials_file_name ON kazikastudio.m_image_materials(file_name);
CREATE INDEX IF NOT EXISTS idx_m_image_materials_category ON kazikastudio.m_image_materials(category);
CREATE INDEX IF NOT EXISTS idx_m_image_materials_tags ON kazikastudio.m_image_materials USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_m_image_materials_created_at ON kazikastudio.m_image_materials(created_at DESC);

-- Add comments
COMMENT ON TABLE kazikastudio.m_image_materials IS '画像素材マスターテーブル - GCP Storageの画像ファイルを管理';
COMMENT ON COLUMN kazikastudio.m_image_materials.id IS '画像素材ID';
COMMENT ON COLUMN kazikastudio.m_image_materials.name IS '素材名（表示用）';
COMMENT ON COLUMN kazikastudio.m_image_materials.description IS '素材の説明';
COMMENT ON COLUMN kazikastudio.m_image_materials.file_name IS 'GCP Storageのファイル名（例: materials/bg-school-001.png）';
COMMENT ON COLUMN kazikastudio.m_image_materials.width IS '画像の幅（ピクセル）';
COMMENT ON COLUMN kazikastudio.m_image_materials.height IS '画像の高さ（ピクセル）';
COMMENT ON COLUMN kazikastudio.m_image_materials.file_size_bytes IS 'ファイルサイズ（バイト）';
COMMENT ON COLUMN kazikastudio.m_image_materials.category IS 'カテゴリ（例: 背景, キャラクター, テクスチャ, パーツ, その他）';
COMMENT ON COLUMN kazikastudio.m_image_materials.tags IS 'タグ配列（検索用）';

-- Create trigger for updated_at
CREATE TRIGGER set_m_image_materials_updated_at
  BEFORE UPDATE ON kazikastudio.m_image_materials
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security (全ユーザーが読み取り可能、管理者のみ編集可能)
ALTER TABLE kazikastudio.m_image_materials ENABLE ROW LEVEL SECURITY;

-- Create policies (全ユーザーが参照可能)
CREATE POLICY "Anyone can view image materials"
  ON kazikastudio.m_image_materials
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert image materials"
  ON kazikastudio.m_image_materials
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update image materials"
  ON kazikastudio.m_image_materials
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete image materials"
  ON kazikastudio.m_image_materials
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert initial sample data
INSERT INTO kazikastudio.m_image_materials (name, description, file_name, category, tags, width, height) VALUES
  ('学校背景01', '昼間の学校の廊下', 'materials/bg-school-corridor-day.png', '背景', ARRAY['学校', '廊下', '昼間'], 1920, 1080),
  ('学校背景02', '夕暮れの教室', 'materials/bg-classroom-sunset.png', '背景', ARRAY['学校', '教室', '夕方'], 1920, 1080),
  ('笑顔表情', 'キャラクター用の笑顔表情パーツ', 'materials/emotion-happy.png', 'キャラクター', ARRAY['表情', '笑顔', 'ハッピー'], 512, 512),
  ('木の床テクスチャ', '木の床のテクスチャ素材', 'materials/texture-wood-floor.jpg', 'テクスチャ', ARRAY['木材', '床', 'テクスチャ'], 1024, 1024),
  ('アクセサリー01', 'キャラクター用のアクセサリーパーツ', 'materials/parts-accessory-001.png', 'パーツ', ARRAY['アクセサリー', 'パーツ'], 256, 256)
ON CONFLICT DO NOTHING;
