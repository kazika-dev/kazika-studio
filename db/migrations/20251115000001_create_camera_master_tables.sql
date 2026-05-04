-- =====================================================
-- カメラ関連マスターテーブルの作成
-- =====================================================
-- 映像制作のためのマスターデータテーブル
-- - kazikastudio.m_camera_angles: カメラアングル
-- - kazikastudio.m_camera_movements: カメラムーブメント
-- - kazikastudio.m_shot_distances: ショット距離
-- =====================================================

-- =====================================================
-- 1. カメラアングルマスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_camera_angles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_camera_angles_name ON kazikastudio.m_camera_angles(name);
CREATE INDEX IF NOT EXISTS idx_m_camera_angles_created_at ON kazikastudio.m_camera_angles(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER set_m_camera_angles_updated_at
  BEFORE UPDATE ON kazikastudio.m_camera_angles
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security (全ユーザーが読み取り可能、管理者のみ編集可能)
ALTER TABLE kazikastudio.m_camera_angles ENABLE ROW LEVEL SECURITY;

-- Create policies (全ユーザーが参照可能)
CREATE POLICY "Anyone can view camera angles"
  ON kazikastudio.m_camera_angles
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert camera angles"
  ON kazikastudio.m_camera_angles
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update camera angles"
  ON kazikastudio.m_camera_angles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete camera angles"
  ON kazikastudio.m_camera_angles
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert initial data
INSERT INTO kazikastudio.m_camera_angles (name, description) VALUES
  ('ローアングル', 'Low Angle - 被写体を下から見上げる'),
  ('ハイアングル', 'High Angle - 被写体を上から見下ろす'),
  ('アイレベル', 'Eye Level - 被写体と同じ目線の高さ'),
  ('バーズアイビュー', 'Bird''s Eye View - 真上から見下ろす'),
  ('ワームズアイビュー', 'Worm''s Eye View - 真下から見上げる'),
  ('ダッチアングル', 'Dutch Angle - カメラを傾けた構図')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. カメラムーブメントマスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_camera_movements (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_camera_movements_name ON kazikastudio.m_camera_movements(name);
CREATE INDEX IF NOT EXISTS idx_m_camera_movements_created_at ON kazikastudio.m_camera_movements(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER set_m_camera_movements_updated_at
  BEFORE UPDATE ON kazikastudio.m_camera_movements
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE kazikastudio.m_camera_movements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view camera movements"
  ON kazikastudio.m_camera_movements
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert camera movements"
  ON kazikastudio.m_camera_movements
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update camera movements"
  ON kazikastudio.m_camera_movements
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete camera movements"
  ON kazikastudio.m_camera_movements
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert initial data
INSERT INTO kazikastudio.m_camera_movements (name, description) VALUES
  ('固定', 'Static - カメラを固定'),
  ('パン', 'Pan - 水平方向の回転'),
  ('チルト', 'Tilt - 垂直方向の回転'),
  ('ズーム', 'Zoom - ズームイン/アウト'),
  ('ドリー', 'Dolly - カメラごと前後移動'),
  ('トラック', 'Track - カメラごと左右移動'),
  ('クレーン', 'Crane - カメラを上下移動'),
  ('ハンドヘルド', 'Handheld - 手持ち撮影'),
  ('ステディカム', 'Steadicam - 安定化装置を使用')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. ショット距離マスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_shot_distances (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_shot_distances_name ON kazikastudio.m_shot_distances(name);
CREATE INDEX IF NOT EXISTS idx_m_shot_distances_created_at ON kazikastudio.m_shot_distances(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER set_m_shot_distances_updated_at
  BEFORE UPDATE ON kazikastudio.m_shot_distances
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE kazikastudio.m_shot_distances ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view shot distances"
  ON kazikastudio.m_shot_distances
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert shot distances"
  ON kazikastudio.m_shot_distances
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update shot distances"
  ON kazikastudio.m_shot_distances
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete shot distances"
  ON kazikastudio.m_shot_distances
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert initial data
INSERT INTO kazikastudio.m_shot_distances (name, description) VALUES
  ('エクストリームクローズアップ', 'Extreme Close-Up (ECU) - 顔の一部など極端に接近'),
  ('クローズアップ', 'Close-Up (CU) - 顔全体'),
  ('ミディアムクローズアップ', 'Medium Close-Up (MCU) - 胸から上'),
  ('ミディアムショット', 'Medium Shot (MS) - 腰から上'),
  ('ミディアムロングショット', 'Medium Long Shot (MLS) - 膝から上'),
  ('ロングショット', 'Long Shot (LS) - 全身'),
  ('エクストリームロングショット', 'Extreme Long Shot (ELS) - 人物と周囲の環境全体')
ON CONFLICT DO NOTHING;
