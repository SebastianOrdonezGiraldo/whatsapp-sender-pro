-- Compatibility migration: some environments/policies still reference jobs.user_id.
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
