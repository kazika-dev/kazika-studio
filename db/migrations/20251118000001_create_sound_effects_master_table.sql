-- =====================================================
-- 効果音マスターテーブルの作成
-- =====================================================
-- 効果音ファイル管理のためのマスターテーブル
-- 音声ファイルはGCP Storageに保存し、ファイル名で管理
-- =====================================================

-- =====================================================
-- 効果音マスターテーブル
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_sound_effects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  file_name TEXT NOT NULL UNIQUE,
  duration_seconds NUMERIC(10, 2),
  file_size_bytes BIGINT,
  category TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_m_sound_effects_name ON kazikastudio.m_sound_effects(name);
CREATE INDEX IF NOT EXISTS idx_m_sound_effects_file_name ON kazikastudio.m_sound_effects(file_name);
CREATE INDEX IF NOT EXISTS idx_m_sound_effects_category ON kazikastudio.m_sound_effects(category);
CREATE INDEX IF NOT EXISTS idx_m_sound_effects_tags ON kazikastudio.m_sound_effects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_m_sound_effects_created_at ON kazikastudio.m_sound_effects(created_at DESC);

-- Add comments
COMMENT ON TABLE kazikastudio.m_sound_effects IS '効果音マスターテーブル - GCP Storageの音声ファイルを管理';
COMMENT ON COLUMN kazikastudio.m_sound_effects.id IS '効果音ID';
COMMENT ON COLUMN kazikastudio.m_sound_effects.name IS '効果音名（表示用）';
COMMENT ON COLUMN kazikastudio.m_sound_effects.description IS '効果音の説明';
COMMENT ON COLUMN kazikastudio.m_sound_effects.file_name IS 'GCP Storageのファイル名（例: audio/sound-effects/door-knock.mp3）';
COMMENT ON COLUMN kazikastudio.m_sound_effects.duration_seconds IS '音声ファイルの長さ（秒）';
COMMENT ON COLUMN kazikastudio.m_sound_effects.file_size_bytes IS 'ファイルサイズ（バイト）';
COMMENT ON COLUMN kazikastudio.m_sound_effects.category IS 'カテゴリ（例: 環境音, 効果音, BGM）';
COMMENT ON COLUMN kazikastudio.m_sound_effects.tags IS 'タグ配列（検索用）';

-- Create trigger for updated_at
CREATE TRIGGER set_m_sound_effects_updated_at
  BEFORE UPDATE ON kazikastudio.m_sound_effects
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security (全ユーザーが読み取り可能、管理者のみ編集可能)
ALTER TABLE kazikastudio.m_sound_effects ENABLE ROW LEVEL SECURITY;

-- Create policies (全ユーザーが参照可能)
CREATE POLICY "Anyone can view sound effects"
  ON kazikastudio.m_sound_effects
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert sound effects"
  ON kazikastudio.m_sound_effects
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update sound effects"
  ON kazikastudio.m_sound_effects
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete sound effects"
  ON kazikastudio.m_sound_effects
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert initial sample data
INSERT INTO kazikastudio.m_sound_effects (name, description, file_name, category, tags) VALUES
  ('ドアノック', 'ドアをノックする音', 'audio/sound-effects/door-knock.mp3', '環境音', ARRAY['ドア', 'ノック', '室内']),
  ('足音（木の床）', '木の床を歩く足音', 'audio/sound-effects/footsteps-wood.mp3', '環境音', ARRAY['足音', '歩く', '木の床']),
  ('鳥のさえずり', '朝の鳥のさえずり', 'audio/sound-effects/birds-chirping.mp3', '環境音', ARRAY['鳥', '自然', '朝']),
  ('爆発音', '大きな爆発音', 'audio/sound-effects/explosion.mp3', '効果音', ARRAY['爆発', 'アクション']),
  ('雨音', '雨が降る音', 'audio/sound-effects/rain.mp3', '環境音', ARRAY['雨', '天気', '自然']),
  ('風の音', '強い風の音', 'audio/sound-effects/wind.mp3', '環境音', ARRAY['風', '天気', '自然'])
ON CONFLICT DO NOTHING;
