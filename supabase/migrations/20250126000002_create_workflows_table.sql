-- Create workflows table
-- This table stores workflow definitions for each user
CREATE TABLE IF NOT EXISTS public.workflows (
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
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON public.workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON public.workflows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON public.workflows(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own workflows
CREATE POLICY "Users can view own workflows"
  ON public.workflows
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own workflows
CREATE POLICY "Users can insert own workflows"
  ON public.workflows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own workflows
CREATE POLICY "Users can update own workflows"
  ON public.workflows
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own workflows
CREATE POLICY "Users can delete own workflows"
  ON public.workflows
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION public.handle_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_workflows_updated ON public.workflows;
CREATE TRIGGER on_workflows_updated
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.handle_workflows_updated_at();

-- Add comment to table
COMMENT ON TABLE public.workflows IS 'Stores user workflow definitions with nodes and edges';
COMMENT ON COLUMN public.workflows.nodes IS 'JSON array of workflow nodes';
COMMENT ON COLUMN public.workflows.edges IS 'JSON array of workflow edges/connections';
