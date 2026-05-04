-- テキストテンプレートマスタテーブル
CREATE TABLE IF NOT EXISTS kazikastudio.m_text_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,                  -- テンプレート名（英語）
  name_ja VARCHAR(100),                        -- テンプレート名（日本語）
  content TEXT NOT NULL,                       -- テンプレート本文
  description TEXT,                            -- 説明（英語）
  description_ja TEXT,                         -- 説明（日本語）
  category VARCHAR(50) DEFAULT 'general',      -- カテゴリ（general, prompt, scene, character, etc.）
  tags TEXT[],                                 -- タグ配列（検索用）
  is_active BOOLEAN DEFAULT TRUE,              -- 有効フラグ
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- 作成者（NULL = 共有テンプレート）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_text_templates_category ON kazikastudio.m_text_templates(category);
CREATE INDEX IF NOT EXISTS idx_text_templates_user_id ON kazikastudio.m_text_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_text_templates_tags ON kazikastudio.m_text_templates USING GIN(tags);

-- RLS ポリシー
ALTER TABLE kazikastudio.m_text_templates ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが共有テンプレート（user_id IS NULL）と自分のテンプレートを参照可能
DROP POLICY IF EXISTS "Allow read access to shared and own templates" ON kazikastudio.m_text_templates;
CREATE POLICY "Allow read access to shared and own templates"
ON kazikastudio.m_text_templates
FOR SELECT
USING (user_id IS NULL OR user_id = auth.uid());

-- 認証済みユーザーは自分のテンプレートを作成可能
DROP POLICY IF EXISTS "Allow insert own templates" ON kazikastudio.m_text_templates;
CREATE POLICY "Allow insert own templates"
ON kazikastudio.m_text_templates
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 自分のテンプレートのみ更新可能
DROP POLICY IF EXISTS "Allow update own templates" ON kazikastudio.m_text_templates;
CREATE POLICY "Allow update own templates"
ON kazikastudio.m_text_templates
FOR UPDATE
USING (user_id = auth.uid());

-- 自分のテンプレートのみ削除可能
DROP POLICY IF EXISTS "Allow delete own templates" ON kazikastudio.m_text_templates;
CREATE POLICY "Allow delete own templates"
ON kazikastudio.m_text_templates
FOR DELETE
USING (user_id = auth.uid());
