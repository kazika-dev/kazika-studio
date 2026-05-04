-- =====================================================
-- シーン編集タイムライン
-- =====================================================
-- scene_assets は素材候補の棚、scene_timeline_* は実際に一本の映像へ
-- どの素材をいつ/どのレイヤーに配置するかを保持する編集台。
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.scene_timeline_tracks (
  id BIGSERIAL PRIMARY KEY,
  scene_id BIGINT NOT NULL REFERENCES kazikastudio.m_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  track_type TEXT NOT NULL CHECK (track_type IN ('visual', 'dialogue', 'bgm', 'sfx', 'overlay', 'text', 'other')),
  name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  muted BOOLEAN NOT NULL DEFAULT false,
  locked BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS kazikastudio.scene_timeline_clips (
  id BIGSERIAL PRIMARY KEY,
  scene_id BIGINT NOT NULL REFERENCES kazikastudio.m_scenes(id) ON DELETE CASCADE,
  track_id BIGINT NOT NULL REFERENCES kazikastudio.scene_timeline_tracks(id) ON DELETE CASCADE,
  scene_asset_id BIGINT REFERENCES kazikastudio.scene_assets(id) ON DELETE SET NULL,
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  clip_type TEXT NOT NULL CHECK (clip_type IN ('image', 'video', 'dialogue', 'bgm', 'sfx', 'audio', 'text', 'overlay', 'other')),
  title TEXT,
  start_time NUMERIC(10, 3) NOT NULL DEFAULT 0,
  duration NUMERIC(10, 3) NOT NULL DEFAULT 1 CHECK (duration > 0),
  source_start_time NUMERIC(10, 3),
  source_end_time NUMERIC(10, 3),
  volume NUMERIC(6, 3) NOT NULL DEFAULT 1,
  opacity NUMERIC(6, 3) NOT NULL DEFAULT 1,
  z_index INTEGER NOT NULL DEFAULT 0,
  playback_rate NUMERIC(6, 3) NOT NULL DEFAULT 1,
  transition_in JSONB NOT NULL DEFAULT '{}'::jsonb,
  transition_out JSONB NOT NULL DEFAULT '{}'::jsonb,
  transform JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS kazikastudio.scene_renders (
  id BIGSERIAL PRIMARY KEY,
  scene_id BIGINT NOT NULL REFERENCES kazikastudio.m_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')),
  render_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scene_timeline_tracks_scene_id ON kazikastudio.scene_timeline_tracks(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_timeline_tracks_user_id ON kazikastudio.scene_timeline_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_scene_timeline_tracks_sort ON kazikastudio.scene_timeline_tracks(scene_id, sort_order ASC, id ASC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_timeline_tracks_scene_user_type_name_unique
  ON kazikastudio.scene_timeline_tracks(scene_id, user_id, track_type, name);

CREATE INDEX IF NOT EXISTS idx_scene_timeline_clips_scene_id ON kazikastudio.scene_timeline_clips(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_timeline_clips_track_id ON kazikastudio.scene_timeline_clips(track_id);
CREATE INDEX IF NOT EXISTS idx_scene_timeline_clips_asset_id ON kazikastudio.scene_timeline_clips(scene_asset_id);
CREATE INDEX IF NOT EXISTS idx_scene_timeline_clips_output_id ON kazikastudio.scene_timeline_clips(output_id);
CREATE INDEX IF NOT EXISTS idx_scene_timeline_clips_time ON kazikastudio.scene_timeline_clips(scene_id, start_time ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_scene_renders_scene_id ON kazikastudio.scene_renders(scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_renders_user_id ON kazikastudio.scene_renders(user_id);
CREATE INDEX IF NOT EXISTS idx_scene_renders_output_id ON kazikastudio.scene_renders(output_id);
CREATE INDEX IF NOT EXISTS idx_scene_renders_status ON kazikastudio.scene_renders(status);
CREATE INDEX IF NOT EXISTS idx_scene_renders_created_at ON kazikastudio.scene_renders(created_at DESC);

CREATE OR REPLACE FUNCTION kazikastudio.handle_scene_timeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_scene_timeline_tracks_updated ON kazikastudio.scene_timeline_tracks;
CREATE TRIGGER on_scene_timeline_tracks_updated
  BEFORE UPDATE ON kazikastudio.scene_timeline_tracks
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_scene_timeline_updated_at();

DROP TRIGGER IF EXISTS on_scene_timeline_clips_updated ON kazikastudio.scene_timeline_clips;
CREATE TRIGGER on_scene_timeline_clips_updated
  BEFORE UPDATE ON kazikastudio.scene_timeline_clips
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_scene_timeline_updated_at();

DROP TRIGGER IF EXISTS on_scene_renders_updated ON kazikastudio.scene_renders;
CREATE TRIGGER on_scene_renders_updated
  BEFORE UPDATE ON kazikastudio.scene_renders
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_scene_timeline_updated_at();

ALTER TABLE kazikastudio.scene_timeline_tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.scene_timeline_clips DISABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.scene_renders DISABLE ROW LEVEL SECURITY;

-- 既存のselected/primary画像は、最初のvisual clipとして配置しておく。
INSERT INTO kazikastudio.scene_timeline_tracks
  (scene_id, user_id, track_type, name, sort_order, metadata)
SELECT DISTINCT
  scene_id,
  user_id,
  'visual',
  'Visual',
  0,
  jsonb_build_object('source', 'scene_assets_backfill')
FROM kazikastudio.scene_assets
WHERE asset_type IN ('image', 'video')
  AND (status = 'selected' OR is_primary = true)
ON CONFLICT (scene_id, user_id, track_type, name) DO NOTHING;

INSERT INTO kazikastudio.scene_timeline_clips
  (scene_id, track_id, scene_asset_id, output_id, clip_type, title, start_time, duration, z_index, metadata)
SELECT
  asset.scene_id,
  track.id,
  asset.id,
  asset.output_id,
  asset.asset_type,
  asset.title,
  0,
  COALESCE((asset.metadata->>'duration_seconds')::numeric, 5),
  0,
  jsonb_build_object('source', 'selected_scene_asset_backfill')
FROM kazikastudio.scene_assets asset
JOIN kazikastudio.scene_timeline_tracks track
  ON track.scene_id = asset.scene_id
 AND track.user_id = asset.user_id
 AND track.track_type = 'visual'
 AND track.name = 'Visual'
WHERE asset.asset_type IN ('image', 'video')
  AND (asset.status = 'selected' OR asset.is_primary = true)
  AND NOT EXISTS (
    SELECT 1 FROM kazikastudio.scene_timeline_clips existing
    WHERE existing.scene_id = asset.scene_id
      AND existing.scene_asset_id = asset.id
  );

COMMENT ON TABLE kazikastudio.scene_timeline_tracks IS 'シーン編集タイムラインのレイヤー。visual/dialogue/bgm/sfx等。';
COMMENT ON TABLE kazikastudio.scene_timeline_clips IS 'タイムライン上に配置された素材クリップ。開始秒、長さ、音量、変形等を保持。';
COMMENT ON TABLE kazikastudio.scene_renders IS 'タイムラインから書き出した最終レンダー結果。';
