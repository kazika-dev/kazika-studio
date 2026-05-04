-- Create character_sheets table
CREATE TABLE IF NOT EXISTS public.character_sheets (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_character_sheets_user_id ON public.character_sheets(user_id);

-- Create index for created_at
CREATE INDEX IF NOT EXISTS idx_character_sheets_created_at ON public.character_sheets(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own character sheets
CREATE POLICY "Users can view their own character sheets"
  ON public.character_sheets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own character sheets
CREATE POLICY "Users can insert their own character sheets"
  ON public.character_sheets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own character sheets
CREATE POLICY "Users can update their own character sheets"
  ON public.character_sheets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Users can delete their own character sheets
CREATE POLICY "Users can delete their own character sheets"
  ON public.character_sheets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_character_sheets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_character_sheets_updated_at
  BEFORE UPDATE ON public.character_sheets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_character_sheets_updated_at();
