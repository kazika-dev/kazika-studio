-- =====================================================
-- ElevenLabs タグマスターテーブルの作成
-- =====================================================
-- ElevenLabs音声生成用のタグマスタデータ
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.eleven_labs_tags (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  name_ja TEXT DEFAULT '',
  description_ja TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_eleven_labs_tags_name ON kazikastudio.eleven_labs_tags(name);
CREATE INDEX IF NOT EXISTS idx_eleven_labs_tags_created_at ON kazikastudio.eleven_labs_tags(created_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER set_eleven_labs_tags_updated_at
  BEFORE UPDATE ON kazikastudio.eleven_labs_tags
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- Enable Row Level Security (全ユーザーが読み取り可能、管理者のみ編集可能)
ALTER TABLE kazikastudio.eleven_labs_tags ENABLE ROW LEVEL SECURITY;

-- Create policies (全ユーザーが参照可能)
CREATE POLICY "Anyone can view eleven labs tags"
  ON kazikastudio.eleven_labs_tags
  FOR SELECT
  USING (true);

-- 認証済みユーザーは追加・更新・削除可能
CREATE POLICY "Authenticated users can insert eleven labs tags"
  ON kazikastudio.eleven_labs_tags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update eleven labs tags"
  ON kazikastudio.eleven_labs_tags
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete eleven labs tags"
  ON kazikastudio.eleven_labs_tags
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Insert initial data
INSERT INTO kazikastudio.eleven_labs_tags (name, description, name_ja, description_ja) VALUES
  ('emotional', 'Emotional tone', '感情的', '感情を込めた音声'),
  ('calm', 'Calm and soothing tone', '穏やか', '落ち着いた優しい音声'),
  ('energetic', 'Energetic and enthusiastic tone', 'エネルギッシュ', '元気で活気のある音声'),
  ('professional', 'Professional and formal tone', 'プロフェッショナル', 'ビジネス的で正式な音声'),
  ('friendly', 'Friendly and approachable tone', 'フレンドリー', '親しみやすい音声'),
  ('serious', 'Serious and authoritative tone', '真面目', '真剣で権威のある音声')
ON CONFLICT DO NOTHING;
