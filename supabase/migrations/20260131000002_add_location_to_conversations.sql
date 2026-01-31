-- conversationsテーブルにlocationカラムを追加
-- 各会話ごとに個別の場所を設定できるようにする

ALTER TABLE kazikastudio.conversations
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL;

COMMENT ON COLUMN kazikastudio.conversations.location IS '会話の舞台となる場所（例：学校の屋上、夕暮れ時）';
