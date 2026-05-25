-- Add per-story default image/video aspect ratios for Kazika Studio agent stories.
-- 1024x1536 is 2:3, not 3:4.

ALTER TABLE kazika_studio_agents.stories
  ADD COLUMN IF NOT EXISTS default_image_aspect_ratio TEXT NOT NULL DEFAULT '2:3',
  ADD COLUMN IF NOT EXISTS default_video_aspect_ratio TEXT NOT NULL DEFAULT '2:3';

UPDATE kazika_studio_agents.stories
SET
  default_image_aspect_ratio = CASE
    WHEN metadata->>'default_image_aspect_ratio' IN ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9')
      THEN metadata->>'default_image_aspect_ratio'
    ELSE default_image_aspect_ratio
  END,
  default_video_aspect_ratio = CASE
    WHEN metadata->>'default_video_aspect_ratio' IN ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9')
      THEN metadata->>'default_video_aspect_ratio'
    ELSE default_video_aspect_ratio
  END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stories_default_image_aspect_ratio_check'
      AND conrelid = 'kazika_studio_agents.stories'::regclass
  ) THEN
    ALTER TABLE kazika_studio_agents.stories
      ADD CONSTRAINT stories_default_image_aspect_ratio_check
      CHECK (default_image_aspect_ratio IN ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stories_default_video_aspect_ratio_check'
      AND conrelid = 'kazika_studio_agents.stories'::regclass
  ) THEN
    ALTER TABLE kazika_studio_agents.stories
      ADD CONSTRAINT stories_default_video_aspect_ratio_check
      CHECK (default_video_aspect_ratio IN ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'));
  END IF;
END $$;

COMMENT ON COLUMN kazika_studio_agents.stories.default_image_aspect_ratio IS 'Default aspect ratio for final still images and storyboard panels in this story. Example: 2:3.';
COMMENT ON COLUMN kazika_studio_agents.stories.default_video_aspect_ratio IS 'Default aspect ratio for videos generated from this story. Example: 2:3.';
