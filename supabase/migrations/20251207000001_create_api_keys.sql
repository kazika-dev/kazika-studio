-- API Keys テーブルの作成
-- Chrome Extension などの外部クライアントから API を認証するためのキー管理

-- テーブル作成
CREATE TABLE IF NOT EXISTS kazikastudio.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON kazikastudio.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON kazikastudio.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON kazikastudio.api_keys(is_active) WHERE is_active = TRUE;

-- RLS（Row Level Security）を有効化
ALTER TABLE kazikastudio.api_keys ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分のAPIキーのみ参照可能
CREATE POLICY "Users can view their own API keys"
  ON kazikastudio.api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLSポリシー: 自分のAPIキーのみ作成可能
CREATE POLICY "Users can create their own API keys"
  ON kazikastudio.api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLSポリシー: 自分のAPIキーのみ更新可能（last_used_at, is_active のみ）
CREATE POLICY "Users can update their own API keys"
  ON kazikastudio.api_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLSポリシー: 自分のAPIキーのみ削除可能
CREATE POLICY "Users can delete their own API keys"
  ON kazikastudio.api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- コメント追加
COMMENT ON TABLE kazikastudio.api_keys IS 'API認証キーの管理テーブル（Chrome Extensionなど外部クライアント用）';
COMMENT ON COLUMN kazikastudio.api_keys.key_hash IS 'APIキーのSHA-256ハッシュ値（平文は保存しない）';
COMMENT ON COLUMN kazikastudio.api_keys.name IS 'キーの用途を識別する名前（例: Chrome Extension）';
COMMENT ON COLUMN kazikastudio.api_keys.last_used_at IS '最後に使用された日時';
COMMENT ON COLUMN kazikastudio.api_keys.expires_at IS '有効期限（NULLの場合は無期限）';
COMMENT ON COLUMN kazikastudio.api_keys.is_active IS 'キーが有効かどうか（無効化したキーでは認証失敗）';
COMMENT ON COLUMN kazikastudio.api_keys.metadata IS '追加情報（IPアドレス制限、レート制限設定など）';
