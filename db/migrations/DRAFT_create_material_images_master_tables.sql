-- =====================================================
-- 素材画像マスターテーブルの作成
-- =====================================================
-- ワークフローで使用する画像素材を一元管理するためのマスターテーブル
-- 画像ファイルはGCP Storageに保存し、storage_pathで管理
-- =====================================================

-- =====================================================
-- カテゴリマスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_material_image_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '',                         -- MUIアイコン名
  color TEXT DEFAULT '#1976d2',                 -- カテゴリカラー
  sequence_order INTEGER DEFAULT 0,             -- 表示順序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_material_image_categories_name ON kazikastudio.m_material_image_categories(name);
CREATE INDEX IF NOT EXISTS idx_m_material_image_categories_sequence ON kazikastudio.m_material_image_categories(sequence_order);

-- Add comments
COMMENT ON TABLE kazikastudio.m_material_image_categories IS '素材画像カテゴリマスターテーブル';
COMMENT ON COLUMN kazikastudio.m_material_image_categories.id IS 'カテゴリID';
COMMENT ON COLUMN kazikastudio.m_material_image_categories.name IS 'カテゴリ名';
COMMENT ON COLUMN kazikastudio.m_material_image_categories.description IS 'カテゴリの説明';
COMMENT ON COLUMN kazikastudio.m_material_image_categories.icon IS 'MUIアイコン名（例: Landscape, Person, Category）';
COMMENT ON COLUMN kazikastudio.m_material_image_categories.color IS 'カテゴリカラー（例: #1976d2）';
COMMENT ON COLUMN kazikastudio.m_material_image_categories.sequence_order IS '表示順序';

-- Create trigger for updated_at
CREATE TRIGGER set_m_material_image_categories_updated_at
  BEFORE UPDATE ON kazikastudio.m_material_image_categories
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE kazikastudio.m_material_image_categories ENABLE ROW LEVEL SECURITY;

-- Create policies (全ユーザーが参照可能)
CREATE POLICY "Anyone can view material image categories"
  ON kazikastudio.m_material_image_categories
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert material image categories"
  ON kazikastudio.m_material_image_categories
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update material image categories"
  ON kazikastudio.m_material_image_categories
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete material image categories"
  ON kazikastudio.m_material_image_categories
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 素材画像マスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_material_images (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  storage_path TEXT NOT NULL UNIQUE,            -- GCP Storageのファイルパス
  thumbnail_path TEXT,                          -- サムネイル画像のパス（オプション）
  category_id BIGINT REFERENCES kazikastudio.m_material_image_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',                     -- タグ配列（検索用）
  width INTEGER,                                -- 画像の幅（ピクセル）
  height INTEGER,                               -- 画像の高さ（ピクセル）
  file_size_bytes BIGINT,                       -- ファイルサイズ（バイト）
  mime_type TEXT DEFAULT 'image/png',           -- MIMEタイプ
  metadata JSONB DEFAULT '{}'::jsonb,           -- 追加メタデータ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_material_images_name ON kazikastudio.m_material_images(name);
CREATE INDEX IF NOT EXISTS idx_m_material_images_storage_path ON kazikastudio.m_material_images(storage_path);
CREATE INDEX IF NOT EXISTS idx_m_material_images_category_id ON kazikastudio.m_material_images(category_id);
CREATE INDEX IF NOT EXISTS idx_m_material_images_tags ON kazikastudio.m_material_images USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_m_material_images_created_at ON kazikastudio.m_material_images(created_at DESC);

-- Add comments
COMMENT ON TABLE kazikastudio.m_material_images IS '素材画像マスターテーブル - GCP Storageの画像ファイルを管理';
COMMENT ON COLUMN kazikastudio.m_material_images.id IS '素材画像ID';
COMMENT ON COLUMN kazikastudio.m_material_images.name IS '素材名（表示用）';
COMMENT ON COLUMN kazikastudio.m_material_images.description IS '素材の説明';
COMMENT ON COLUMN kazikastudio.m_material_images.storage_path IS 'GCP Storageのファイルパス（例: images/materials/backgrounds/sakura-tree.png）';
COMMENT ON COLUMN kazikastudio.m_material_images.thumbnail_path IS 'サムネイル画像のパス';
COMMENT ON COLUMN kazikastudio.m_material_images.category_id IS 'カテゴリID（外部キー）';
COMMENT ON COLUMN kazikastudio.m_material_images.tags IS 'タグ配列（検索用）';
COMMENT ON COLUMN kazikastudio.m_material_images.width IS '画像の幅（ピクセル）';
COMMENT ON COLUMN kazikastudio.m_material_images.height IS '画像の高さ（ピクセル）';
COMMENT ON COLUMN kazikastudio.m_material_images.file_size_bytes IS 'ファイルサイズ（バイト）';
COMMENT ON COLUMN kazikastudio.m_material_images.mime_type IS 'MIMEタイプ';
COMMENT ON COLUMN kazikastudio.m_material_images.metadata IS '追加メタデータ';

-- Create trigger for updated_at
CREATE TRIGGER set_m_material_images_updated_at
  BEFORE UPDATE ON kazikastudio.m_material_images
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE kazikastudio.m_material_images ENABLE ROW LEVEL SECURITY;

-- Create policies (全ユーザーが参照可能)
CREATE POLICY "Anyone can view material images"
  ON kazikastudio.m_material_images
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert material images"
  ON kazikastudio.m_material_images
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update material images"
  ON kazikastudio.m_material_images
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete material images"
  ON kazikastudio.m_material_images
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 初期カテゴリデータ
-- =====================================================

INSERT INTO kazikastudio.m_material_image_categories (name, description, icon, color, sequence_order) VALUES
  ('背景', '背景画像（風景、室内など）', 'Landscape', '#1976d2', 0),
  ('キャラクター素材', 'キャラクター関連の素材', 'Person', '#9c27b0', 1),
  ('小物', '小物や道具の素材', 'Category', '#ff9800', 2),
  ('エフェクト', 'エフェクト素材（光、影など）', 'AutoAwesome', '#f44336', 3),
  ('テクスチャ', 'テクスチャ素材', 'Texture', '#4caf50', 4),
  ('その他', 'その他の素材', 'MoreHoriz', '#757575', 5)
ON CONFLICT DO NOTHING;

-- =====================================================
-- サンプルデータ（オプション）
-- =====================================================

-- INSERT INTO kazikastudio.m_material_images (name, description, storage_path, category_id, tags, width, height, mime_type) VALUES
--   ('桜の木の背景', '春の桜の木を描いた背景画像', 'images/materials/backgrounds/sakura-tree.png', 1, ARRAY['背景', '桜', '春', '屋外'], 1920, 1080, 'image/png'),
--   ('学校の屋上', '学校の屋上の背景画像', 'images/materials/backgrounds/school-rooftop.jpg', 1, ARRAY['背景', '学校', '屋上', '都市'], 1920, 1080, 'image/jpeg'),
--   ('女の子（立ち姿）', '立っている女の子のキャラクター素材', 'images/materials/characters/girl-standing.png', 2, ARRAY['キャラクター', '女性', '立つ'], 512, 1024, 'image/png'),
--   ('男の子（歩く）', '歩いている男の子のキャラクター素材', 'images/materials/characters/boy-walking.png', 2, ARRAY['キャラクター', '男性', '歩く'], 512, 1024, 'image/png'),
--   ('本', '本の小物素材', 'images/materials/props/book.png', 3, ARRAY['小物', '本', '文具'], 256, 256, 'image/png'),
--   ('スマートフォン', 'スマートフォンの小物素材', 'images/materials/props/smartphone.png', 3, ARRAY['小物', 'スマホ', '電子機器'], 256, 256, 'image/png'),
--   ('キラキラエフェクト', 'キラキラ光るエフェクト素材', 'images/materials/effects/sparkle.png', 4, ARRAY['エフェクト', '光', 'キラキラ'], 512, 512, 'image/png'),
--   ('影', '人物の影のエフェクト素材', 'images/materials/effects/shadow.png', 4, ARRAY['エフェクト', '影'], 512, 512, 'image/png')
-- ON CONFLICT DO NOTHING;
