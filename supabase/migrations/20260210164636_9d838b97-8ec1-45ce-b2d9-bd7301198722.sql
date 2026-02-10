
-- Jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  invalid_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  sent_ok INTEGER NOT NULL DEFAULT 0,
  sent_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sent messages table
CREATE TABLE public.sent_messages (
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

-- No RLS since this is an internal tool without user auth
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;

-- Public access policies (internal tool)
CREATE POLICY "Allow all access to jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sent_messages" ON public.sent_messages FOR ALL USING (true) WITH CHECK (true);
