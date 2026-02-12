# 🔐 CONFIGURACIÓN DE VARIABLES DE ENTORNO

## ⚠️ IMPORTANTE - LEE ESTO PRIMERO

**NUNCA** incluyas credenciales reales en archivos que se suban a Git.

---

## 📝 Template para .env

Crea un archivo `.env` en la raíz del proyecto con este contenido:

```env
# ============================================================================
# WHATSAPP SENDER PRO - VARIABLES DE ENTORNO
# ============================================================================

# SUPABASE CONFIGURATION
# Obtén estos valores en: https://supabase.com/dashboard/project/_/settings/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY_HERE

# API KEY DE SEGURIDAD
# Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
VITE_API_KEY=YOUR_RANDOM_API_KEY_HERE
```

---

## 🔑 Cómo Obtener las Credenciales

### 1. **Supabase URL y Anon Key**

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Settings → API
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 2. **API Key**

Genera una API Key segura:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Ejemplo de salida: `a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2`

---

## 🚀 Configuración en Diferentes Entornos

### **Desarrollo Local**

1. Crea archivo `.env` en la raíz
2. Copia el template de arriba
3. Reemplaza los valores con tus credenciales
4. Verifica que `.env` está en `.gitignore`

### **Producción (Vercel)**

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega cada variable:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_API_KEY`
4. Selecciona: Production, Preview, Development
5. Redesplega

### **Supabase Edge Functions**

Estas variables van como **Secrets** (no como variables de entorno):

```bash
# API Key (debe coincidir con VITE_API_KEY)
supabase secrets set API_KEY="tu_api_key_aqui"

# WhatsApp Business API
supabase secrets set WA_TOKEN="tu_whatsapp_token"
supabase secrets set WA_PHONE_NUMBER_ID="tu_phone_id"
supabase secrets set WA_TEMPLATE_NAME="servientrega_tracking_notification"
supabase secrets set WA_TEMPLATE_LANG="es_CO"
supabase secrets set SENDER_NAME="Import Corporal Medical"
```

---

## 🔒 Seguridad de Credenciales

### ✅ Buenas Prácticas

- ✅ Archivo `.env` en `.gitignore`
- ✅ Usar `.env.example` con placeholders
- ✅ Rotar API Keys mensualmente
- ✅ Diferentes credenciales por entorno
- ✅ No compartir credenciales por email/chat

### ❌ Nunca Hacer

- ❌ Subir `.env` a Git
- ❌ Hardcodear credenciales en código
- ❌ Compartir credenciales en documentación
- ❌ Usar credenciales de producción en desarrollo
- ❌ Commitear archivos con API Keys

---

## 🚨 Si Expusiste Credenciales

### **Acción Inmediata:**

1. **Rotar todas las credenciales**
2. **Revisar logs de Supabase** por actividad sospechosa
3. **Cambiar API Key:**
   ```bash
   # Generar nueva
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   
   # Actualizar en Supabase
   supabase secrets set API_KEY="NUEVA_KEY"
   
   # Actualizar .env local
   # VITE_API_KEY=NUEVA_KEY
   
   # Redesplegar Edge Functions
   supabase functions deploy enqueue-messages
   supabase functions deploy process-message-queue
   ```

4. **Cambiar proyecto de Supabase (caso extremo):**
   - Si el Service Role Key fue expuesto
   - Crear nuevo proyecto
   - Migrar datos

---

## 📋 Checklist de Verificación

Antes de hacer commit:

- [ ] `.env` está en `.gitignore`
- [ ] No hay credenciales hardcodeadas en código
- [ ] Documentación usa placeholders, no valores reales
- [ ] API Keys rotadas si fueron expuestas
- [ ] `git status` NO muestra `.env`
- [ ] Búsqueda global de API Keys no encuentra nada

```bash
# Verificar que .env no está en staging
git status | grep ".env"

# Buscar posibles credenciales hardcodeadas
git grep "lrknetzftkezvqmcincb" || echo "✅ OK"
git grep "02F5yhscLpWezI" || echo "✅ OK"
```

---

## 🔄 Rotación de Credenciales

### Cuándo Rotar

- ✅ Mensualmente (buena práctica)
- ✅ Si se comprometen
- ✅ Después de exposición accidental
- ✅ Cambio de personal con acceso
- ✅ Incidente de seguridad

### Proceso de Rotación

1. Generar nuevas credenciales
2. Actualizar en Supabase Secrets
3. Actualizar en Vercel
4. Actualizar .env local
5. Redesplegar todo
6. Verificar funcionamiento
7. Documentar fecha de rotación

---

## 📞 Soporte

Si tienes dudas sobre configuración:
1. Revisa este documento completo
2. Verifica logs de error
3. Consulta documentación de Supabase

---

**RECUERDA:** Las credenciales son como contraseñas. Trátalas con el mismo nivel de seguridad.

