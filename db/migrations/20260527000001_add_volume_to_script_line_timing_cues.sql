-- Store per-cue volume as a first-class column instead of burying it in metadata.
-- Used mainly by SFX cues during final subtitle/video rendering.

ALTER TABLE kazika_studio_agents.script_line_timing_cues
  ADD COLUMN IF NOT EXISTS volume numeric(6,3);

ALTER TABLE kazika_studio_agents.script_line_timing_cues
  DROP CONSTRAINT IF EXISTS script_line_timing_cues_volume_check;

ALTER TABLE kazika_studio_agents.script_line_timing_cues
  ADD CONSTRAINT script_line_timing_cues_volume_check
  CHECK (volume IS NULL OR (volume >= 0 AND volume <= 4));

UPDATE kazika_studio_agents.script_line_timing_cues
SET volume = round((metadata->>'volume')::numeric, 3)
WHERE volume IS NULL
  AND metadata ? 'volume'
  AND (metadata->>'volume') ~ '^[0-9]+(\.[0-9]+)?$'
  AND (metadata->>'volume')::numeric >= 0
  AND (metadata->>'volume')::numeric <= 4;

UPDATE kazika_studio_agents.script_line_timing_cues
SET volume = 1.000
WHERE volume IS NULL
  AND cue_type = 'sfx';

COMMENT ON COLUMN kazika_studio_agents.script_line_timing_cues.volume IS 'Per-cue audio gain multiplier. For SFX cues, 1.0 is normal volume, 0 is mute, up to 4.0 is boosted.';

CREATE OR REPLACE VIEW kazika_studio_agents.readonly_scene_page_script_line_timing_cues AS
SELECT *
FROM kazika_studio_agents.script_line_timing_cues;
