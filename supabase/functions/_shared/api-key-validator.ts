// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file

/**
 * API Key Validator for Edge Functions
 * 
 * Valida que todos los requests tengan una API Key válida
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-client-version, x-request-time",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  "Access-Control-Max-Age": "86400",
};

/**
 * Valida la API Key del request
 * 
 * @param req - Request object
 * @returns true si la API Key es válida, Response de error si no
 */
export function validateApiKey(req: Request): true | Response {
  // Get expected API key from environment
  const expectedApiKey = Deno.env.get("API_KEY");
  
  if (!expectedApiKey) {
    console.error("⚠️ API_KEY no configurada en variables de entorno de Supabase");
    return new Response(
      JSON.stringify({ 
        error: "API Key validation not configured",
        message: "El servidor no está configurado correctamente. Contacte al administrador."
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Get API key from request header
  const requestApiKey = req.headers.get("X-API-Key");

  if (!requestApiKey) {
    console.warn("❌ Request sin API Key");
    return new Response(
      JSON.stringify({ 
        error: "Missing API Key",
        message: "Acceso denegado. Se requiere autenticación."
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Validate API key
  if (requestApiKey !== expectedApiKey) {
    console.warn("❌ API Key inválida:", requestApiKey.substring(0, 10) + "...");
    return new Response(
      JSON.stringify({ 
        error: "Invalid API Key",
        message: "Acceso denegado. API Key inválida."
      }),
      { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // API Key válida
  console.log("✅ API Key válida");
  return true;
}

/**
 * Maneja requests OPTIONS para CORS
 */
export function handleCorsOptions(): Response {
  return new Response(null, { headers: corsHeaders });
}

export { corsHeaders };

