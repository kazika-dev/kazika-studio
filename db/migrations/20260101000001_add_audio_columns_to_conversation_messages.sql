-- Add audio columns to conversation_messages table
-- These columns store audio files generated from messages using ElevenLabs
-- Each message can have one audio file (1:1 relationship)

ALTER TABLE kazikastudio.conversation_messages
ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
ADD COLUMN IF NOT EXISTS audio_voice_id TEXT,
ADD COLUMN IF NOT EXISTS audio_model_id TEXT,
ADD COLUMN IF NOT EXISTS audio_duration_seconds FLOAT,
ADD COLUMN IF NOT EXISTS audio_file_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS audio_created_at TIMESTAMPTZ;

-- Add index for messages with audio
CREATE INDEX IF NOT EXISTS idx_conversation_messages_has_audio
  ON kazikastudio.conversation_messages(audio_storage_path)
  WHERE audio_storage_path IS NOT NULL;

COMMENT ON COLUMN kazikastudio.conversation_messages.audio_storage_path IS 'GCP Storage path for the generated audio file';
COMMENT ON COLUMN kazikastudio.conversation_messages.audio_voice_id IS 'ElevenLabs voice ID used for generation';
COMMENT ON COLUMN kazikastudio.conversation_messages.audio_model_id IS 'ElevenLabs model ID used for generation';
COMMENT ON COLUMN kazikastudio.conversation_messages.audio_duration_seconds IS 'Duration of the audio file in seconds';
COMMENT ON COLUMN kazikastudio.conversation_messages.audio_file_size_bytes IS 'Size of the audio file in bytes';
COMMENT ON COLUMN kazikastudio.conversation_messages.audio_created_at IS 'Timestamp when the audio was generated';
