-- ============================================================================
-- Admin Role Support for RLS Policies
-- ============================================================================
-- This migration adds support for admin users to access all resources
-- Admins are identified by user_metadata.role = 'admin'
-- ============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.jobs;

-- Create new policies with admin support
CREATE POLICY "Users and admins can view jobs"
  ON public.jobs
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin'
  );

CREATE POLICY "Users and admins can insert jobs"
  ON public.jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR 
    (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin'
  );

CREATE POLICY "Users and admins can update jobs"
  ON public.jobs
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR 
    (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR 
    (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin'
  );

CREATE POLICY "Users and admins can delete jobs"
  ON public.jobs
  FOR DELETE
  USING (
    auth.uid() = user_id 
    OR 
    (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin'
  );

-- Update policies for message_queue (via job ownership)
DROP POLICY IF EXISTS "Users can view queue messages from their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users can insert queue messages for their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users can update queue messages from their own jobs" ON public.message_queue;
DROP POLICY IF EXISTS "Users can delete queue messages from their own jobs" ON public.message_queue;

CREATE POLICY "Users and admins can view queue messages"
  ON public.message_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

CREATE POLICY "Users and admins can insert queue messages"
  ON public.message_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

CREATE POLICY "Users and admins can update queue messages"
  ON public.message_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

CREATE POLICY "Users and admins can delete queue messages"
  ON public.message_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = message_queue.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

-- Update policies for sent_messages (via job ownership)
DROP POLICY IF EXISTS "Users can view messages from their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users can insert messages for their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users can update messages from their own jobs" ON public.sent_messages;
DROP POLICY IF EXISTS "Users can delete messages from their own jobs" ON public.sent_messages;

CREATE POLICY "Users and admins can view sent messages"
  ON public.sent_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

CREATE POLICY "Users and admins can insert sent messages"
  ON public.sent_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

CREATE POLICY "Users and admins can update sent messages"
  ON public.sent_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

CREATE POLICY "Users and admins can delete sent messages"
  ON public.sent_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = sent_messages.job_id
      AND (jobs.user_id = auth.uid() OR (auth.jwt()->>'user_metadata')::jsonb->>'role' = 'admin')
    )
  );

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE public.jobs IS 
  'Jobs table - User-scoped with RLS. Users can access their own jobs. Admins (user_metadata.role=admin) can access all jobs.';

COMMENT ON TABLE public.sent_messages IS 
  'Sent messages table - User-scoped via job ownership. Admins can access all messages.';

COMMENT ON TABLE public.message_queue IS 
  'Message queue table - User-scoped via job ownership. Admins can access all queue messages.';
