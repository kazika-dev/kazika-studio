-- =====================================================
-- conversation_messages RLSポリシー修正
-- story_scene_id経由の会話に対応
-- =====================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON kazikastudio.conversation_messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON kazikastudio.conversation_messages;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON kazikastudio.conversation_messages;
DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON kazikastudio.conversation_messages;

-- 新しいポリシーを作成（studioとstory_sceneの両方に対応）
CREATE POLICY "Users can view messages in their conversations"
  ON kazikastudio.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE c.id = conversation_messages.conversation_id
      AND (
        (c.studio_id IS NOT NULL AND s.user_id = auth.uid())
        OR
        (c.story_scene_id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON kazikastudio.conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE c.id = conversation_messages.conversation_id
      AND (
        (c.studio_id IS NOT NULL AND s.user_id = auth.uid())
        OR
        (c.story_scene_id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update messages in their conversations"
  ON kazikastudio.conversation_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE c.id = conversation_messages.conversation_id
      AND (
        (c.studio_id IS NOT NULL AND s.user_id = auth.uid())
        OR
        (c.story_scene_id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete messages in their conversations"
  ON kazikastudio.conversation_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE c.id = conversation_messages.conversation_id
      AND (
        (c.studio_id IS NOT NULL AND s.user_id = auth.uid())
        OR
        (c.story_scene_id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

-- conversation_generation_logsのRLSポリシーも同様に更新
DROP POLICY IF EXISTS "Users can view generation logs in their conversations" ON kazikastudio.conversation_generation_logs;
DROP POLICY IF EXISTS "Users can insert generation logs in their conversations" ON kazikastudio.conversation_generation_logs;

CREATE POLICY "Users can view generation logs in their conversations"
  ON kazikastudio.conversation_generation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE c.id = conversation_generation_logs.conversation_id
      AND (
        (c.studio_id IS NOT NULL AND s.user_id = auth.uid())
        OR
        (c.story_scene_id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert generation logs in their conversations"
  ON kazikastudio.conversation_generation_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.conversations c
      LEFT JOIN kazikastudio.studios s ON s.id = c.studio_id
      LEFT JOIN kazikastudio.story_scenes ss ON ss.id = c.story_scene_id
      LEFT JOIN kazikastudio.stories st ON st.id = ss.story_id
      WHERE c.id = conversation_generation_logs.conversation_id
      AND (
        (c.studio_id IS NOT NULL AND s.user_id = auth.uid())
        OR
        (c.story_scene_id IS NOT NULL AND st.user_id = auth.uid())
      )
    )
  );
