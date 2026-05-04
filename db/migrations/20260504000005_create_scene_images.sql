-- =====================================================
-- シーン画像候補テーブル
-- =====================================================
-- 1つのシーン依頼に対して複数の生成画像候補を保持する。
-- m_scenes.image_url は後方互換の代表画像として残し、
-- 複数候補は m_scene_images に保存する。
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_scene_images (
  id BIGSERIAL PRIMARY KEY,
  scene_id BIGINT NOT NULL REFERENCES kazikastudio.m_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  title TEXT,
  prompt TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_m_scene_images_scene_id ON kazikastudio.m_scene_images(scene_id);
CREATE INDEX IF NOT EXISTS idx_m_scene_images_user_id ON kazikastudio.m_scene_images(user_id);
CREATE INDEX IF NOT EXISTS idx_m_scene_images_output_id ON kazikastudio.m_scene_images(output_id);
CREATE INDEX IF NOT EXISTS idx_m_scene_images_sort ON kazikastudio.m_scene_images(scene_id, sort_order ASC, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_m_scene_images_scene_image_url_unique ON kazikastudio.m_scene_images(scene_id, image_url);

CREATE OR REPLACE FUNCTION kazikastudio.handle_m_scene_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_m_scene_images_updated ON kazikastudio.m_scene_images;
CREATE TRIGGER on_m_scene_images_updated
  BEFORE UPDATE ON kazikastudio.m_scene_images
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_m_scene_images_updated_at();

ALTER TABLE kazikastudio.m_scene_images DISABLE ROW LEVEL SECURITY;

INSERT INTO kazikastudio.m_scene_images
  (scene_id, user_id, image_url, title, sort_order, is_primary, metadata)
SELECT
  id,
  user_id,
  image_url,
  name,
  0,
  true,
  jsonb_build_object('source', 'm_scenes.image_url_backfill')
FROM kazikastudio.m_scenes
WHERE image_url IS NOT NULL
  AND user_id IS NOT NULL
ON CONFLICT (scene_id, image_url) DO NOTHING;

COMMENT ON TABLE kazikastudio.m_scene_images IS 'シーンごとの複数生成画像候補。m_scenes.id に紐づく。';
COMMENT ON COLUMN kazikastudio.m_scene_images.scene_id IS '親シーンID（m_scenes.id）';
COMMENT ON COLUMN kazikastudio.m_scene_images.image_url IS 'GCSストレージパス';
COMMENT ON COLUMN kazikastudio.m_scene_images.output_id IS '元になった workflow_outputs.id（任意）';
