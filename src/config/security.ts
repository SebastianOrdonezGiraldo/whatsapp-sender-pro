/**
 * Security Configuration
 * 
 * Configuración de seguridad de la aplicación
 */

/**
 * API Key para autenticar requests a Edge Functions
 * 
 * IMPORTANTE:
 * - Esta clave debe mantenerse SECRETA
 * - No compartir en repositorios públicos
 * - Rotar cada mes o si se compromete
 * - Usar variables de entorno (.env)
 */
export const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_API_KEY;
  
  if (!apiKey) {
    console.error('⚠️ VITE_API_KEY no está configurada en .env');
    throw new Error('API Key no configurada. Contacte al administrador.');
  }
  
  return apiKey;
};

/**
 * Headers de seguridad para requests
 */
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'X-API-Key': getApiKey(),
    'X-Client-Version': '1.0.0',
    'X-Request-Time': new Date().toISOString(),
  };
};

export default {
  getApiKey,
  getSecurityHeaders,
};

