-- =====================================================
-- story_scenesテーブルにlocationカラムを追加
-- =====================================================
-- シーンの舞台となる場所を保存するためのカラム

ALTER TABLE kazikastudio.story_scenes
ADD COLUMN IF NOT EXISTS location TEXT;

-- コメント追加
COMMENT ON COLUMN kazikastudio.story_scenes.location IS 'シーンの舞台となる場所（例：学校の屋上、夕暮れ時）';
