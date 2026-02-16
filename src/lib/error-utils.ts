/**
 * Utilidades para normalizar y mostrar errores de Edge Functions y WhatsApp.
 */

/** Respuesta de error estándar de las Edge Functions */
export interface EdgeErrorBody {
  error?: string;
  message?: string;
  code?: string;
}

/**
 * Extrae el mensaje de error para mostrar al usuario desde la respuesta
 * de una Edge Function (Supabase invoke puede devolver error con context).
 */
export async function getEdgeErrorMessage(
  error: unknown,
  fallback = 'Ha ocurrido un error. Intente de nuevo.'
): Promise<string> {
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (msg.includes('API Key no configurada')) return 'Error de configuración. Contacte al administrador del sistema.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Error de conexión. Verifique su red e intente de nuevo.';
  }

  try {
    const err = error as { context?: Response };
    if (err?.context && typeof err.context?.json === 'function') {
      const body = (await err.context.json()) as EdgeErrorBody;
      return body?.message || body?.error || fallback;
    }
  } catch {
    // ignore parse error
  }

  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/**
 * Versión síncrona cuando ya se tiene el mensaje (ej. error.message sin context).
 */
export function getEdgeErrorMessageSync(error: unknown, fallback = 'Ha ocurrido un error.'): string {
  if (error instanceof Error && error.message) {
    const msg = error.message;
    if (msg.includes('API Key no configurada')) return 'Error de configuración. Contacte al administrador del sistema.';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Error de conexión. Verifique su red.';
    return msg;
  }
  return fallback;
}

/** Códigos de error conocidos de WhatsApp Cloud API → mensaje amigable en español */
export const WHATSAPP_ERROR_MESSAGES: Record<string, string> = {
  '100': 'Credenciales de WhatsApp inválidas. Contacte al administrador.',
  '131026': 'Demasiados mensajes. Espere un momento antes de reintentar.',
  '131031': 'Número de teléfono no válido.',
  '131032': 'El número no tiene WhatsApp.',
  '131047': 'Fuera de la ventana de 24 horas. El usuario debe escribir primero.',
  '131048': 'Plantilla rechazada o no aprobada.',
  '131051': 'Parámetro de plantilla inválido.',
  '132000': 'Número de teléfono inválido.',
  '132005': 'Número no registrado en WhatsApp.',
  '132068': 'Mensaje duplicado o ya enviado recientemente.',
  '133016': 'Límite de tasa excedido. Espere antes de reintentar.',
  'NETWORK_ERROR': 'Error de red al contactar WhatsApp. Reintente más tarde.',
  'UNKNOWN': 'Error desconocido de WhatsApp.',
};

/**
 * Devuelve un mensaje amigable para el usuario según error_code (y opcionalmente error_message).
 */
export function getWhatsAppFriendlyMessage(
  errorCode: string | null | undefined,
  errorMessage: string | null | undefined
): string {
  const code = (errorCode || '').toString().trim();
  const friendly = code ? WHATSAPP_ERROR_MESSAGES[code] : null;
  if (friendly) return friendly;
  if (errorMessage) return errorMessage;
  return 'Error al enviar el mensaje.';
}
