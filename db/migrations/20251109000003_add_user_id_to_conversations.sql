-- Add user_id column to conversations table
ALTER TABLE kazikastudio.conversations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make studio_id nullable
ALTER TABLE kazikastudio.conversations
ALTER COLUMN studio_id DROP NOT NULL;

-- Update existing conversations to have user_id from studios
UPDATE kazikastudio.conversations c
SET user_id = s.user_id
FROM kazikastudio.studios s
WHERE c.studio_id = s.id AND c.user_id IS NULL;

-- Add index for user_id
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON kazikastudio.conversations(user_id);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view conversations in their studios" ON kazikastudio.conversations;
DROP POLICY IF EXISTS "Users can insert conversations in their studios" ON kazikastudio.conversations;
DROP POLICY IF EXISTS "Users can update conversations in their studios" ON kazikastudio.conversations;
DROP POLICY IF EXISTS "Users can delete conversations in their studios" ON kazikastudio.conversations;

-- Create new RLS policies that check user_id first, then fall back to studio_id
CREATE POLICY "Users can view their conversations"
  ON kazikastudio.conversations FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their conversations"
  ON kazikastudio.conversations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      studio_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM kazikastudio.studios
        WHERE studios.id = conversations.studio_id
        AND studios.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their conversations"
  ON kazikastudio.conversations FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their conversations"
  ON kazikastudio.conversations FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    )
  );
