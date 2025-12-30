-- =====================================================
-- prompt_queue_images テーブルの image_type 制約を更新
-- scene と prop タイプを追加
-- =====================================================

-- 既存のCHECK制約を削除
ALTER TABLE kazikastudio.prompt_queue_images
  DROP CONSTRAINT IF EXISTS chk_prompt_queue_images_type;

-- 新しいCHECK制約を追加（scene と prop を含む）
ALTER TABLE kazikastudio.prompt_queue_images
  ADD CONSTRAINT chk_prompt_queue_images_type
  CHECK (image_type IN ('character_sheet', 'output', 'scene', 'prop'));

-- コメントを更新
COMMENT ON COLUMN kazikastudio.prompt_queue_images.image_type
  IS '画像タイプ: character_sheet（キャラクターシート）, output（アウトプット画像）, scene（シーンマスタ）, prop（小物マスタ）';

COMMENT ON COLUMN kazikastudio.prompt_queue_images.reference_id
  IS 'character_sheets.id, workflow_outputs.id, m_scenes.id, または m_props.id への参照';
