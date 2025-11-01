-- Create kazikastudio schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS kazikastudio;

-- Grant usage on schema to anon and authenticated roles
GRANT USAGE ON SCHEMA kazikastudio TO anon, authenticated;

-- Grant all privileges on all tables in schema to anon and authenticated roles
GRANT ALL ON ALL TABLES IN SCHEMA kazikastudio TO anon, authenticated;

-- Grant all privileges on all sequences in schema (for auto-increment IDs)
GRANT ALL ON ALL SEQUENCES IN SCHEMA kazikastudio TO anon, authenticated;

-- Grant all privileges on all functions in schema
GRANT ALL ON ALL FUNCTIONS IN SCHEMA kazikastudio TO anon, authenticated;

-- Drop existing table if it exists (to recreate with correct schema)
DROP TABLE IF EXISTS kazikastudio.workflows CASCADE;

-- Create workflows table
-- This table stores workflow definitions for each user
CREATE TABLE kazikastudio.workflows (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON kazikastudio.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON kazikastudio.workflows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON kazikastudio.workflows(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE kazikastudio.workflows ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own workflows
CREATE POLICY "Users can view own workflows"
  ON kazikastudio.workflows
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own workflows
CREATE POLICY "Users can insert own workflows"
  ON kazikastudio.workflows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workflows
CREATE POLICY "Users can update own workflows"
  ON kazikastudio.workflows
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own workflows
CREATE POLICY "Users can delete own workflows"
  ON kazikastudio.workflows
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION kazikastudio.handle_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_workflows_updated ON kazikastudio.workflows;
CREATE TRIGGER on_workflows_updated
  BEFORE UPDATE ON kazikastudio.workflows
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_workflows_updated_at();

-- Add comment to table
COMMENT ON TABLE kazikastudio.workflows IS 'Stores user workflow definitions with nodes and edges';
COMMENT ON COLUMN kazikastudio.workflows.nodes IS 'JSON array of workflow nodes';
COMMENT ON COLUMN kazikastudio.workflows.edges IS 'JSON array of workflow edges/connections';

-- Grant permissions on the newly created table
GRANT ALL ON kazikastudio.workflows TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.workflows_id_seq TO anon, authenticated;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON FUNCTIONS TO anon, authenticated;
