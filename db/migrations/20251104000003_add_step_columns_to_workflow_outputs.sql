-- Add missing columns to workflow_outputs to support step execution details
-- This migration adds columns needed for tracking step execution details
-- while maintaining compatibility with the existing user-facing outputs

-- Add step_id column (optional, for step execution tracking)
ALTER TABLE kazikastudio.workflow_outputs
ADD COLUMN IF NOT EXISTS step_id BIGINT REFERENCES kazikastudio.studio_board_workflow_steps(id) ON DELETE CASCADE;

-- Add node_id column (optional, for tracking which workflow node produced the output)
ALTER TABLE kazikastudio.workflow_outputs
ADD COLUMN IF NOT EXISTS node_id TEXT;

-- Add output_url column (optional, alternative to content_url for backward compatibility)
ALTER TABLE kazikastudio.workflow_outputs
ADD COLUMN IF NOT EXISTS output_url TEXT;

-- Add output_data column (optional, for storing structured output data)
ALTER TABLE kazikastudio.workflow_outputs
ADD COLUMN IF NOT EXISTS output_data JSONB;

-- Create index for step_id lookups
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_step_id ON kazikastudio.workflow_outputs(step_id);

-- Create index for node_id lookups
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_node_id ON kazikastudio.workflow_outputs(node_id);

-- Add comments
COMMENT ON COLUMN kazikastudio.workflow_outputs.step_id IS 'Optional: ID of the studio board workflow step that generated this output';
COMMENT ON COLUMN kazikastudio.workflow_outputs.node_id IS 'Optional: ID of the workflow node that generated this output';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_url IS 'Optional: Alternative URL field for backward compatibility';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_data IS 'Optional: Structured output data (imageData, audioData, etc.)';
