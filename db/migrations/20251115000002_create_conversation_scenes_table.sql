-- Create conversation_scenes table
CREATE TABLE IF NOT EXISTS kazikastudio.conversation_scenes (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES kazikastudio.conversations(id) ON DELETE CASCADE,
  scene_number INT NOT NULL,
  scene_description TEXT NOT NULL,
  image_generation_prompt TEXT NOT NULL,
  generated_image_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, scene_number)
);

-- Add indexes for performance
CREATE INDEX idx_conversation_scenes_conversation_id ON kazikastudio.conversation_scenes(conversation_id);
CREATE INDEX idx_conversation_scenes_scene_number ON kazikastudio.conversation_scenes(conversation_id, scene_number);

-- Add RLS policies
ALTER TABLE kazikastudio.conversation_scenes ENABLE ROW LEVEL SECURITY;

-- Conversation scenes policies
CREATE POLICY "Users can view scenes in their conversations"
  ON kazikastudio.conversation_scenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_scenes.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scenes in their conversations"
  ON kazikastudio.conversation_scenes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_scenes.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scenes in their conversations"
  ON kazikastudio.conversation_scenes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_scenes.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scenes in their conversations"
  ON kazikastudio.conversation_scenes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_scenes.conversation_id
      AND s.user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION kazikastudio.update_conversation_scenes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_scenes_updated_at
  BEFORE UPDATE ON kazikastudio.conversation_scenes
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_conversation_scenes_updated_at();
