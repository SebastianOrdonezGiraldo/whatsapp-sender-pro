-- ============================================================================
-- CRITICAL SECURITY FIX: Remove Public Access Policies
-- ============================================================================
-- 
-- This migration fixes the CRITICAL RLS vulnerability where policies use
-- USING (true) which allows public access to all data.
-- 
-- SECURITY ISSUE: The following policies allowed anyone to access all data:
--   - "Allow all access to jobs" 
--   - "Allow all access to sent_messages"
--   - "Allow all access to message_queue"
-- 
-- SOLUTION: Replace with proper user-scoped policies that enforce data isolation
-- 
-- ⚠️  BREAKING CHANGE: Authentication is now REQUIRED to access data
-- ============================================================================

-- ============================================================================
-- 1. Drop ALL Insecure Policies with USING (true)
-- ============================================================================

-- Drop insecure public access policies
DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow all access to sent_messages" ON public.sent_messages;
DROP POLICY IF EXISTS "Allow all access to message_queue" ON public.message_queue;

-- Drop any old secure policies (in case they exist from restore_security migration)
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.jobs;

DROP POLICY IF EXISTS "Users can view messages from their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users can insert messages for their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users can update messages from their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users can delete messages from their own jobs" ON public.sent_messages;

DROP POLICY IF EXISTS "Users can view queue messages from their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users can insert queue messages for their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users can update queue messages from their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users can delete queue messages from their own jobs" ON public.message_queue;

-- ============================================================================
-- 2. Ensure RLS is ENABLED on all tables
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Make user_id MANDATORY in jobs table
-- ============================================================================

-- First, clean up any NULL user_id rows (set to dummy UUID if needed)
-- In production, you might want to handle this differently
UPDATE public.jobs 
SET user_id = '00000000-0000-0000-0000-000000000000' 
WHERE user_id IS NULL;

-- Now make user_id NOT NULL (required for proper RLS)
ALTER TABLE public.jobs ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- 4. Create SECURE RLS Policies for JOBS table
-- ============================================================================
-- Each user can ONLY access their own jobs based on auth.uid()

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

-- ============================================================================
-- 5. Create SECURE RLS Policies for SENT_MESSAGES table
-- ============================================================================
-- Users can only access messages from jobs they own

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

-- ============================================================================
-- 6. Create SECURE RLS Policies for MESSAGE_QUEUE table
-- ============================================================================
-- Users can only access queue messages from jobs they own

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

CREATE POLICY "Users can delete queue messages from their own jobs"
  ON public.message_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND jobs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. Update Table Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.jobs IS 
  'Jobs table - User-scoped with RLS. Each user can only access their own jobs via auth.uid() = user_id.';

COMMENT ON TABLE public.sent_messages IS 
  'Sent messages table - User-scoped via job ownership. Users can only access messages from jobs they own.';

COMMENT ON TABLE public.message_queue IS 
  'Message queue table - User-scoped via job ownership. Users can only access queue messages from jobs they own.';

COMMENT ON COLUMN public.jobs.user_id IS 
  'User ID (NOT NULL) - Links job to authenticated user. Required for RLS policies.';

-- ============================================================================
-- 8. Security Verification Comments
-- ============================================================================

-- To verify RLS is properly configured, run these queries:
--
-- 1. Verify RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('jobs', 'sent_messages', 'message_queue');
-- Expected: All should show rowsecurity = true
--
-- 2. Check for insecure policies (should return 0 rows):
-- SELECT schemaname, tablename, policyname, qual::text, with_check::text
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- AND (qual::text = 'true' OR with_check::text = 'true');
-- Expected: 0 rows (no insecure policies)
--
-- 3. List all active policies:
-- SELECT tablename, policyname, cmd, qual::text
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- Expected: Should show user-scoped policies with auth.uid() checks

-- ============================================================================
-- ✅ SECURITY FIX COMPLETE
-- ============================================================================
-- 
-- Changes Applied:
-- ✅ Removed all USING (true) policies (public access)
-- ✅ Created user-scoped policies for jobs table
-- ✅ Created user-scoped policies for sent_messages table  
-- ✅ Created user-scoped policies for message_queue table
-- ✅ Made user_id NOT NULL in jobs table
-- ✅ RLS enabled on all 3 tables
-- ✅ All policies check auth.uid() for proper data isolation
-- 
-- IMPORTANT: Users MUST be authenticated to access data
-- Anonymous/public access will now be rejected by RLS
-- 
-- Edge Functions using service role key will bypass RLS (as expected)
-- ============================================================================
