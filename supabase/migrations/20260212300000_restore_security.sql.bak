-- ============================================================================
-- RESTORE SECURITY: Re-enable authentication and RLS
-- ============================================================================
-- 
-- This migration restores full authentication and data isolation
-- Each user can only access their own data
-- 
-- IMPORTANT: Users must sign up/login to use the application
-- ============================================================================

-- 1. Drop insecure public policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow all access to sent_messages" ON public.sent_messages;
DROP POLICY IF EXISTS "Allow all access to message_queue" ON public.message_queue;
DROP POLICY IF EXISTS "Authenticated users can read rate limit config" ON public.rate_limit_config;

-- 2. Ensure RLS is enabled on all tables
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- 3. Make user_id required again
-- ============================================================================

-- First, update any NULL user_id rows (shouldn't exist in fresh install)
-- If you have existing data, you may need to handle this differently
UPDATE public.jobs SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- Now make it NOT NULL (commented out for safety - uncomment after data cleanup)
-- ALTER TABLE public.jobs ALTER COLUMN user_id SET NOT NULL;

-- 4. Create secure RLS policies for jobs table
-- ============================================================================

CREATE POLICY "Users can view their own jobs"
  ON public.jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON public.jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON public.jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create secure RLS policies for sent_messages table
-- ============================================================================

CREATE POLICY "Users can view messages from their own jobs"
  ON public.sent_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their own jobs"
  ON public.sent_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages from their own jobs"
  ON public.sent_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND jobs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from their own jobs"
  ON public.sent_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND jobs.user_id = auth.uid()
    )
  );

-- 6. Create secure RLS policies for message_queue table
-- ============================================================================

CREATE POLICY "Users can view queue messages from their own jobs"
  ON public.message_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert queue messages for their own jobs"
  ON public.message_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update queue messages from their own jobs"
  ON public.message_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND jobs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND jobs.user_id = auth.uid()
    )
  );

-- 7. RLS policies for rate_limit_config (read-only for authenticated users)
-- ============================================================================

CREATE POLICY "Authenticated users can read rate limit config"
  ON public.rate_limit_config
  FOR SELECT
  TO authenticated
  USING (true);

-- 8. Update table comments
-- ============================================================================

COMMENT ON TABLE public.jobs IS 'Jobs are user-scoped. Each user can only access their own jobs via RLS.';
COMMENT ON TABLE public.sent_messages IS 'Messages are accessible only through job ownership via RLS.';
COMMENT ON TABLE public.message_queue IS 'Queue messages are accessible only through job ownership via RLS.';
COMMENT ON TABLE public.rate_limit_config IS 'Rate limit configuration - read-only for authenticated users.';

-- 9. Create function to check job ownership (helper for Edge Functions)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_owns_job(job_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = job_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.user_owns_job IS 'Helper function to check if a user owns a specific job';

-- 10. Verification query (run this to verify RLS is working)
-- ============================================================================

-- To test RLS, run this as a specific user:
-- SELECT * FROM jobs; -- Should only see own jobs
-- SELECT * FROM sent_messages; -- Should only see messages from own jobs

-- ============================================================================
-- SECURITY RESTORED ✅
-- ============================================================================
-- 
-- Next steps:
-- 1. Deploy this migration: supabase db push
-- 2. Enable authentication in frontend (Login page)
-- 3. Update Edge Functions to validate user authentication
-- 4. Test with multiple users to verify data isolation
-- 
-- ============================================================================

