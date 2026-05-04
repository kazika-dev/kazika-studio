-- =====================================================
-- Auth.js 移行用アプリユーザー
-- =====================================================
-- Supabase Auth を使わず、Neon/Postgres の UUID を既存 user_id として使う。
-- Password は Node crypto.scrypt の `scrypt$...` 形式で保存する。
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  email_verified TIMESTAMP WITH TIME ZONE,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON kazikastudio.app_users(lower(email));

CREATE OR REPLACE FUNCTION kazikastudio.handle_app_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_app_users_updated ON kazikastudio.app_users;
CREATE TRIGGER on_app_users_updated
  BEFORE UPDATE ON kazikastudio.app_users
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_app_users_updated_at();

COMMENT ON TABLE kazikastudio.app_users IS 'Auth.js credentials login users. Supabase Auth replacement.';
