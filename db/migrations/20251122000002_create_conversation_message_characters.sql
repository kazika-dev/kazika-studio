-- Create conversation_message_characters table
-- This table manages the many-to-many relationship between conversation messages and character sheets
-- Each message can have multiple characters appearing in the scene (separate from the speaker)

CREATE TABLE IF NOT EXISTS kazikastudio.conversation_message_characters (
  id BIGSERIAL PRIMARY KEY,
  conversation_message_id BIGINT NOT NULL
    REFERENCES kazikastudio.conversation_messages(id) ON DELETE CASCADE,
  character_sheet_id BIGINT NOT NULL
    REFERENCES kazikastudio.character_sheets(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (conversation_message_id, character_sheet_id)
);

-- Add indexes for performance
CREATE INDEX idx_message_characters_message_id
  ON kazikastudio.conversation_message_characters(conversation_message_id);
CREATE INDEX idx_message_characters_character_id
  ON kazikastudio.conversation_message_characters(character_sheet_id);
CREATE INDEX idx_message_characters_display_order
  ON kazikastudio.conversation_message_characters(conversation_message_id, display_order);

-- Enable RLS
ALTER TABLE kazikastudio.conversation_message_characters ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can access message characters in their own conversations

-- SELECT: View message characters in owned conversations
CREATE POLICY "Users can view message characters in their conversations"
  ON kazikastudio.conversation_message_characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_characters.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- INSERT: Add message characters to owned conversations
CREATE POLICY "Users can insert message characters in their conversations"
  ON kazikastudio.conversation_message_characters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_characters.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- UPDATE: Update message characters in owned conversations
CREATE POLICY "Users can update message characters in their conversations"
  ON kazikastudio.conversation_message_characters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_characters.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- DELETE: Remove message characters from owned conversations
CREATE POLICY "Users can delete message characters in their conversations"
  ON kazikastudio.conversation_message_characters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversation_messages cm
      JOIN kazikastudio.conversations c ON c.id = cm.conversation_id
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE cm.id = conversation_message_characters.conversation_message_id
      AND (
        (s.id IS NOT NULL AND s.user_id = auth.uid()) OR
        (st.id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );
