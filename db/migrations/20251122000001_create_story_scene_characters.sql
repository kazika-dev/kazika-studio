-- =====================================================
-- シーンキャラクター管理テーブルの作成
-- =====================================================

-- story_scene_characters テーブル（多対多の中間テーブル）
CREATE TABLE IF NOT EXISTS kazikastudio.story_scene_characters (
  id BIGSERIAL PRIMARY KEY,
  story_scene_id BIGINT NOT NULL REFERENCES kazikastudio.story_scenes(id) ON DELETE CASCADE,
  character_sheet_id BIGINT NOT NULL REFERENCES kazikastudio.character_sheets(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 1,
  is_main_character BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (story_scene_id, character_sheet_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_story_scene_characters_scene_id
  ON kazikastudio.story_scene_characters(story_scene_id);

CREATE INDEX IF NOT EXISTS idx_story_scene_characters_character_id
  ON kazikastudio.story_scene_characters(character_sheet_id);

CREATE INDEX IF NOT EXISTS idx_story_scene_characters_display_order
  ON kazikastudio.story_scene_characters(story_scene_id, display_order);

-- RLS有効化
ALTER TABLE kazikastudio.story_scene_characters ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Story Scene Characters RLSポリシー
-- =====================================================

CREATE POLICY "Users can view characters in their scenes"
  ON kazikastudio.story_scene_characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = story_scene_characters.story_scene_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert characters in their scenes"
  ON kazikastudio.story_scene_characters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = story_scene_characters.story_scene_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update characters in their scenes"
  ON kazikastudio.story_scene_characters FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = story_scene_characters.story_scene_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete characters in their scenes"
  ON kazikastudio.story_scene_characters FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM kazikastudio.story_scenes sc
      JOIN kazikastudio.stories s ON s.id = sc.story_id
      WHERE sc.id = story_scene_characters.story_scene_id
      AND s.user_id = auth.uid()
    )
  );

-- =====================================================
-- パーミッション付与
-- =====================================================

GRANT ALL ON kazikastudio.story_scene_characters TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.story_scene_characters_id_seq TO anon, authenticated;

-- =====================================================
-- コメント
-- =====================================================

COMMENT ON TABLE kazikastudio.story_scene_characters IS 'シーンに登場するキャラクターの関連テーブル（多対多）';
COMMENT ON COLUMN kazikastudio.story_scene_characters.story_scene_id IS 'ストーリーシーンID';
COMMENT ON COLUMN kazikastudio.story_scene_characters.character_sheet_id IS 'キャラクターシートID';
COMMENT ON COLUMN kazikastudio.story_scene_characters.display_order IS '表示順序（1から開始）';
COMMENT ON COLUMN kazikastudio.story_scene_characters.is_main_character IS 'メインキャラクターフラグ';
COMMENT ON COLUMN kazikastudio.story_scene_characters.metadata IS '追加メタデータ（JSON）';
