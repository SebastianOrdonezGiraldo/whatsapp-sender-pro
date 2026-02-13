// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * API Key and JWT Validator for Edge Functions
 * 
 * Proporciona doble capa de seguridad:
 * 1. API Key - Evita llamadas desde fuera de la aplicación
 * 2. JWT - Valida que el usuario esté autenticado
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
 * Valida el JWT token y devuelve el usuario autenticado
 * 
 * @param req - Request object
 * @returns Usuario autenticado o Response de error
 */
export async function validateJWT(req: Request): Promise<{ user: any } | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  // Get authorization header
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader) {
    console.warn("❌ Request sin Authorization header");
    return new Response(
      JSON.stringify({ 
        error: "Missing authorization",
        message: "Se requiere autenticación. Por favor inicia sesión."
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  // Verify user
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.warn("❌ JWT inválido o expirado:", authError?.message);
    return new Response(
      JSON.stringify({ 
        error: "Invalid or expired token",
        message: "Tu sesión ha expirado. Por favor inicia sesión nuevamente."
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  console.log("✅ Usuario autenticado:", user.email);
  return { user };
}

/**
 * Valida que el usuario sea dueño de un job
 * 
 * @param jobId - ID del job
 * @param userId - ID del usuario
 * @returns true si el usuario es dueño, Response de error si no
 */
export async function validateJobOwnership(jobId: string, userId: string): Promise<true | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check if user is admin via app_metadata (secure - only modifiable server-side)
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  
  if (!userError && user?.app_metadata?.role === 'admin') {
    console.log("✅ Admin user authorized for job access");
    return true;
  }

  // Non-admin: validate job ownership
  const { data: job, error } = await supabase
    .from("jobs")
    .select("user_id")
    .eq("id", jobId)
    .single();

  if (error || !job) {
    console.warn("❌ Job no encontrado:", jobId);
    return new Response(
      JSON.stringify({ 
        error: "Job not found",
        message: "El trabajo solicitado no existe."
      }),
      { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  if (job.user_id !== userId) {
    console.warn("❌ Usuario no autorizado para job:", jobId, "Usuario:", userId);
    return new Response(
      JSON.stringify({ 
        error: "Forbidden",
        message: "No tienes permiso para acceder a este trabajo."
      }),
      { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  console.log("✅ Usuario autorizado para job:", jobId);
  return true;
}

/**
 * Maneja requests OPTIONS para CORS
 */
export function handleCorsOptions(): Response {
  return new Response(null, { headers: corsHeaders });
}

export { corsHeaders };

