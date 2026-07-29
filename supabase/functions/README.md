# Edge Functions - WA Notify

Este directorio contiene las Edge Functions de Supabase para el procesamiento de mensajes de WhatsApp y correos transaccionales con la guía de envío.

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
- ✅ Continuación automática (self-chain) mientras quede trabajo
- ✅ Recuperación de mensajes atascados en PROCESSING
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
PROCESS_LOOP_MAX_RUNTIME_MS=25000
PROCESS_CONTINUE_MAX_DEPTH=50
PROCESSING_STALE_MS=300000

# SMTP Hostinger (guardar siempre como secretos de Supabase)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notificaciones@tu-dominio.com
SMTP_PASSWORD=your_mailbox_password
SMTP_FROM=notificaciones@tu-dominio.com
SMTP_FROM_NAME="Import Corporal Medical"
# SMTP_REPLY_TO=servicioalcliente@tu-dominio.com
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

```powershell
# Via CLI, usando un archivo local ignorado por Git para no dejar la clave SMTP
# en el historial de la terminal:
Copy-Item supabase/functions/.env.example supabase/functions/.env.local
# Edite .env.local con los valores reales y luego ejecute:
supabase secrets set --env-file supabase/functions/.env.local

# O via Dashboard
# Settings > Edge Functions > Secrets
```

Ejecute `supabase db push` antes de desplegar las funciones: la cola necesita las columnas de estado de correo agregadas por la migración `20260718000000_add_email_notifications.sql`.

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

