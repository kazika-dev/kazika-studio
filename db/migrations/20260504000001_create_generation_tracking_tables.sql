-- =====================================================
-- 生成ワークフロー追跡テーブル
-- =====================================================
-- チャット指示 → 画像生成 → 動画生成 → 採用/修正 の関連を
-- Kazika Studio 上で追えるようにするための最小スキーマ。
-- Neon/Postgres を正本、Kazika Studio をビューとして使う。
-- =====================================================

CREATE TABLE IF NOT EXISTS kazikastudio.generation_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  studio_id BIGINT REFERENCES kazikastudio.studios(id) ON DELETE CASCADE,

  job_type TEXT NOT NULL CHECK (job_type IN ('image', 'video', 'audio', 'edit', 'other')),
  provider TEXT NOT NULL,
  model TEXT,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')),

  external_job_id TEXT,
  external_job_url TEXT,
  credits_used NUMERIC,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS kazikastudio.generation_job_inputs (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES kazikastudio.generation_jobs(id) ON DELETE CASCADE,
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'reference',
  source_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS kazikastudio.generation_job_results (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES kazikastudio.generation_jobs(id) ON DELETE CASCADE,
  output_id BIGINT REFERENCES kazikastudio.workflow_outputs(id) ON DELETE SET NULL,
  rank INTEGER NOT NULL DEFAULT 0,
  selected BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON kazikastudio.generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_studio_id ON kazikastudio.generation_jobs(studio_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_type_status ON kazikastudio.generation_jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_created_at ON kazikastudio.generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_job_inputs_job_id ON kazikastudio.generation_job_inputs(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_job_inputs_output_id ON kazikastudio.generation_job_inputs(output_id);
CREATE INDEX IF NOT EXISTS idx_generation_job_results_job_id ON kazikastudio.generation_job_results(job_id);
CREATE INDEX IF NOT EXISTS idx_generation_job_results_output_id ON kazikastudio.generation_job_results(output_id);

CREATE OR REPLACE FUNCTION kazikastudio.handle_generation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_generation_jobs_updated ON kazikastudio.generation_jobs;
CREATE TRIGGER on_generation_jobs_updated
  BEFORE UPDATE ON kazikastudio.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION kazikastudio.handle_generation_jobs_updated_at();

-- Neon 運用ではアプリ/API層で所有者チェックを行う。
-- Supabase auth.uid() がない環境でも動くよう、このテーブルでは RLS ポリシーを作らない。
ALTER TABLE kazikastudio.generation_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.generation_job_inputs DISABLE ROW LEVEL SECURITY;
ALTER TABLE kazikastudio.generation_job_results DISABLE ROW LEVEL SECURITY;


COMMENT ON TABLE kazikastudio.generation_jobs IS '画像/動画/音声生成ジョブの正本。チャット指示、外部生成URL、状態を保存する。';
COMMENT ON TABLE kazikastudio.generation_job_inputs IS '生成ジョブに使った参照素材。画像→動画の親子関係もここで表す。';
COMMENT ON TABLE kazikastudio.generation_job_results IS '生成ジョブから生まれた workflow_outputs。採用候補/選択状態を保存する。';
