# WA Notify - Sistema de Notificaciones WhatsApp

Sistema de notificaciones automáticas por WhatsApp para envíos de Servientrega.

## 🚀 Características

- 📤 Envío masivo de notificaciones WhatsApp
- 📊 Carga de archivos Excel con datos de envíos
- 📱 Integración con WhatsApp Business API
- ✉️ Envío opcional de la guía y el enlace de rastreo por correo mediante SMTP
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
- Una cuenta de correo SMTP (Hostinger para la configuración predeterminada)

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

# Aplicar migraciones de BD antes de desplegar las funciones
supabase db push

# Desplegar Edge Functions
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue
```

Para habilitar correos, el Excel debe incluir una columna opcional llamada `Correo` o `Email`. La dirección se valida en la previsualización y el usuario puede desactivar ese canal antes de enviar.

## 🔐 Seguridad

Este proyecto implementa:
- ✅ Autenticación JWT obligatoria
- ✅ Row Level Security (RLS) en base de datos
- ✅ Validación de ownership de recursos
- ✅ Aislamiento de datos por usuario

Ver `RLS_SECURITY_OVERVIEW.md` para más detalles.

## 👥 Roles y Permisos

- **Usuario estándar**: Solo puede acceder a sus propios jobs y mensajes
- **Administrador**: Acceso completo a todos los recursos del sistema

Ver `ADMIN_ROLES.md` para configuración de roles de administrador.

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

## 🔥 Pruebas de Estrés

Para validar capacidad de envío y throughput de cola:

```bash
npm run stress:test
```

Ver `STRESS_TESTING.md` para configuración y variables requeridas.

## 📝 Licencia

Privado - Todos los derechos reservados

## 👥 Contribución

Este es un proyecto privado. Para contribuir contacta al equipo de desarrollo.

---

**Desarrollado para optimizar las notificaciones de envíos de Servientrega** 📦✨
