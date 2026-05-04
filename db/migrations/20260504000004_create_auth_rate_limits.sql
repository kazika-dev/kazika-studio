-- =====================================================
-- Auth rate limits shared across app instances
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.auth_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 0 NOT NULL,
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_reset_at
  ON kazikastudio.auth_rate_limits(reset_at);

CREATE OR REPLACE FUNCTION kazikastudio.handle_auth_rate_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_rate_limits_updated ON kazikastudio.auth_rate_limits;
CREATE TRIGGER on_auth_rate_limits_updated
  BEFORE UPDATE ON kazikastudio.auth_rate_limits
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_auth_rate_limits_updated_at();
