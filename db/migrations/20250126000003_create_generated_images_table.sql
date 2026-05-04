-- Create workflow_outputs table
-- This table stores all outputs (images, text, files) from workflow executions
CREATE TABLE kazikastudio.workflow_outputs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE SET NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('image', 'video', 'audio', 'text', 'file', 'json')),
  content_url TEXT, -- URL for images/files stored in GCP Storage
  content_text TEXT, -- Direct text content for text outputs
  prompt TEXT, -- Input prompt (for AI-generated content)
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (model, parameters, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT content_check CHECK (
    (output_type IN ('image', 'video', 'audio', 'file') AND content_url IS NOT NULL) OR
    (output_type = 'text' AND content_text IS NOT NULL) OR
    (output_type = 'json' AND metadata IS NOT NULL)
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_user_id ON kazikastudio.workflow_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_workflow_id ON kazikastudio.workflow_outputs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_output_type ON kazikastudio.workflow_outputs(output_type);
CREATE INDEX IF NOT EXISTS idx_workflow_outputs_created_at ON kazikastudio.workflow_outputs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE kazikastudio.workflow_outputs ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own workflow outputs
CREATE POLICY "Users can view own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own workflow outputs
CREATE POLICY "Users can insert own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workflow outputs
CREATE POLICY "Users can update own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own workflow outputs
CREATE POLICY "Users can delete own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_workflow_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_workflow_outputs_updated ON kazikastudio.workflow_outputs;
CREATE TRIGGER on_workflow_outputs_updated
  BEFORE UPDATE ON kazikastudio.workflow_outputs
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_workflow_outputs_updated_at();

-- Add comments to table
COMMENT ON TABLE kazikastudio.workflow_outputs IS 'Stores all outputs from workflow executions (images, text, files)';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_type IS 'Type of output: image, video, audio, text, file, or json';
COMMENT ON COLUMN kazikastudio.workflow_outputs.content_url IS 'URL to the content stored in GCP Storage (for images/videos/audio/files)';
COMMENT ON COLUMN kazikastudio.workflow_outputs.content_text IS 'Direct text content (for text outputs)';
COMMENT ON COLUMN kazikastudio.workflow_outputs.prompt IS 'Input prompt used to generate this output';
COMMENT ON COLUMN kazikastudio.workflow_outputs.metadata IS 'Additional metadata (model, parameters, dimensions, duration, etc.)';

-- Grant permissions on the newly created table
GRANT ALL ON kazikastudio.workflow_outputs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.workflow_outputs_id_seq TO anon, authenticated;

-- Ensure default privileges are set (in case not already set by previous migration)
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON FUNCTIONS TO anon, authenticated;
