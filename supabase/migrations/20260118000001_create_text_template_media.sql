-- テキストテンプレートのメディア（参考画像・動画）テーブル
CREATE TABLE IF NOT EXISTS kazikastudio.m_text_template_media (
  id BIGSERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES kazikastudio.m_text_templates(id) ON DELETE CASCADE,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  file_name TEXT NOT NULL,          -- GCP Storageのファイルパス
  original_name TEXT,               -- 元のファイル名
  mime_type VARCHAR(50) NOT NULL,
  file_size_bytes BIGINT,
  width INTEGER,
  height INTEGER,
  duration_seconds DECIMAL(10,2),   -- 動画用
  display_order INTEGER DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_text_template_media_template_id ON kazikastudio.m_text_template_media(template_id);
CREATE INDEX IF NOT EXISTS idx_text_template_media_type ON kazikastudio.m_text_template_media(media_type);

-- RLS ポリシー
ALTER TABLE kazikastudio.m_text_template_media ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが共有テンプレート（user_id IS NULL）と自分のテンプレートのメディアを参照可能
DROP POLICY IF EXISTS "Allow read access to shared and own template media" ON kazikastudio.m_text_template_media;
CREATE POLICY "Allow read access to shared and own template media"
ON kazikastudio.m_text_template_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM kazikastudio.m_text_templates t
    WHERE t.id = template_id
    AND (t.user_id IS NULL OR t.user_id = auth.uid())
  )
);

-- 認証済みユーザーは自分のテンプレートのメディアを作成可能
DROP POLICY IF EXISTS "Allow insert own template media" ON kazikastudio.m_text_template_media;
CREATE POLICY "Allow insert own template media"
ON kazikastudio.m_text_template_media
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM kazikastudio.m_text_templates t
    WHERE t.id = template_id
    AND t.user_id = auth.uid()
  )
);

-- 自分のテンプレートのメディアのみ更新可能
DROP POLICY IF EXISTS "Allow update own template media" ON kazikastudio.m_text_template_media;
CREATE POLICY "Allow update own template media"
ON kazikastudio.m_text_template_media
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM kazikastudio.m_text_templates t
    WHERE t.id = template_id
    AND t.user_id = auth.uid()
  )
);

-- 自分のテンプレートのメディアのみ削除可能
DROP POLICY IF EXISTS "Allow delete own template media" ON kazikastudio.m_text_template_media;
CREATE POLICY "Allow delete own template media"
ON kazikastudio.m_text_template_media
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM kazikastudio.m_text_templates t
    WHERE t.id = template_id
    AND t.user_id = auth.uid()
  )
);
