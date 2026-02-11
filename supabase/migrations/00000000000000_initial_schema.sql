-- ============================================================================
-- Initial Schema Setup for WhatsApp Sender Pro
-- ============================================================================

-- 1. Create base tables (jobs and sent_messages)
-- ============================================================================

-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  sent_ok INTEGER NOT NULL DEFAULT 0,
  sent_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sent messages table
CREATE TABLE IF NOT EXISTS public.sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  guide_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT 'Import Corporal Medical',
  template_name TEXT,
  wa_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(phone_e164, guide_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_job_id ON public.sent_messages(job_id);

-- 2. Enable RLS and create policies
-- ============================================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for jobs table
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

-- RLS policies for sent_messages table
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

-- 3. Create message queue table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Message data
  phone_e164 TEXT NOT NULL,
  guide_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  
  -- Queue management
  status TEXT NOT NULL DEFAULT 'PENDING',
  priority INTEGER NOT NULL DEFAULT 5,
  
  -- Retry logic
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Rate limiting
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  
  -- Results
  wa_message_id TEXT,
  error_message TEXT,
  error_code TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(job_id, phone_e164, guide_number)
);

-- Indexes for message queue
CREATE INDEX IF NOT EXISTS idx_message_queue_job_id ON public.message_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON public.message_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled_at ON public.message_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_message_queue_next_retry ON public.message_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_queue_processing ON public.message_queue(status, priority, scheduled_at) 
  WHERE status IN ('PENDING', 'RETRYING');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_queue_updated_at ON public.message_queue;
CREATE TRIGGER message_queue_updated_at
  BEFORE UPDATE ON public.message_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_message_queue_updated_at();

-- RLS Policies for message_queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

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
  );

-- 4. Rate limit configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  messages_per_second INTEGER NOT NULL DEFAULT 80,
  messages_per_minute INTEGER NOT NULL DEFAULT 1000,
  messages_per_hour INTEGER NOT NULL DEFAULT 10000,
  
  batch_size INTEGER NOT NULL DEFAULT 20,
  batch_delay_ms INTEGER NOT NULL DEFAULT 250,
  
  retry_delay_base_ms INTEGER NOT NULL DEFAULT 1000,
  retry_delay_max_ms INTEGER NOT NULL DEFAULT 60000,
  
  error_threshold INTEGER NOT NULL DEFAULT 5,
  circuit_break_duration_ms INTEGER NOT NULL DEFAULT 30000,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO public.rate_limit_config (id, messages_per_second, messages_per_minute)
VALUES ('00000000-0000-0000-0000-000000000001', 80, 1000)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rate limit config"
  ON public.rate_limit_config
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Utility functions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_job_queue_stats(job_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'PENDING'),
    'processing', COUNT(*) FILTER (WHERE status = 'PROCESSING'),
    'sent', COUNT(*) FILTER (WHERE status = 'SENT'),
    'failed', COUNT(*) FILTER (WHERE status = 'FAILED'),
    'retrying', COUNT(*) FILTER (WHERE status = 'RETRYING'),
    'total', COUNT(*)
  ) INTO result
  FROM public.message_queue
  WHERE job_id = job_uuid;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.jobs IS 'Jobs are user-scoped. Each user can only access their own jobs.';
COMMENT ON TABLE public.sent_messages IS 'Messages are accessible only through job ownership.';
COMMENT ON TABLE public.message_queue IS 'Queue for WhatsApp messages with rate limiting and retry logic';
COMMENT ON TABLE public.rate_limit_config IS 'Configuration for rate limiting and message processing';

