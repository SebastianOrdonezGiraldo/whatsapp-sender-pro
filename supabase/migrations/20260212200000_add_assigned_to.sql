-- Add assigned_to column to jobs table
-- This tracks who from the warehouse team created each job

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS assigned_to TEXT;

-- Add comment
COMMENT ON COLUMN public.jobs.assigned_to IS 'Nombre del encargado de bodega que realizó el envío';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON public.jobs(assigned_to);

-- Update existing records with default value (optional)
-- UPDATE public.jobs SET assigned_to = 'Sin asignar' WHERE assigned_to IS NULL;

