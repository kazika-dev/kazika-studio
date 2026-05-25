-- Add first-class script-line timing and SFX cue columns for agent scene video prompt generation.
-- Drop the helper view before adding columns. PostgreSQL cannot CREATE OR REPLACE
-- a view when sl.* expands to new columns before the appended character fields.
DROP VIEW IF EXISTS kazika_studio_agents.readonly_scene_page_script_lines;

-- These are intentionally columns (not metadata) so agents/UI can query and edit them reliably.

ALTER TABLE kazika_studio_agents.script_lines
  ADD COLUMN IF NOT EXISTS video_prompt_timing_note text,
  ADD COLUMN IF NOT EXISTS video_event_start_seconds numeric(8,3),
  ADD COLUMN IF NOT EXISTS video_event_end_seconds numeric(8,3),
  ADD COLUMN IF NOT EXISTS sfx_prompt text,
  ADD COLUMN IF NOT EXISTS sfx_start_seconds numeric(8,3),
  ADD COLUMN IF NOT EXISTS sfx_duration_seconds numeric(8,3),
  ADD COLUMN IF NOT EXISTS sfx_sound_effect_id bigint,
  ADD COLUMN IF NOT EXISTS sfx_asset_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'script_lines_video_event_seconds_check'
      AND conrelid = 'kazika_studio_agents.script_lines'::regclass
  ) THEN
    ALTER TABLE kazika_studio_agents.script_lines
      ADD CONSTRAINT script_lines_video_event_seconds_check
      CHECK (
        (video_event_start_seconds IS NULL OR video_event_start_seconds >= 0)
        AND (video_event_end_seconds IS NULL OR video_event_end_seconds >= 0)
        AND (
          video_event_start_seconds IS NULL
          OR video_event_end_seconds IS NULL
          OR video_event_end_seconds >= video_event_start_seconds
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'script_lines_sfx_seconds_check'
      AND conrelid = 'kazika_studio_agents.script_lines'::regclass
  ) THEN
    ALTER TABLE kazika_studio_agents.script_lines
      ADD CONSTRAINT script_lines_sfx_seconds_check
      CHECK (
        (sfx_start_seconds IS NULL OR sfx_start_seconds >= 0)
        AND (sfx_duration_seconds IS NULL OR sfx_duration_seconds >= 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'script_lines_sfx_sound_effect_id_fkey'
      AND conrelid = 'kazika_studio_agents.script_lines'::regclass
  ) THEN
    ALTER TABLE kazika_studio_agents.script_lines
      ADD CONSTRAINT script_lines_sfx_sound_effect_id_fkey
      FOREIGN KEY (sfx_sound_effect_id)
      REFERENCES kazikastudio.m_sound_effects(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'script_lines_sfx_asset_id_fkey'
      AND conrelid = 'kazika_studio_agents.script_lines'::regclass
  ) THEN
    ALTER TABLE kazika_studio_agents.script_lines
      ADD CONSTRAINT script_lines_sfx_asset_id_fkey
      FOREIGN KEY (sfx_asset_id)
      REFERENCES kazika_studio_agents.assets(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_script_lines_video_event_seconds
  ON kazika_studio_agents.script_lines(script_id, video_event_start_seconds, video_event_end_seconds)
  WHERE video_event_start_seconds IS NOT NULL OR video_event_end_seconds IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_script_lines_sfx_sound_effect_id
  ON kazika_studio_agents.script_lines(sfx_sound_effect_id)
  WHERE sfx_sound_effect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_script_lines_sfx_asset_id
  ON kazika_studio_agents.script_lines(sfx_asset_id)
  WHERE sfx_asset_id IS NOT NULL;

COMMENT ON COLUMN kazika_studio_agents.script_lines.video_prompt_timing_note IS 'Video generation timing cue text for this script line, e.g. 0.0-1.2s open, 1.2-3.2s doors close.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.video_event_start_seconds IS 'Optional main video event start time in seconds for prompt generation.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.video_event_end_seconds IS 'Optional main video event end time in seconds for prompt generation.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.sfx_prompt IS 'Optional sound-effect prompt/description tied to this script line.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.sfx_start_seconds IS 'Optional SFX placement start time in seconds relative to the generated video.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.sfx_duration_seconds IS 'Optional SFX duration in seconds.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.sfx_sound_effect_id IS 'Optional linked sound-effect master row in kazikastudio.m_sound_effects.';
COMMENT ON COLUMN kazika_studio_agents.script_lines.sfx_asset_id IS 'Optional linked generated/uploaded SFX asset in kazika_studio_agents.assets.';

-- Refresh the readonly helper view so newly added sl.* columns are exposed.
CREATE OR REPLACE VIEW kazika_studio_agents.readonly_scene_page_script_lines AS
SELECT
  sl.*,
  ch.name AS character_name,
  ch.image_url AS character_image_url
FROM kazika_studio_agents.script_lines sl
LEFT JOIN LATERAL (
  SELECT ch.name, ch.image_url
  FROM kazika_studio_agents.characters ch
  WHERE ch.id = sl.agent_character_id
     OR ch.source_character_sheet_id = sl.character_sheet_id
  ORDER BY
    CASE WHEN ch.id = sl.agent_character_id THEN 0 ELSE 1 END,
    ch.id DESC
  LIMIT 1
) ch ON true;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'temporary_asset_links_editor') THEN
    GRANT SELECT ON TABLE kazika_studio_agents.readonly_scene_page_script_lines
      TO temporary_asset_links_editor;
  END IF;
END $$;
