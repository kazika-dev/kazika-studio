-- =====================================================
-- シーン素材候補テーブル
-- =====================================================
-- 画像/動画/セリフ音声/BGM/効果音など、1つのシーンに紐づく
-- 採用前/採用済み/却下済みの素材候補を統一管理する。
-- 実際の編集配置は別途 scene_timeline_* で扱う想定。
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.scene_assets (
  id BIGSERIAL PRIMARY KEY,
  scene_id BIGINT NOT NULL REFERENCES kazikastudio.m_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('image', 'video', 'dialogue', 'bgm', 'sfx', 'audio', 'file', 'other')),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'selected', 'rejected', 'archived')),
  content_url TEXT NOT NULL,
  title TEXT,
  prompt TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scene_assets_scene_id ON kazikastudio.scene_assets(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_assets_user_id ON kazikastudio.scene_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_scene_assets_output_id ON kazikastudio.scene_assets(output_id);
CREATE INDEX IF NOT EXISTS idx_scene_assets_type_status ON kazikastudio.scene_assets(asset_type, status);
CREATE INDEX IF NOT EXISTS idx_scene_assets_sort ON kazikastudio.scene_assets(scene_id, asset_type, rank ASC, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_assets_scene_type_url_unique ON kazikastudio.scene_assets(scene_id, asset_type, content_url);

CREATE OR REPLACE FUNCTION kazikastudio.handle_scene_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_scene_assets_updated ON kazikastudio.scene_assets;
CREATE TRIGGER on_scene_assets_updated
  BEFORE UPDATE ON kazikastudio.scene_assets
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_scene_assets_updated_at();

ALTER TABLE kazikastudio.scene_assets DISABLE ROW LEVEL SECURITY;

-- 直前の m_scene_images 実装から汎用素材候補へ移行。
INSERT INTO kazikastudio.scene_assets
  (scene_id, user_id, output_id, asset_type, status, content_url, title, prompt, rank, is_primary, metadata, created_at, updated_at)
SELECT
  scene_id,
  user_id,
  output_id,
  'image',
  CASE WHEN is_primary THEN 'selected' ELSE 'candidate' END,
  image_url,
  title,
  prompt,
  sort_order,
  is_primary,
  metadata || jsonb_build_object('source_table', 'm_scene_images'),
  created_at,
  updated_at
FROM kazikastudio.m_scene_images
ON CONFLICT (scene_id, asset_type, content_url) DO NOTHING;

-- m_scene_images がない/空の環境でも既存代表画像を素材候補化する。
INSERT INTO kazikastudio.scene_assets
  (scene_id, user_id, asset_type, status, content_url, title, rank, is_primary, metadata)
SELECT
  id,
  user_id,
  'image',
  'selected',
  image_url,
  name,
  0,
  true,
  jsonb_build_object('source', 'm_scenes.image_url_backfill')
FROM kazikastudio.m_scenes
WHERE image_url IS NOT NULL
  AND user_id IS NOT NULL
ON CONFLICT (scene_id, asset_type, content_url) DO NOTHING;

COMMENT ON TABLE kazikastudio.scene_assets IS 'シーンごとの画像/動画/音声/BGM/SEなどの素材候補。採用状態も保持する。';
COMMENT ON COLUMN kazikastudio.scene_assets.asset_type IS '素材タイプ: image, video, dialogue, bgm, sfx, audio, file, other';
COMMENT ON COLUMN kazikastudio.scene_assets.status IS '候補状態: candidate, selected, rejected, archived';
COMMENT ON COLUMN kazikastudio.scene_assets.content_url IS 'GCSストレージパスまたは外部URL';
COMMENT ON COLUMN kazikastudio.scene_assets.rank IS '候補表示順/優先度';
