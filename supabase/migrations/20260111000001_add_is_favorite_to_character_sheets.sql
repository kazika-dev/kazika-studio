-- キャラクターシートにお気に入りフラグを追加
-- is_favorite カラムを追加（デフォルト: false）

ALTER TABLE kazikastudio.character_sheets
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

-- お気に入り優先＋作成日時順のインデックスを追加
CREATE INDEX IF NOT EXISTS idx_character_sheets_favorite_created
ON kazikastudio.character_sheets (user_id, is_favorite DESC, created_at DESC);

COMMENT ON COLUMN kazikastudio.character_sheets.is_favorite IS 'お気に入りフラグ。trueの場合、一覧表示で優先的に表示される';
