-- Add ElevenLabs voice ID column to character_sheets table
-- This allows characters to have associated ElevenLabs voice IDs for text-to-speech

ALTER TABLE kazikastudio.character_sheets
ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT;

-- Add comment
COMMENT ON COLUMN kazikastudio.character_sheets.elevenlabs_voice_id IS 'ElevenLabs API用の音声ID';
