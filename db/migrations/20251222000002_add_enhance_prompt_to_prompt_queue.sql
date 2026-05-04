-- =====================================================
-- prompt_queues テーブルにプロンプト補完機能カラムを追加
-- =====================================================

-- プロンプト補完モード（none: そのまま使用, enhance: Geminiで補完）
ALTER TABLE kazikastudio.prompt_queues
  ADD COLUMN IF NOT EXISTS enhance_prompt TEXT NOT NULL DEFAULT 'none';

-- 補完後のプロンプト（enhance モードで実行後に保存）
ALTER TABLE kazikastudio.prompt_queues
  ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT;

-- enhance_prompt の値チェック制約
ALTER TABLE kazikastudio.prompt_queues
  ADD CONSTRAINT chk_prompt_queues_enhance_prompt
  CHECK (enhance_prompt IN ('none', 'enhance'));

-- コメント
COMMENT ON COLUMN kazikastudio.prompt_queues.enhance_prompt IS 'プロンプト補完モード: none=そのまま使用, enhance=Geminiで英語プロンプトに補完';
COMMENT ON COLUMN kazikastudio.prompt_queues.enhanced_prompt IS '補完後のプロンプト（enhanceモード実行後）';
