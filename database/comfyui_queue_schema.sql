-- ComfyUI Queue Table
-- This table stores queue items for ComfyUI workflow processing

CREATE TABLE IF NOT EXISTS kazikastudio.comfyui_queue (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Workflow identification
  comfyui_workflow_name TEXT NOT NULL,
  workflow_json JSONB NOT NULL, -- Complete ComfyUI workflow definition

  -- Input parameters
  prompt TEXT,
  img_gcp_storage_paths JSONB DEFAULT '[]'::jsonb, -- Array of GCP Storage paths for input images

  -- Queue status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0, -- Higher priority = processed first

  -- Processing metadata
  comfyui_prompt_id TEXT, -- ID returned by ComfyUI /prompt endpoint
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Output results
  output_gcp_storage_paths JSONB DEFAULT '[]'::jsonb, -- Array of output image paths
  output_data JSONB, -- Additional output data
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_comfyui_queue_status_priority
  ON kazikastudio.comfyui_queue (status, priority DESC, created_at ASC);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_comfyui_queue_user_id
  ON kazikastudio.comfyui_queue (user_id, created_at DESC);

-- Index for prompt_id lookup
CREATE INDEX IF NOT EXISTS idx_comfyui_queue_prompt_id
  ON kazikastudio.comfyui_queue (comfyui_prompt_id)
  WHERE comfyui_prompt_id IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION kazikastudio.update_comfyui_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comfyui_queue_updated_at ON kazikastudio.comfyui_queue;
CREATE TRIGGER trigger_update_comfyui_queue_updated_at
  BEFORE UPDATE ON kazikastudio.comfyui_queue
  FOR EACH ROW
  EXECUTE FUNCTION kazikastudio.update_comfyui_queue_updated_at();

-- Comments for documentation
COMMENT ON TABLE kazikastudio.comfyui_queue IS 'Queue for ComfyUI workflow processing tasks';
COMMENT ON COLUMN kazikastudio.comfyui_queue.img_gcp_storage_paths IS 'JSON array of GCP Storage paths for input images';
COMMENT ON COLUMN kazikastudio.comfyui_queue.workflow_json IS 'Complete ComfyUI workflow definition in JSON format';
COMMENT ON COLUMN kazikastudio.comfyui_queue.priority IS 'Higher values are processed first (default: 0)';
