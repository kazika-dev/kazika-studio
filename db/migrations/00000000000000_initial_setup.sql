-- =====================================================
-- Kazika Studio - 初期セットアップ
-- =====================================================
-- このファイルは新規Supabaseプロジェクトの初期セットアップ用です
-- 既存のプロジェクトには個別のマイグレーションファイルを使用してください
-- =====================================================

-- =====================================================
-- 1. kazikastudioスキーマの作成と権限設定
-- =====================================================

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

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA kazikastudio GRANT ALL ON FUNCTIONS TO anon, authenticated;

-- =====================================================
-- 2. プロフィールテーブル (public.profiles)
-- =====================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create a profile when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update updated_at
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 3. ワークフローテーブル (kazikastudio.workflows)
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS kazikastudio.workflows CASCADE;

-- Create workflows table
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

-- Create indexes
CREATE INDEX idx_workflows_user_id ON kazikastudio.workflows(user_id);
CREATE INDEX idx_workflows_created_at ON kazikastudio.workflows(created_at DESC);
CREATE INDEX idx_workflows_updated_at ON kazikastudio.workflows(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE kazikastudio.workflows ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own workflows"
  ON kazikastudio.workflows
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows"
  ON kazikastudio.workflows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON kazikastudio.workflows
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON kazikastudio.workflows
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function
CREATE OR REPLACE FUNCTION kazikastudio.handle_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_workflows_updated ON kazikastudio.workflows;
CREATE TRIGGER on_workflows_updated
  BEFORE UPDATE ON kazikastudio.workflows
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_workflows_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.workflows IS 'Stores user workflow definitions with nodes and edges';
COMMENT ON COLUMN kazikastudio.workflows.nodes IS 'JSON array of workflow nodes';
COMMENT ON COLUMN kazikastudio.workflows.edges IS 'JSON array of workflow edges/connections';

-- Grant permissions
GRANT ALL ON kazikastudio.workflows TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.workflows_id_seq TO anon, authenticated;

-- =====================================================
-- 4. アウトプットテーブル (kazikastudio.workflow_outputs)
-- =====================================================

-- Drop existing table if it exists
DROP TABLE IF EXISTS kazikastudio.workflow_outputs CASCADE;

-- Create workflow_outputs table
CREATE TABLE kazikastudio.workflow_outputs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id BIGINT REFERENCES kazikastudio.workflows(id) ON DELETE SET NULL,
  output_type TEXT NOT NULL CHECK (output_type IN ('image', 'video', 'audio', 'text', 'file', 'json')),
  content_url TEXT,
  content_text TEXT,
  prompt TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT content_check CHECK (
    (output_type IN ('image', 'video', 'audio', 'file') AND content_url IS NOT NULL) OR
    (output_type = 'text' AND content_text IS NOT NULL) OR
    (output_type = 'json' AND metadata IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX idx_workflow_outputs_user_id ON kazikastudio.workflow_outputs(user_id);
CREATE INDEX idx_workflow_outputs_workflow_id ON kazikastudio.workflow_outputs(workflow_id);
CREATE INDEX idx_workflow_outputs_output_type ON kazikastudio.workflow_outputs(output_type);
CREATE INDEX idx_workflow_outputs_created_at ON kazikastudio.workflow_outputs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE kazikastudio.workflow_outputs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflow outputs"
  ON kazikastudio.workflow_outputs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger function
CREATE OR REPLACE FUNCTION kazikastudio.handle_workflow_outputs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_workflow_outputs_updated ON kazikastudio.workflow_outputs;
CREATE TRIGGER on_workflow_outputs_updated
  BEFORE UPDATE ON kazikastudio.workflow_outputs
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_workflow_outputs_updated_at();

-- Add comments
COMMENT ON TABLE kazikastudio.workflow_outputs IS 'Stores all outputs from workflow executions (images, text, files)';
COMMENT ON COLUMN kazikastudio.workflow_outputs.output_type IS 'Type of output: image, video, audio, text, file, or json';
COMMENT ON COLUMN kazikastudio.workflow_outputs.content_url IS 'URL to the content stored in GCP Storage (for images/videos/audio/files)';
COMMENT ON COLUMN kazikastudio.workflow_outputs.content_text IS 'Direct text content (for text outputs)';
COMMENT ON COLUMN kazikastudio.workflow_outputs.prompt IS 'Input prompt used to generate this output';
COMMENT ON COLUMN kazikastudio.workflow_outputs.metadata IS 'Additional metadata (model, parameters, dimensions, duration, etc.)';

-- Grant permissions
GRANT ALL ON kazikastudio.workflow_outputs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE kazikastudio.workflow_outputs_id_seq TO anon, authenticated;

-- =====================================================
-- 初期セットアップ完了
-- =====================================================
