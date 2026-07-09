-- ============================================================================
-- Add warehouse_staff table and link it to jobs
-- ============================================================================

-- 1. Create warehouse_staff table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.warehouse_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on name
ALTER TABLE public.warehouse_staff ADD CONSTRAINT warehouse_staff_name_key UNIQUE (name);

-- Index for active staff lookups
CREATE INDEX IF NOT EXISTS idx_warehouse_staff_active ON public.warehouse_staff(is_active);

-- Comments
COMMENT ON TABLE public.warehouse_staff IS 'Warehouse staff who can be assigned to jobs for traceability';
COMMENT ON COLUMN public.warehouse_staff.name IS 'Display name of the staff member';
COMMENT ON COLUMN public.warehouse_staff.is_active IS 'If false, hidden from selection dropdowns';
COMMENT ON COLUMN public.warehouse_staff.user_id IS 'Optional link to auth.users for auto-selection on login';

-- 2. Add assigned_to_id FK to jobs table
-- ============================================================================
-- We keep assigned_to (TEXT) as a denormalized display name for historical
-- preservation even if the staff member is later deactivated or deleted.

ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES public.warehouse_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to_id ON public.jobs(assigned_to_id);

COMMENT ON COLUMN public.jobs.assigned_to_id IS 'FK to warehouse_staff – who physically created this job';

-- 3. RLS Policies for warehouse_staff
-- ============================================================================

ALTER TABLE public.warehouse_staff ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active staff
CREATE POLICY "Authenticated users can view warehouse staff"
  ON public.warehouse_staff
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert warehouse staff"
  ON public.warehouse_staff
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can update warehouse staff"
  ON public.warehouse_staff
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can delete warehouse staff"
  ON public.warehouse_staff
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 4. Seed initial staff (idempotent – uses ON CONFLICT DO NOTHING)
-- ============================================================================

INSERT INTO public.warehouse_staff (name) VALUES
  ('Maria Paula'),
  ('Daniel'),
  ('Juan'),
  ('Miguel')
ON CONFLICT (name) DO NOTHING;
