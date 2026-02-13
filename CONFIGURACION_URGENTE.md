# 🚨 CONFIGURACIÓN URGENTE - Solución Error 401

## ❌ Problema Identificado

El error **"Acceso denegado. Por favor, contacte al administrador (401)"** ocurre porque **faltan las variables de entorno** necesarias para autenticar las llamadas a Supabase.

---

## ✅ SOLUCIÓN PASO A PASO

### Paso 1: Obtener tu Supabase Anon Key

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard/project/lrknetzftkezvqmcincb
2. Navega a: **Settings** → **API**
3. Copia el valor de **`anon public`** (es una clave JWT larga que empieza con `eyJ...`)

### Paso 2: Editar el archivo `.env`

He creado el archivo `.env` en la raíz del proyecto. Ábrelo y reemplaza:

```env
VITE_SUPABASE_PUBLISHABLE_KEY=REEMPLAZAR_CON_TU_ANON_KEY
```

Por tu clave real, por ejemplo:

```env
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxya25ldHpmdGtlenZxbWNpbmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODEyMzQ1NjcsImV4cCI6MTk5NjgxMDU2N30.abc123...
```

### Paso 3: Configurar API_KEY en Supabase (CRÍTICO)

La variable `VITE_API_KEY` del archivo `.env` ya está configurada con el valor:
```
whatsapp-sender-pro-secret-key-2026
```

**DEBES configurar esta misma clave en Supabase:**

1. Ve a: https://supabase.com/dashboard/project/lrknetzftkezvqmcincb/settings/functions
2. En la sección **"Secrets"** (Variables de entorno), añade:
   - **Nombre:** `API_KEY`
   - **Valor:** `whatsapp-sender-pro-secret-key-2026`
3. Haz clic en **"Add secret"** o **"Save"**

### Paso 4: Verificar otras variables de Supabase

Mientras estés en la página de Secrets, verifica que también estén configuradas:

- ✅ `WA_TOKEN` - Token de WhatsApp Business API
- ✅ `WA_PHONE_NUMBER_ID` - ID del número de teléfono de WhatsApp
- ✅ `SUPABASE_URL` - Se auto-configura
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Se auto-configura
- ✅ `SUPABASE_ANON_KEY` - Se auto-configura

### Paso 5: Reiniciar el servidor de desarrollo

Después de configurar las variables:

```bash
# Detén el servidor actual (Ctrl+C)
# Luego reinicia:
npm run dev
```

---

## 🔐 Seguridad Mejorada (Opcional pero Recomendado)

Para mayor seguridad, cambia la `VITE_API_KEY` por una más robusta:

### En Windows PowerShell:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Esto generará algo como: `Xk7pL9mN5qR8tV2wY4zB6cD8eF0gH1iJ3kL5mN7oP9qR==`

Luego:
1. Reemplaza el valor en `.env`:
   ```env
   VITE_API_KEY=Xk7pL9mN5qR8tV2wY4zB6cD8eF0gH1iJ3kL5mN7oP9qR==
   ```

2. Actualiza el mismo valor en Supabase Secrets (`API_KEY`)

---

## 📋 Checklist de Verificación

Antes de probar nuevamente, verifica:

- [ ] Archivo `.env` creado en la raíz del proyecto
- [ ] `VITE_SUPABASE_URL` apunta a `https://lrknetzftkezvqmcincb.supabase.co`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` tiene tu Anon Key real de Supabase
- [ ] `VITE_API_KEY` está configurada (mínimo con la clave temporal)
- [ ] Variable `API_KEY` configurada en Supabase Secrets (debe ser igual a `VITE_API_KEY`)
- [ ] Servidor de desarrollo reiniciado (`npm run dev`)

---

## 🧪 Probar la Solución

1. Abre la aplicación en el navegador
2. Inicia sesión
3. Intenta enviar mensajes
4. ✅ Debería funcionar sin error 401

---

## 🆘 Si el Error Persiste

### Verificar en la consola del navegador:

```javascript
// Abre DevTools (F12) y ejecuta:
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('¿Tiene API Key?:', !!import.meta.env.VITE_API_KEY);
```

Si ves `undefined`, significa que el archivo `.env` no se cargó correctamente.

### Solución:
1. Asegúrate de que el archivo se llama exactamente `.env` (no `.env.txt`)
2. El archivo debe estar en la raíz del proyecto (mismo nivel que `package.json`)
3. Reinicia completamente el servidor

---

## 📞 Soporte

Si después de seguir estos pasos el error persiste:

1. Verifica los logs de Supabase Edge Functions:
   https://supabase.com/dashboard/project/lrknetzftkezvqmcincb/logs/edge-functions

2. Revisa que las políticas RLS estén activas en las tablas

3. Confirma que tu usuario tenga el rol correcto en `user_metadata`

---

**Creado:** 2026-02-13  
**Problema:** Error 401 al enviar mensajes  
**Causa:** Falta configuración de variables de entorno  
**Estado:** ✅ Solución implementada

