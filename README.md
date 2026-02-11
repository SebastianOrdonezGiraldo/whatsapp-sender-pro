# WA Notify - Sistema de Notificaciones WhatsApp

Sistema de notificaciones automáticas por WhatsApp para envíos de Servientrega.

## 🚀 Características

- 📤 Envío masivo de notificaciones WhatsApp
- 📊 Carga de archivos Excel con datos de envíos
- 📱 Integración con WhatsApp Business API
- 🔐 Autenticación de usuarios con Supabase
- 📈 Historial de envíos y estadísticas
- 🛡️ Seguridad RLS a nivel de base de datos
- ⏱️ **Rate Limiting Avanzado** con cola de mensajes
- 🔄 **Reintentos Automáticos** con backoff exponencial
- 📊 **Monitoreo en Tiempo Real** del estado de envíos

## 🛠️ Tecnologías

- **Frontend**: React + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Auth**: Supabase Auth
- **WhatsApp**: Meta WhatsApp Business API

## 📋 Requisitos

- Node.js 18+
- Cuenta de Supabase
- WhatsApp Business API credentials

## 🔧 Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd whatsapp-sender-pro

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev
```

## 📦 Despliegue

```bash
# Build de producción
npm run build

# Desplegar Edge Functions
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue

# Aplicar migraciones de BD
supabase db push
```

## 🔐 Seguridad

Este proyecto implementa:
- ✅ Autenticación JWT obligatoria
- ✅ Row Level Security (RLS) en base de datos
- ✅ Validación de ownership de recursos
- ✅ Aislamiento de datos por usuario

Ver `RLS_SECURITY_OVERVIEW.md` para más detalles.

## 📚 Documentación

- `AUTH_SYSTEM_IMPLEMENTED.md` - Sistema de autenticación
- `EXCEL_PARSER_GUIDE.md` - Guía del parser de Excel
- `RLS_SECURITY_FIX.md` - Seguridad implementada
- `DEPLOYMENT_GUIDE_RLS.md` - Guía de despliegue
- **`RATE_LIMITING_SUMMARY.md`** - Sistema de rate limiting avanzado

## 🧪 Tests

```bash
npm test
```

## 📝 Licencia

Privado - Todos los derechos reservados

## 👥 Contribución

Este es un proyecto privado. Para contribuir contacta al equipo de desarrollo.

---

**Desarrollado para optimizar las notificaciones de envíos de Servientrega** 📦✨
