-- Create conversations table
CREATE TABLE IF NOT EXISTS kazikastudio.conversations (
  id BIGSERIAL PRIMARY KEY,
  studio_id BIGINT NOT NULL REFERENCES kazikastudio.studios(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS kazikastudio.conversation_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES kazikastudio.conversations(id) ON DELETE CASCADE,
  character_id BIGINT REFERENCES kazikastudio.character_sheets(id) ON DELETE SET NULL,
  speaker_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  sequence_order INT NOT NULL,
  timestamp_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (conversation_id, sequence_order)
);

-- Create conversation_generation_logs table
CREATE TABLE IF NOT EXISTS kazikastudio.conversation_generation_logs (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES kazikastudio.conversations(id) ON DELETE CASCADE,
  prompt_template TEXT NOT NULL,
  prompt_variables JSONB NOT NULL,
  ai_model TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  generated_messages JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_conversations_studio_id ON kazikastudio.conversations(studio_id);
CREATE INDEX idx_conversations_created_at ON kazikastudio.conversations(created_at);
CREATE INDEX idx_conversation_messages_conversation_id ON kazikastudio.conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_sequence ON kazikastudio.conversation_messages(conversation_id, sequence_order);
CREATE INDEX idx_conversation_messages_character_id ON kazikastudio.conversation_messages(character_id);
CREATE INDEX idx_conversation_logs_conversation_id ON kazikastudio.conversation_generation_logs(conversation_id);

-- Add RLS policies
ALTER TABLE kazikastudio.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.conversation_generation_logs ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view conversations in their studios"
  ON kazikastudio.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert conversations in their studios"
  ON kazikastudio.conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update conversations in their studios"
  ON kazikastudio.conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete conversations in their studios"
  ON kazikastudio.conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );

-- Conversation messages policies
CREATE POLICY "Users can view messages in their conversations"
  ON kazikastudio.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_messages.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON kazikastudio.conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_messages.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in their conversations"
  ON kazikastudio.conversation_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_messages.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages in their conversations"
  ON kazikastudio.conversation_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_messages.conversation_id
      AND s.user_id = auth.uid()
    )
  );

-- Conversation generation logs policies
CREATE POLICY "Users can view generation logs in their conversations"
  ON kazikastudio.conversation_generation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_generation_logs.conversation_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert generation logs in their conversations"
  ON kazikastudio.conversation_generation_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      JOIN kazikastudio.studios s ON s.id = c.studio_id
      WHERE c.id = conversation_generation_logs.conversation_id
      AND s.user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION kazikastudio.update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON kazikastudio.conversations
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_conversations_updated_at();
