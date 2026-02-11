/**
 * Application Limits Configuration
 * 
 * Límites del sistema para evitar saturación y garantizar rendimiento óptimo
 */

export const LIMITS = {
  /**
   * Máximo número de registros permitidos por archivo Excel
   * 
   * Razones para el límite:
   * - Evita saturación del sistema de envío
   * - Garantiza tiempos de respuesta rápidos
   * - Facilita el seguimiento y debugging
   * - Cumple con rate limits de WhatsApp API
   * 
   * Si necesitas enviar más mensajes:
   * 1. Divide el Excel en múltiples archivos
   * 2. Sube cada archivo por separado
   * 3. Monitorea cada lote en el Historial
   */
  MAX_ROWS_PER_FILE: 150,

  /**
   * Tamaño máximo de archivo en MB (validación futura)
   */
  MAX_FILE_SIZE_MB: 5,

  /**
   * Máximo número de reintentos para mensajes fallidos
   */
  MAX_RETRIES: 3,
} as const;

export default LIMITS;

