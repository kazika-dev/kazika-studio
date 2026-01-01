-- Create conversation_message_audios table
-- This table stores audio files generated from conversation messages using ElevenLabs
-- Each message can have one audio file (1:1 relationship)

CREATE TABLE IF NOT EXISTS kazikastudio.conversation_message_audios (
  id BIGSERIAL PRIMARY KEY,
  conversation_message_id BIGINT NOT NULL UNIQUE
    REFERENCES kazikastudio.conversation_messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT 'eleven_turbo_v2_5',
  duration_seconds FLOAT,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add index for faster lookups
CREATE INDEX idx_message_audios_message_id
  ON kazikastudio.conversation_message_audios(conversation_message_id);
CREATE INDEX idx_message_audios_created_at
  ON kazikastudio.conversation_message_audios(created_at DESC);

-- Enable RLS
ALTER TABLE kazikastudio.conversation_message_audios ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can access audio files in their own conversations

-- SELECT: View audio files in owned conversations
CREATE POLICY "Users can view audio files in their conversations"
  ON kazikastudio.conversation_message_audios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_audios.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- INSERT: Add audio files to owned conversations
CREATE POLICY "Users can insert audio files in their conversations"
  ON kazikastudio.conversation_message_audios FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_audios.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- UPDATE: Update audio files in owned conversations
CREATE POLICY "Users can update audio files in their conversations"
  ON kazikastudio.conversation_message_audios FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_audios.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- DELETE: Remove audio files from owned conversations
CREATE POLICY "Users can delete audio files in their conversations"
  ON kazikastudio.conversation_message_audios FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_audios.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION kazikastudio.update_conversation_message_audios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_message_audios_updated_at
  BEFORE UPDATE ON kazikastudio.conversation_message_audios
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_conversation_message_audios_updated_at();
