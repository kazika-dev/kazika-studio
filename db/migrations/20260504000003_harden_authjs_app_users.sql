-- =====================================================
-- Auth.js Credentials hardening metadata
-- =====================================================

ALTER TABLE kazikastudio.app_users
  ADD COLUMN IF NOT EXISTS login_failed_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_app_users_last_failed_login_at
  ON kazikastudio.app_users(last_failed_login_at);
