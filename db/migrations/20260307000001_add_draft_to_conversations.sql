-- conversationsテーブルにdraftカラムを追加
-- 会話下書きテキストをシンプルに保存するため

ALTER TABLE kazikastudio.conversations
ADD COLUMN IF NOT EXISTS draft TEXT DEFAULT NULL;

COMMENT ON COLUMN kazikastudio.conversations.draft IS '会話下書きテキスト';
