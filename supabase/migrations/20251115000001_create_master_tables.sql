-- =====================================================
-- マスターテーブル作成
-- =====================================================
-- eleven_labs_tags: ElevenLabsのタグマスター
-- m_camera_angles: カメラアングルマスター
-- m_camera_movements: カメラムーブメントマスター
-- m_shot_distances: ショット距離マスター
-- =====================================================

-- =====================================================
-- 1. ElevenLabsタグマスター (kazikastudio.eleven_labs_tags)
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.eleven_labs_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_eleven_labs_tags_name ON kazikastudio.eleven_labs_tags(name);
CREATE INDEX IF NOT EXISTS idx_eleven_labs_tags_sort_order ON kazikastudio.eleven_labs_tags(sort_order);
CREATE INDEX IF NOT EXISTS idx_eleven_labs_tags_is_active ON kazikastudio.eleven_labs_tags(is_active);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_eleven_labs_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_eleven_labs_tags_updated ON kazikastudio.eleven_labs_tags;
CREATE TRIGGER on_eleven_labs_tags_updated
  BEFORE UPDATE ON kazikastudio.eleven_labs_tags
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_eleven_labs_tags_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.eleven_labs_tags IS 'ElevenLabsのタグマスターテーブル';
COMMENT ON COLUMN kazikastudio.eleven_labs_tags.name IS 'タグ名';
COMMENT ON COLUMN kazikastudio.eleven_labs_tags.description IS 'タグの説明';
COMMENT ON COLUMN kazikastudio.eleven_labs_tags.sort_order IS '表示順序';
COMMENT ON COLUMN kazikastudio.eleven_labs_tags.is_active IS '有効フラグ';

-- Grant permissions (マスターテーブルは全ユーザーが参照可能)
GRANT SELECT ON kazikastudio.eleven_labs_tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON kazikastudio.eleven_labs_tags TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.eleven_labs_tags_id_seq TO anon, authenticated;

-- =====================================================
-- 2. カメラアングルマスター (kazikastudio.m_camera_angles)
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_camera_angles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_camera_angles_name ON kazikastudio.m_camera_angles(name);
CREATE INDEX IF NOT EXISTS idx_m_camera_angles_sort_order ON kazikastudio.m_camera_angles(sort_order);
CREATE INDEX IF NOT EXISTS idx_m_camera_angles_is_active ON kazikastudio.m_camera_angles(is_active);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_m_camera_angles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_m_camera_angles_updated ON kazikastudio.m_camera_angles;
CREATE TRIGGER on_m_camera_angles_updated
  BEFORE UPDATE ON kazikastudio.m_camera_angles
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_m_camera_angles_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.m_camera_angles IS 'カメラアングルマスターテーブル';
COMMENT ON COLUMN kazikastudio.m_camera_angles.name IS 'アングル名';
COMMENT ON COLUMN kazikastudio.m_camera_angles.description IS 'アングルの説明';
COMMENT ON COLUMN kazikastudio.m_camera_angles.sort_order IS '表示順序';
COMMENT ON COLUMN kazikastudio.m_camera_angles.is_active IS '有効フラグ';

-- Grant permissions
GRANT SELECT ON kazikastudio.m_camera_angles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON kazikastudio.m_camera_angles TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.m_camera_angles_id_seq TO anon, authenticated;

-- =====================================================
-- 3. カメラムーブメントマスター (kazikastudio.m_camera_movements)
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_camera_movements (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_camera_movements_name ON kazikastudio.m_camera_movements(name);
CREATE INDEX IF NOT EXISTS idx_m_camera_movements_sort_order ON kazikastudio.m_camera_movements(sort_order);
CREATE INDEX IF NOT EXISTS idx_m_camera_movements_is_active ON kazikastudio.m_camera_movements(is_active);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_m_camera_movements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_m_camera_movements_updated ON kazikastudio.m_camera_movements;
CREATE TRIGGER on_m_camera_movements_updated
  BEFORE UPDATE ON kazikastudio.m_camera_movements
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_m_camera_movements_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.m_camera_movements IS 'カメラムーブメントマスターテーブル';
COMMENT ON COLUMN kazikastudio.m_camera_movements.name IS 'ムーブメント名';
COMMENT ON COLUMN kazikastudio.m_camera_movements.description IS 'ムーブメントの説明';
COMMENT ON COLUMN kazikastudio.m_camera_movements.sort_order IS '表示順序';
COMMENT ON COLUMN kazikastudio.m_camera_movements.is_active IS '有効フラグ';

-- Grant permissions
GRANT SELECT ON kazikastudio.m_camera_movements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON kazikastudio.m_camera_movements TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.m_camera_movements_id_seq TO anon, authenticated;

-- =====================================================
-- 4. ショット距離マスター (kazikastudio.m_shot_distances)
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_shot_distances (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_shot_distances_name ON kazikastudio.m_shot_distances(name);
CREATE INDEX IF NOT EXISTS idx_m_shot_distances_sort_order ON kazikastudio.m_shot_distances(sort_order);
CREATE INDEX IF NOT EXISTS idx_m_shot_distances_is_active ON kazikastudio.m_shot_distances(is_active);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_m_shot_distances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_m_shot_distances_updated ON kazikastudio.m_shot_distances;
CREATE TRIGGER on_m_shot_distances_updated
  BEFORE UPDATE ON kazikastudio.m_shot_distances
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_m_shot_distances_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.m_shot_distances IS 'ショット距離マスターテーブル';
COMMENT ON COLUMN kazikastudio.m_shot_distances.name IS 'ショット距離名';
COMMENT ON COLUMN kazikastudio.m_shot_distances.description IS 'ショット距離の説明';
COMMENT ON COLUMN kazikastudio.m_shot_distances.sort_order IS '表示順序';
COMMENT ON COLUMN kazikastudio.m_shot_distances.is_active IS '有効フラグ';

-- Grant permissions
GRANT SELECT ON kazikastudio.m_shot_distances TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON kazikastudio.m_shot_distances TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.m_shot_distances_id_seq TO anon, authenticated;

-- =====================================================
-- 初期データ投入
-- =====================================================

-- ElevenLabsタグの初期データ
INSERT INTO kazikastudio.eleven_labs_tags (name, description, sort_order) VALUES
  ('narration', 'ナレーション用', 10),
  ('character', 'キャラクター用', 20),
  ('emotion', '感情表現用', 30)
ON CONFLICT (name) DO NOTHING;

-- カメラアングルの初期データ
INSERT INTO kazikastudio.m_camera_angles (name, description, sort_order) VALUES
  ('eye level', '目線の高さ', 10),
  ('high angle', 'ハイアングル（上から見下ろす）', 20),
  ('low angle', 'ローアングル（下から見上げる）', 30),
  ('birds eye', '鳥瞰（真上から）', 40),
  ('dutch angle', 'ダッチアングル（斜め）', 50)
ON CONFLICT (name) DO NOTHING;

-- カメラムーブメントの初期データ
INSERT INTO kazikastudio.m_camera_movements (name, description, sort_order) VALUES
  ('static', '固定', 10),
  ('pan', 'パン（水平移動）', 20),
  ('tilt', 'チルト（垂直移動）', 30),
  ('dolly', 'ドリー（前後移動）', 40),
  ('zoom', 'ズーム', 50),
  ('tracking', 'トラッキング（追従）', 60)
ON CONFLICT (name) DO NOTHING;

-- ショット距離の初期データ
INSERT INTO kazikastudio.m_shot_distances (name, description, sort_order) VALUES
  ('extreme close up', '極端なクローズアップ', 10),
  ('close up', 'クローズアップ', 20),
  ('medium close up', 'ミディアムクローズアップ', 30),
  ('medium shot', 'ミディアムショット', 40),
  ('medium long shot', 'ミディアムロングショット', 50),
  ('long shot', 'ロングショット', 60),
  ('extreme long shot', '極端なロングショット', 70)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- マイグレーション完了
-- =====================================================
