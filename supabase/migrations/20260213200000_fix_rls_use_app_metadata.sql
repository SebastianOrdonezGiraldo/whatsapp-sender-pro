-- ============================================================================
-- FIX: Replace user_metadata with app_metadata in all RLS policies
-- ============================================================================
-- SECURITY FIX: user_metadata is editable by end users and should NEVER be
-- used in security contexts. app_metadata can only be modified server-side
-- (via service_role key), making it safe for authorization checks.
--
-- Supabase Linter: rls_references_user_metadata (0015)
-- https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata
-- ============================================================================

-- ============================================================================
-- JOBS TABLE - Recreate all policies with app_metadata
-- ============================================================================

DROP POLICY IF EXISTS "Users and admins can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users and admins can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users and admins can update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users and admins can delete jobs" ON public.jobs;

CREATE POLICY "Users and admins can view jobs"
  ON public.jobs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users and admins can insert jobs"
  ON public.jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users and admins can update jobs"
  ON public.jobs
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Users and admins can delete jobs"
  ON public.jobs
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================================
-- MESSAGE_QUEUE TABLE - Recreate all policies with app_metadata
-- ============================================================================

DROP POLICY IF EXISTS "Users and admins can view queue messages" ON public.message_queue;
DROP POLICY IF EXISTS "Users and admins can insert queue messages" ON public.message_queue;
DROP POLICY IF EXISTS "Users and admins can update queue messages" ON public.message_queue;
DROP POLICY IF EXISTS "Users and admins can delete queue messages" ON public.message_queue;

CREATE POLICY "Users and admins can view queue messages"
  ON public.message_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Users and admins can insert queue messages"
  ON public.message_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Users and admins can update queue messages"
  ON public.message_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Users and admins can delete queue messages"
  ON public.message_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

-- ============================================================================
-- SENT_MESSAGES TABLE - Recreate all policies with app_metadata
-- ============================================================================

DROP POLICY IF EXISTS "Users and admins can view sent messages" ON public.sent_messages;
DROP POLICY IF EXISTS "Users and admins can insert sent messages" ON public.sent_messages;
DROP POLICY IF EXISTS "Users and admins can update sent messages" ON public.sent_messages;
DROP POLICY IF EXISTS "Users and admins can delete sent messages" ON public.sent_messages;

CREATE POLICY "Users and admins can view sent messages"
  ON public.sent_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Users and admins can insert sent messages"
  ON public.sent_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Users and admins can update sent messages"
  ON public.sent_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "Users and admins can delete sent messages"
  ON public.sent_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.jobs IS
  'Jobs table - User-scoped with RLS. Users access own jobs. Admins (app_metadata.role=admin) access all.';

COMMENT ON TABLE public.sent_messages IS
  'Sent messages table - User-scoped via job ownership. Admins (app_metadata) access all.';

COMMENT ON TABLE public.message_queue IS
  'Message queue table - User-scoped via job ownership. Admins (app_metadata) access all.';

