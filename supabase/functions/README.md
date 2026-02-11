# Edge Functions - WA Notify

Este directorio contiene las Edge Functions de Supabase para el procesamiento de mensajes de WhatsApp.

## 📁 Estructura

```
functions/
├── enqueue-messages/       # Encolar mensajes para procesamiento
│   └── index.ts
├── process-message-queue/  # Procesar cola con rate limiting
│   └── index.ts
├── _shared/                # Utilidades compartidas
│   ├── api-key-validator.ts
│   └── carrier-utils.ts
├── deno.json              # Configuración de Deno
└── import_map.json        # Import map para dependencias
```

## 🚀 Edge Functions

### 1. `enqueue-messages` (NUEVO)

**Propósito**: Encolar mensajes para procesamiento asíncrono con rate limiting

**Features**:
- ✅ Validación de permisos de usuario
- ✅ Encolado con prioridades
- ✅ Prevención de duplicados
- ✅ Opción de auto-procesamiento

**Endpoint**: `/functions/v1/enqueue-messages`

**Autenticación**: JWT token requerido

### 2. `process-message-queue` (NUEVO)

**Propósito**: Procesar lotes de mensajes de la cola con rate limiting inteligente

**Features**:
- ✅ Rate limiting respetando límites de WhatsApp
- ✅ Procesamiento por lotes
- ✅ Reintentos automáticos con backoff exponencial
- ✅ Circuit breaker para protección
- ✅ Actualización de estadísticas en tiempo real

**Endpoint**: `/functions/v1/process-message-queue`

**Autenticación**: JWT token requerido


## 🔧 Variables de Entorno

Todas las funciones requieren:

```bash
# Supabase (auto-provisioned)
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# WhatsApp Business API
WA_TOKEN=your_whatsapp_business_token
WA_PHONE_NUMBER_ID=your_phone_number_id

# Configuración opcional
WA_TEMPLATE_NAME=shipment_notification
WA_TEMPLATE_LANG=es_CO
WA_GRAPH_VERSION=v19.0
SENDER_NAME="Import Corporal Medical"
```

## 📦 Despliegue

### Desplegar todas las funciones

```bash
# Desplegar todas
supabase functions deploy

# O individualmente
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue
```

### Configurar secretos

```bash
# Via CLI
supabase secrets set WA_TOKEN="your_token"
supabase secrets set WA_PHONE_NUMBER_ID="your_phone_id"

# O via Dashboard
# Settings > Edge Functions > Secrets
```

### Verificar despliegue

```bash
supabase functions list
```

## 🧪 Testing

### Test local con Deno

```bash
# Instalar Deno si no lo tienes
curl -fsSL https://deno.land/install.sh | sh

# Ejecutar función localmente
cd supabase/functions/enqueue-messages
deno run --allow-net --allow-env index.ts
```

### Test con Supabase CLI

```bash
# Iniciar funciones localmente
supabase functions serve

# En otra terminal, hacer request
curl -i --location --request POST 'http://localhost:54321/functions/v1/enqueue-messages' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"jobId":"test","rows":[]}'
```

### Test en producción

```bash
# Usar el script de test
./test-functions.sh
```

## 📊 Monitoreo

### Ver logs en tiempo real

```bash
# Via CLI
supabase functions logs enqueue-messages --tail
supabase functions logs process-message-queue --tail

# O via Dashboard
# Edge Functions > [function name] > Logs
```

### Métricas importantes

- **Invocaciones por minuto**: Dashboard de Supabase
- **Duración promedio**: Logs de función
- **Tasa de error**: Filtrar logs por "error"

## 🔍 Debugging

### Errores comunes

#### "Missing authorization header"
- **Causa**: No se está enviando el token JWT
- **Solución**: Incluir `Authorization: Bearer <token>` en headers

#### "Job not found or access denied"
- **Causa**: Usuario no es owner del job
- **Solución**: Verificar que el job pertenezca al usuario autenticado

#### "WhatsApp credentials not configured"
- **Causa**: Variables `WA_TOKEN` o `WA_PHONE_NUMBER_ID` no están configuradas
- **Solución**: Configurar secretos en Supabase

#### Rate limit de WhatsApp
- **Causa**: Excediendo límites de la API
- **Solución**: Ajustar `rate_limit_config` en la BD

### Logs útiles

```bash
# Ver últimos 100 logs
supabase functions logs process-message-queue --limit 100

# Filtrar por errores
supabase functions logs process-message-queue | grep -i error

# Ver logs de un periodo específico
supabase functions logs process-message-queue --since "2026-02-11 10:00:00"
```

## 🏗️ Desarrollo

### Agregar nueva función

```bash
# Crear nueva función
supabase functions new my-function

# Estructura básica generada
functions/
└── my-function/
    └── index.ts
```

### Dependencias

Las funciones usan Deno, que maneja imports via URLs:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```

### CORS

Todas las funciones incluyen CORS headers:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

## 📚 Referencias

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)

## 🔄 Changelog

### 2026-02-11 - Sistema de Rate Limiting

- ✨ Nueva función: `enqueue-messages`
- ✨ Nueva función: `process-message-queue`
- 🗑️ Función `send-whatsapp` eliminada (reemplazada por sistema de cola)
- 📝 Documentación completa agregada

---

**Desarrollado para WA Notify** 🚀

