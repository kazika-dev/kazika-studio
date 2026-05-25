-- Normalize per-line video timing / SFX control into multiple cue rows.
-- A single script line/cut can contain many motion, camera, SFX, dialogue, and transition cues.

CREATE TABLE IF NOT EXISTS kazika_studio_agents.script_line_timing_cues (
  id bigserial PRIMARY KEY,
  script_line_id bigint NOT NULL REFERENCES kazika_studio_agents.script_lines(id) ON DELETE CASCADE,
  cue_index integer NOT NULL DEFAULT 1,
  cue_type text NOT NULL DEFAULT 'motion',
  start_seconds numeric(8,3),
  end_seconds numeric(8,3),
  prompt text NOT NULL DEFAULT '',
  sfx_sound_effect_id bigint REFERENCES kazikastudio.m_sound_effects(id) ON DELETE SET NULL,
  sfx_asset_id bigint REFERENCES kazika_studio_agents.assets(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT script_line_timing_cues_type_check CHECK (cue_type IN ('motion', 'camera', 'sfx', 'dialogue', 'transition', 'hold', 'other')),
  CONSTRAINT script_line_timing_cues_seconds_check CHECK (
    (start_seconds IS NULL OR start_seconds >= 0)
    AND (end_seconds IS NULL OR end_seconds >= 0)
    AND (start_seconds IS NULL OR end_seconds IS NULL OR end_seconds >= start_seconds)
  )
);

CREATE INDEX IF NOT EXISTS idx_script_line_timing_cues_line_order
  ON kazika_studio_agents.script_line_timing_cues(script_line_id, cue_index, id);

CREATE INDEX IF NOT EXISTS idx_script_line_timing_cues_type
  ON kazika_studio_agents.script_line_timing_cues(cue_type);

CREATE INDEX IF NOT EXISTS idx_script_line_timing_cues_sfx_sound_effect_id
  ON kazika_studio_agents.script_line_timing_cues(sfx_sound_effect_id)
  WHERE sfx_sound_effect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_script_line_timing_cues_sfx_asset_id
  ON kazika_studio_agents.script_line_timing_cues(sfx_asset_id)
  WHERE sfx_asset_id IS NOT NULL;

COMMENT ON TABLE kazika_studio_agents.script_line_timing_cues IS 'Multiple timecoded video/SFX/camera/dialogue cues attached to a single agent script line.';
COMMENT ON COLUMN kazika_studio_agents.script_line_timing_cues.cue_type IS 'motion/camera/sfx/dialogue/transition/hold/other';
COMMENT ON COLUMN kazika_studio_agents.script_line_timing_cues.start_seconds IS 'Cue start time in seconds relative to the generated cut.';
COMMENT ON COLUMN kazika_studio_agents.script_line_timing_cues.end_seconds IS 'Cue end time in seconds relative to the generated cut. For SFX this can represent start + duration.';

-- Seed one normalized cue from the legacy single-cue columns when present and no cue rows exist yet.
INSERT INTO kazika_studio_agents.script_line_timing_cues (
  script_line_id,
  cue_index,
  cue_type,
  start_seconds,
  end_seconds,
  prompt,
  sfx_sound_effect_id,
  sfx_asset_id,
  metadata
)
SELECT
  sl.id,
  1,
  CASE WHEN sl.sfx_prompt IS NOT NULL OR sl.sfx_sound_effect_id IS NOT NULL OR sl.sfx_asset_id IS NOT NULL THEN 'sfx' ELSE 'motion' END,
  COALESCE(sl.sfx_start_seconds, sl.video_event_start_seconds),
  CASE
    WHEN sl.sfx_start_seconds IS NOT NULL AND sl.sfx_duration_seconds IS NOT NULL THEN sl.sfx_start_seconds + sl.sfx_duration_seconds
    ELSE sl.video_event_end_seconds
  END,
  COALESCE(NULLIF(sl.sfx_prompt, ''), NULLIF(sl.video_prompt_timing_note, ''), ''),
  sl.sfx_sound_effect_id,
  sl.sfx_asset_id,
  jsonb_build_object('migrated_from_legacy_script_line_columns', true)
FROM kazika_studio_agents.script_lines sl
WHERE (
    sl.video_prompt_timing_note IS NOT NULL
    OR sl.video_event_start_seconds IS NOT NULL
    OR sl.video_event_end_seconds IS NOT NULL
    OR sl.sfx_prompt IS NOT NULL
    OR sl.sfx_start_seconds IS NOT NULL
    OR sl.sfx_duration_seconds IS NOT NULL
    OR sl.sfx_sound_effect_id IS NOT NULL
    OR sl.sfx_asset_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM kazika_studio_agents.script_line_timing_cues cue
    WHERE cue.script_line_id = sl.id
  );

CREATE OR REPLACE VIEW kazika_studio_agents.readonly_scene_page_script_line_timing_cues AS
SELECT *
FROM kazika_studio_agents.script_line_timing_cues;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'temporary_asset_links_editor') THEN
    GRANT SELECT ON TABLE kazika_studio_agents.readonly_scene_page_script_line_timing_cues
      TO temporary_asset_links_editor;
  END IF;
END $$;
