-- Add optional transactional email delivery alongside WhatsApp notifications.

ALTER TABLE public.message_queue
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_error_message TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

ALTER TABLE public.sent_messages
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_error_message TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.message_queue
    ADD CONSTRAINT message_queue_email_status_check
    CHECK (email_status IN ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'SENT', 'FAILED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.sent_messages
    ADD CONSTRAINT sent_messages_email_status_check
    CHECK (email_status IN ('NOT_REQUESTED', 'PENDING', 'PROCESSING', 'SENT', 'FAILED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_message_queue_email_pending
  ON public.message_queue (email_status, scheduled_at)
  WHERE recipient_email IS NOT NULL AND email_status IN ('PENDING', 'PROCESSING');

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
    'total', COUNT(*),
    'email_pending', COUNT(*) FILTER (WHERE email_status = 'PENDING'),
    'email_processing', COUNT(*) FILTER (WHERE email_status = 'PROCESSING'),
    'email_sent', COUNT(*) FILTER (WHERE email_status = 'SENT'),
    'email_failed', COUNT(*) FILTER (WHERE email_status = 'FAILED'),
    'email_total', COUNT(*) FILTER (WHERE recipient_email IS NOT NULL)
  ) INTO result
  FROM public.message_queue
  WHERE job_id = job_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

COMMENT ON COLUMN public.message_queue.recipient_email IS 'Optional recipient for the shipment guide email.';
COMMENT ON COLUMN public.message_queue.email_status IS 'Independent SMTP delivery status; does not change WhatsApp delivery status.';
COMMENT ON COLUMN public.sent_messages.recipient_email IS 'Optional recipient used for the shipment guide email.';
COMMENT ON COLUMN public.sent_messages.email_status IS 'Final SMTP delivery status recorded independently from WhatsApp.';
