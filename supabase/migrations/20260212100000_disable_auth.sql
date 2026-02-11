-- Disable authentication and RLS for public access
-- Make the app work without login

-- Drop all RLS policies
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

-- Disable RLS
ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue DISABLE ROW LEVEL SECURITY;

-- Make user_id nullable (optional)
ALTER TABLE public.jobs ALTER COLUMN user_id DROP NOT NULL;

-- Create simple public access policies (allow all)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;

-- Allow all operations without authentication
CREATE POLICY "Allow all access to jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to sent_messages" ON public.sent_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to message_queue" ON public.message_queue FOR ALL USING (true) WITH CHECK (true);

-- Update comments
COMMENT ON TABLE public.jobs IS 'Jobs table - public access (no authentication required)';
COMMENT ON TABLE public.sent_messages IS 'Sent messages - public access';
COMMENT ON TABLE public.message_queue IS 'Message queue - public access';

