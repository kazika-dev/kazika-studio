-- Add conversation-related fields to character_sheets table
ALTER TABLE kazikastudio.character_sheets
ADD COLUMN IF NOT EXISTS personality TEXT,
ADD COLUMN IF NOT EXISTS speaking_style TEXT,
ADD COLUMN IF NOT EXISTS sample_dialogues JSONB DEFAULT '[]'::jsonb;

-- Add index for sample_dialogues JSONB field
CREATE INDEX IF NOT EXISTS idx_character_sheets_sample_dialogues
  ON kazikastudio.character_sheets USING gin(sample_dialogues);

-- Add comment for documentation
COMMENT ON COLUMN kazikastudio.character_sheets.personality IS 'Character personality description for AI conversation generation';
COMMENT ON COLUMN kazikastudio.character_sheets.speaking_style IS 'Character speaking style and patterns for AI conversation generation';
COMMENT ON COLUMN kazikastudio.character_sheets.sample_dialogues IS 'Array of sample dialogue objects with structure: [{"situation": "...", "line": "..."}]';
