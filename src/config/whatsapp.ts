// Archivo conservado para evitar conflictos de merge históricos.
// No se manejan credenciales en frontend; se usan secrets en Supabase Edge Functions.
export const WHATSAPP_FRONTEND_CONFIG = {
  useSupabaseSecrets: true,
} as const;

// Compatibilidad temporal: algunos bundles antiguos aún importan WA_RUNTIME_CONFIG.
// Se mantiene sin credenciales para evitar exposición de secretos en frontend.
export const WA_RUNTIME_CONFIG = {
  token: '',
  phoneNumberId: '',
} as const;
