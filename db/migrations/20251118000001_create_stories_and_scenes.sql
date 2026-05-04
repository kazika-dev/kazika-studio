-- =====================================================
-- ストーリーとシーン管理テーブルの作成
-- =====================================================

-- ストーリーテーブル（大カテゴリ）
CREATE TABLE IF NOT EXISTS kazikastudio.stories (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ストーリーシーンテーブル（シーン）
CREATE TABLE IF NOT EXISTS kazikastudio.story_scenes (
  id BIGSERIAL PRIMARY KEY,
  story_id BIGINT NOT NULL REFERENCES kazikastudio.stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (story_id, sequence_order)
);

-- conversationsテーブルにstory_scene_idカラムを追加（NULL許可、既存データとの互換性維持）
ALTER TABLE kazikastudio.conversations
ADD COLUMN IF NOT EXISTS story_scene_id BIGINT REFERENCES kazikastudio.story_scenes(id) ON DELETE SET NULL;

-- conversationsテーブルのstudio_idをNULL許可に変更（ストーリー機能と共存）
ALTER TABLE kazikastudio.conversations
ALTER COLUMN studio_id DROP NOT NULL;

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON kazikastudio.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON kazikastudio.stories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_scenes_story_id ON kazikastudio.story_scenes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_scenes_sequence ON kazikastudio.story_scenes(story_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_conversations_story_scene_id ON kazikastudio.conversations(story_scene_id);

-- RLS有効化
ALTER TABLE kazikastudio.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.story_scenes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Stories RLSポリシー
-- =====================================================

CREATE POLICY "Users can view own stories"
  ON kazikastudio.stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stories"
  ON kazikastudio.stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON kazikastudio.stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON kazikastudio.stories FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Story Scenes RLSポリシー
-- =====================================================

CREATE POLICY "Users can view scenes in their stories"
  ON kazikastudio.story_scenes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.stories
      WHERE stories.id = story_scenes.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scenes in their stories"
  ON kazikastudio.story_scenes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.stories
      WHERE stories.id = story_scenes.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scenes in their stories"
  ON kazikastudio.story_scenes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.stories
      WHERE stories.id = story_scenes.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scenes in their stories"
  ON kazikastudio.story_scenes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.stories
      WHERE stories.id = story_scenes.story_id
      AND stories.user_id = auth.uid()
    )
  );

-- =====================================================
-- Conversations RLSポリシー更新（ストーリーシーン対応）
-- =====================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can view conversations in their studios" ON kazikastudio.conversations;
DROP POLICY IF EXISTS "Users can insert conversations in their studios" ON kazikastudio.conversations;
DROP POLICY IF EXISTS "Users can update conversations in their studios" ON kazikastudio.conversations;
DROP POLICY IF EXISTS "Users can delete conversations in their studios" ON kazikastudio.conversations;

-- 新しいポリシーを作成（studioとstory_sceneの両方に対応）
CREATE POLICY "Users can view own conversations"
  ON kazikastudio.conversations FOR SELECT
  USING (
    -- スタジオ経由の会話
    (studio_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    ))
    OR
    -- ストーリーシーン経由の会話
    (story_scene_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = conversations.story_scene_id
      AND s.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert own conversations"
  ON kazikastudio.conversations FOR INSERT
  WITH CHECK (
    -- スタジオ経由の会話
    (studio_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    ))
    OR
    -- ストーリーシーン経由の会話
    (story_scene_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = conversations.story_scene_id
      AND s.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can update own conversations"
  ON kazikastudio.conversations FOR UPDATE
  USING (
    -- スタジオ経由の会話
    (studio_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    ))
    OR
    -- ストーリーシーン経由の会話
    (story_scene_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = conversations.story_scene_id
      AND s.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can delete own conversations"
  ON kazikastudio.conversations FOR DELETE
  USING (
    -- スタジオ経由の会話
    (studio_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.studios
      WHERE studios.id = conversations.studio_id
      AND studios.user_id = auth.uid()
    ))
    OR
    -- ストーリーシーン経由の会話
    (story_scene_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = conversations.story_scene_id
      AND s.user_id = auth.uid()
    ))
  );

-- =====================================================
-- トリガー関数（updated_at自動更新）
-- =====================================================

CREATE OR REPLACE FUNCTION kazikastudio.update_stories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION kazikastudio.update_story_scenes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stories_updated_at ON kazikastudio.stories;
CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON kazikastudio.stories
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_stories_updated_at();

DROP TRIGGER IF EXISTS update_story_scenes_updated_at ON kazikastudio.story_scenes;
CREATE TRIGGER update_story_scenes_updated_at
  BEFORE UPDATE ON kazikastudio.story_scenes
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_story_scenes_updated_at();

-- =====================================================
-- パーミッション付与
-- =====================================================

GRANT ALL ON kazikastudio.stories TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.stories_id_seq TO anon, authenticated;

GRANT ALL ON kazikastudio.story_scenes TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.story_scenes_id_seq TO anon, authenticated;
