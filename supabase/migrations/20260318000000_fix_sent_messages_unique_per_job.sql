-- ============================================================================
-- Fix sent_messages uniqueness scope to prevent cross-job overwrites
-- ============================================================================
-- Problem:
--   UNIQUE(phone_e164, guide_number) causes upsert collisions across jobs/users.
-- Solution:
--   Scope uniqueness per job using (job_id, phone_e164, guide_number).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sent_messages_phone_e164_guide_number_key'
      AND conrelid = 'public.sent_messages'::regclass
  ) THEN
    ALTER TABLE public.sent_messages
      DROP CONSTRAINT sent_messages_phone_e164_guide_number_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sent_messages_job_phone_guide_key'
      AND conrelid = 'public.sent_messages'::regclass
  ) THEN
    ALTER TABLE public.sent_messages
      ADD CONSTRAINT sent_messages_job_phone_guide_key
      UNIQUE (job_id, phone_e164, guide_number);
  END IF;
END $$;

-- Keep lookup performance for duplicate checks by phone/guide across history.
CREATE INDEX IF NOT EXISTS idx_sent_messages_phone_guide
  ON public.sent_messages (phone_e164, guide_number);

