/**
 * Códigos de error de WhatsApp Cloud API → mensaje amigable para guardar en BD y mostrar al usuario.
 * Ver: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const WHATSAPP_ERROR_MESSAGES: Record<string, string> = {
  "100": "Credenciales de WhatsApp inválidas. Contacte al administrador.",
  "131026": "Demasiados mensajes. Espere un momento antes de reintentar.",
  "131031": "Número de teléfono no válido.",
  "131032": "El número no tiene WhatsApp.",
  "131047": "Fuera de la ventana de 24 horas. El usuario debe escribir primero.",
  "131048": "Plantilla rechazada o no aprobada.",
  "131051": "Parámetro de plantilla inválido.",
  "132000": "Número de teléfono inválido.",
  "132005": "Número no registrado en WhatsApp.",
  "132068": "Mensaje duplicado o ya enviado recientemente.",
  "133016": "Límite de tasa excedido. Espere antes de reintentar.",
  "NETWORK_ERROR": "Error de red al contactar WhatsApp. Reintente más tarde.",
  "PARSE_ERROR": "Respuesta inválida del servidor de WhatsApp.",
  "UNKNOWN": "Error desconocido de WhatsApp.",
};

export function getWhatsAppFriendlyMessage(
  errorCode: string,
  rawMessage: string | undefined
): string {
  const friendly = WHATSAPP_ERROR_MESSAGES[errorCode];
  if (friendly) return friendly;
  return rawMessage || "Error al enviar el mensaje.";
}
