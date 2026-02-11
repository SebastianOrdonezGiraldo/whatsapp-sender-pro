-- Message Queue Table for Advanced Rate Limiting
CREATE TABLE IF NOT EXISTS public.message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  
  -- Message data
  phone_e164 TEXT NOT NULL,
  guide_number TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  
  -- Queue management
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, SENT, FAILED, RETRYING
  priority INTEGER NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
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
  
  -- Prevent duplicate messages in queue
  UNIQUE(job_id, phone_e164, guide_number)
);

-- Indexes for performance
CREATE INDEX idx_message_queue_job_id ON public.message_queue(job_id);
CREATE INDEX idx_message_queue_status ON public.message_queue(status);
CREATE INDEX idx_message_queue_scheduled_at ON public.message_queue(scheduled_at);
CREATE INDEX idx_message_queue_next_retry ON public.message_queue(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_message_queue_processing ON public.message_queue(status, priority, scheduled_at) 
  WHERE status IN ('PENDING', 'RETRYING');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_queue_updated_at
  BEFORE UPDATE ON public.message_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_message_queue_updated_at();

-- RLS Policies for message_queue
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their own jobs
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

-- Users can insert messages for their own jobs
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

-- Users can update messages from their own jobs
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

-- Add rate_limit_config table for dynamic configuration
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- WhatsApp API limits (per phone number ID)
  messages_per_second INTEGER NOT NULL DEFAULT 80, -- WhatsApp Business API limit
  messages_per_minute INTEGER NOT NULL DEFAULT 1000,
  messages_per_hour INTEGER NOT NULL DEFAULT 10000,
  
  -- Batch processing
  batch_size INTEGER NOT NULL DEFAULT 20,
  batch_delay_ms INTEGER NOT NULL DEFAULT 250, -- Delay between batches
  
  -- Retry configuration
  retry_delay_base_ms INTEGER NOT NULL DEFAULT 1000, -- Base delay for exponential backoff
  retry_delay_max_ms INTEGER NOT NULL DEFAULT 60000, -- Max retry delay (1 minute)
  
  -- Circuit breaker
  error_threshold INTEGER NOT NULL DEFAULT 5, -- Errors before circuit break
  circuit_break_duration_ms INTEGER NOT NULL DEFAULT 30000, -- 30 seconds
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO public.rate_limit_config (id, messages_per_second, messages_per_minute)
VALUES ('00000000-0000-0000-0000-000000000001', 80, 1000)
ON CONFLICT (id) DO NOTHING;

-- Make rate_limit_config readable by authenticated users
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rate limit config"
  ON public.rate_limit_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Function to get pending messages count for a job
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

-- Add comments
COMMENT ON TABLE public.message_queue IS 'Queue for WhatsApp messages with rate limiting and retry logic';
COMMENT ON TABLE public.rate_limit_config IS 'Configuration for rate limiting and message processing';

