-- Add carrier support to track different shipping companies
-- Each carrier has its own WhatsApp template and tracking URL

-- Add carrier column to sent_messages
ALTER TABLE public.sent_messages 
ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Add carrier column to message_queue
ALTER TABLE public.message_queue 
ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Add tracking_url column for convenience
ALTER TABLE public.sent_messages 
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

ALTER TABLE public.message_queue 
ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- Create index for carrier queries
CREATE INDEX IF NOT EXISTS idx_sent_messages_carrier ON public.sent_messages(carrier);
CREATE INDEX IF NOT EXISTS idx_message_queue_carrier ON public.message_queue(carrier);

-- Add comments
COMMENT ON COLUMN public.sent_messages.carrier IS 'Shipping carrier: servientrega, envia, or deprisa';
COMMENT ON COLUMN public.sent_messages.tracking_url IS 'Full tracking URL for this shipment';
COMMENT ON COLUMN public.message_queue.carrier IS 'Shipping carrier: servientrega, envia, or deprisa';
COMMENT ON COLUMN public.message_queue.tracking_url IS 'Full tracking URL for this shipment';

-- Update existing records with default carrier (optional, can be NULL)
-- UPDATE public.sent_messages SET carrier = 'servientrega' WHERE carrier IS NULL;
-- UPDATE public.message_queue SET carrier = 'servientrega' WHERE carrier IS NULL;

