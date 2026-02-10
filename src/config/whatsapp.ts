// Archivo conservado para evitar conflictos de merge históricos.
// No se manejan credenciales en frontend; se usan secrets en Supabase Edge Functions.
export const WHATSAPP_FRONTEND_CONFIG = {
  useSupabaseSecrets: true,
} as const;
