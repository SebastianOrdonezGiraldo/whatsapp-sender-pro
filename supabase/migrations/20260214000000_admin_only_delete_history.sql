-- ============================================================================
-- Restrict delete operations to admin role only
-- ============================================================================
-- Users can still read/insert/update according to existing RLS.
-- Delete on jobs, message_queue and sent_messages is now admin-only.
-- ============================================================================

-- JOBS TABLE
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users and admins can delete jobs" ON public.jobs;
DROP POLICY IF EXISTS "Only admins can delete jobs" ON public.jobs;

CREATE POLICY "Only admins can delete jobs"
  ON public.jobs
  FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- MESSAGE_QUEUE TABLE
DROP POLICY IF EXISTS "Users can delete queue messages from their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users and admins can delete queue messages" ON public.message_queue;
DROP POLICY IF EXISTS "Only admins can delete queue messages" ON public.message_queue;

CREATE POLICY "Only admins can delete queue messages"
  ON public.message_queue
  FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- SENT_MESSAGES TABLE
DROP POLICY IF EXISTS "Users can delete messages from their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users and admins can delete sent messages" ON public.sent_messages;
DROP POLICY IF EXISTS "Only admins can delete sent messages" ON public.sent_messages;

CREATE POLICY "Only admins can delete sent messages"
  ON public.sent_messages
  FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
