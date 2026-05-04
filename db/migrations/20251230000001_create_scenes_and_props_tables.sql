-- シーンマスタと小物マスタテーブルの作成
-- 2025-12-30

-- ============================================
-- シーンマスタテーブル (m_scenes)
-- ============================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_scenes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    location TEXT,
    time_of_day TEXT,
    weather TEXT,
    mood TEXT,
    prompt_hint_ja TEXT,
    prompt_hint_en TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- シーンマスタのインデックス
CREATE INDEX IF NOT EXISTS idx_m_scenes_user_id ON kazikastudio.m_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_m_scenes_name ON kazikastudio.m_scenes(name);
CREATE INDEX IF NOT EXISTS idx_m_scenes_location ON kazikastudio.m_scenes(location);
CREATE INDEX IF NOT EXISTS idx_m_scenes_time_of_day ON kazikastudio.m_scenes(time_of_day);
CREATE INDEX IF NOT EXISTS idx_m_scenes_tags ON kazikastudio.m_scenes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_m_scenes_created_at ON kazikastudio.m_scenes(created_at DESC);

-- シーンマスタのRLSポリシー
ALTER TABLE kazikastudio.m_scenes ENABLE ROW LEVEL SECURITY;

-- SELECT: 共有シーン（user_id IS NULL）または自分のシーンを参照可能
CREATE POLICY "m_scenes_select_policy" ON kazikastudio.m_scenes
    FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

-- INSERT: 認証済みユーザーのみ作成可能
CREATE POLICY "m_scenes_insert_policy" ON kazikastudio.m_scenes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 自分のシーンのみ更新可能
CREATE POLICY "m_scenes_update_policy" ON kazikastudio.m_scenes
    FOR UPDATE USING (user_id = auth.uid());

-- DELETE: 自分のシーンのみ削除可能
CREATE POLICY "m_scenes_delete_policy" ON kazikastudio.m_scenes
    FOR DELETE USING (user_id = auth.uid());

-- updated_at自動更新トリガー
CREATE TRIGGER update_m_scenes_updated_at
    BEFORE UPDATE ON kazikastudio.m_scenes
    FOR EACH ROW
    EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- コメント
COMMENT ON TABLE kazikastudio.m_scenes IS 'シーン（背景・場所）マスタテーブル';
COMMENT ON COLUMN kazikastudio.m_scenes.user_id IS '所有者ID（NULLは共有シーン）';
COMMENT ON COLUMN kazikastudio.m_scenes.name IS 'シーン名';
COMMENT ON COLUMN kazikastudio.m_scenes.image_url IS '背景画像のストレージパス';
COMMENT ON COLUMN kazikastudio.m_scenes.location IS '場所タイプ（school, home, outdoor, etc.）';
COMMENT ON COLUMN kazikastudio.m_scenes.time_of_day IS '時間帯（morning, afternoon, evening, night）';
COMMENT ON COLUMN kazikastudio.m_scenes.weather IS '天気（sunny, cloudy, rainy, snowy）';
COMMENT ON COLUMN kazikastudio.m_scenes.mood IS '雰囲気（peaceful, tense, romantic, etc.）';
COMMENT ON COLUMN kazikastudio.m_scenes.prompt_hint_ja IS '画像生成用の日本語プロンプトヒント';
COMMENT ON COLUMN kazikastudio.m_scenes.prompt_hint_en IS '画像生成用の英語プロンプトヒント';

-- ============================================
-- 小物マスタテーブル (m_props)
-- ============================================

CREATE TABLE IF NOT EXISTS kazikastudio.m_props (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category TEXT,
    prompt_hint_ja TEXT,
    prompt_hint_en TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 小物マスタのインデックス
CREATE INDEX IF NOT EXISTS idx_m_props_user_id ON kazikastudio.m_props(user_id);
CREATE INDEX IF NOT EXISTS idx_m_props_name ON kazikastudio.m_props(name);
CREATE INDEX IF NOT EXISTS idx_m_props_category ON kazikastudio.m_props(category);
CREATE INDEX IF NOT EXISTS idx_m_props_tags ON kazikastudio.m_props USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_m_props_created_at ON kazikastudio.m_props(created_at DESC);

-- 小物マスタのRLSポリシー
ALTER TABLE kazikastudio.m_props ENABLE ROW LEVEL SECURITY;

-- SELECT: 共有小物（user_id IS NULL）または自分の小物を参照可能
CREATE POLICY "m_props_select_policy" ON kazikastudio.m_props
    FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

-- INSERT: 認証済みユーザーのみ作成可能
CREATE POLICY "m_props_insert_policy" ON kazikastudio.m_props
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 自分の小物のみ更新可能
CREATE POLICY "m_props_update_policy" ON kazikastudio.m_props
    FOR UPDATE USING (user_id = auth.uid());

-- DELETE: 自分の小物のみ削除可能
CREATE POLICY "m_props_delete_policy" ON kazikastudio.m_props
    FOR DELETE USING (user_id = auth.uid());

-- updated_at自動更新トリガー
CREATE TRIGGER update_m_props_updated_at
    BEFORE UPDATE ON kazikastudio.m_props
    FOR EACH ROW
    EXECUTE FUNCTION kazikastudio.update_updated_at_column();

-- コメント
COMMENT ON TABLE kazikastudio.m_props IS '小物（アイテム・小道具）マスタテーブル';
COMMENT ON COLUMN kazikastudio.m_props.user_id IS '所有者ID（NULLは共有小物）';
COMMENT ON COLUMN kazikastudio.m_props.name IS '小物名';
COMMENT ON COLUMN kazikastudio.m_props.image_url IS '画像のストレージパス';
COMMENT ON COLUMN kazikastudio.m_props.category IS 'カテゴリ（accessory, furniture, food, vehicle, etc.）';
COMMENT ON COLUMN kazikastudio.m_props.prompt_hint_ja IS '画像生成用の日本語プロンプトヒント';
COMMENT ON COLUMN kazikastudio.m_props.prompt_hint_en IS '画像生成用の英語プロンプトヒント';
