-- =====================================================
-- SCRIPT DE CORRECCIÓN RÁPIDA
-- Ejecuta esto en el SQL Editor de Supabase Dashboard
-- =====================================================

-- 1. Asegurar que la columna user_id existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_jobs_user_id ON public.jobs(user_id);
    RAISE NOTICE 'Columna user_id agregada exitosamente';
  ELSE
    RAISE NOTICE 'Columna user_id ya existe';
  END IF;
END $$;

-- 2. Habilitar RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 3. Eliminar políticas antiguas
DROP POLICY IF EXISTS "Allow all access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete their own jobs" ON public.jobs;

-- 4. Crear políticas RLS correctas
CREATE POLICY "Users can view their own jobs"
  ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own jobs"
  ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE '✅ Corrección completada exitosamente';
  RAISE NOTICE 'La tabla jobs ahora tiene la columna user_id y las políticas RLS correctas';
END $$;

