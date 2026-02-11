-- Add user_id column to jobs table
ALTER TABLE public.jobs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX idx_sent_messages_job_id ON public.sent_messages(job_id);

-- Drop insecure policies
DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow all access to sent_messages" ON public.sent_messages;

-- Create secure RLS policies for jobs table
-- Users can only see their own jobs
CREATE POLICY "Users can view their own jobs"
  ON public.jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert jobs for themselves
CREATE POLICY "Users can insert their own jobs"
  ON public.jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own jobs
CREATE POLICY "Users can update their own jobs"
  ON public.jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own jobs
CREATE POLICY "Users can delete their own jobs"
  ON public.jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create secure RLS policies for sent_messages table
-- Users can only see messages from their own jobs
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

-- Users can only insert messages for their own jobs
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

-- Users can only update messages from their own jobs
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

-- Users can only delete messages from their own jobs
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

-- Add comment explaining the security model
COMMENT ON TABLE public.jobs IS 'Jobs are user-scoped. Each user can only access their own jobs.';
COMMENT ON TABLE public.sent_messages IS 'Messages are accessible only through job ownership. Users can only access messages from their own jobs.';

