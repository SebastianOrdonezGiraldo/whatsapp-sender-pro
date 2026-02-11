# 🚀 Guía de Deployment - WhatsApp Sender Pro

## Opción 1: Vercel (RECOMENDADO) ⭐

### Método A: Desde la Web (Más fácil)

1. **Sube tu código a GitHub** (si no lo has hecho):
   ```bash
   git add .
   git commit -m "Preparado para deployment en Vercel"
   git push origin main
   ```

2. **Ve a Vercel**:
   - Visita: https://vercel.com
   - Haz clic en "Sign Up" o "Login"
   - Usa tu cuenta de GitHub

3. **Importa tu proyecto**:
   - Haz clic en "Add New Project"
   - Selecciona tu repositorio `whatsapp-sender-pro`
   - Vercel detectará automáticamente que es Vite

4. **Configura las variables de entorno**:
   En la sección "Environment Variables", agrega:
   ```
   VITE_SUPABASE_URL=https://lrknetzftkezvqmcincb.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxya25ldHpmdGtlenZxbWNpbmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzUxMDYsImV4cCI6MjA4NjQxMTEwNn0.B1lWoOi9IaUreOl9GCXtYpxP4thEGK17zg0Zu88XEq0
   ```

5. **Deploy**:
   - Haz clic en "Deploy"
   - ¡Listo! En 2-3 minutos tu app estará en línea

### Método B: Desde CLI

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Configurar variables de entorno
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY

# 5. Deploy a producción
vercel --prod
```

---

## Opción 2: Netlify

### Desde la Web:

1. **Ve a Netlify**: https://netlify.com
2. **Sign up** con GitHub
3. **"Add new site" → "Import from Git"**
4. Selecciona tu repositorio
5. **Build settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. **Environment variables**:
   ```
   VITE_SUPABASE_URL=https://lrknetzftkezvqmcincb.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxya25ldHpmdGtlenZxbWNpbmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzUxMDYsImV4cCI6MjA4NjQxMTEwNn0.B1lWoOi9IaUreOl9GCXtYpxP4thEGK17zg0Zu88XEq0
   ```
7. **Deploy site**

### Desde CLI:

```bash
# 1. Instalar Netlify CLI
npm install -g netlify-cli

# 2. Login
netlify login

# 3. Inicializar
netlify init

# 4. Deploy
netlify deploy --prod
```

---

## Opción 3: Cloudflare Pages

1. **Ve a**: https://pages.cloudflare.com
2. **Sign up/Login**
3. **Create a project**
4. **Connect to Git** → Selecciona tu repositorio
5. **Build settings**:
   - Build command: `npm run build`
   - Build output directory: `dist`
6. **Environment variables**: Agrega las mismas variables de Supabase
7. **Save and Deploy**

---

## 🔒 Configurar Dominio Personalizado (Opcional)

Una vez deployado, puedes agregar tu propio dominio:

### En Vercel:
1. Ve a tu proyecto → Settings → Domains
2. Agrega tu dominio
3. Configura los DNS según las instrucciones

### En Netlify:
1. Site settings → Domain management → Add custom domain

### En Cloudflare Pages:
1. Tu proyecto → Custom domains → Set up a custom domain

---

## 📝 Notas Importantes

### Variables de Entorno
**NUNCA** subas al repositorio:
- ❌ Service Role Key
- ❌ Access Tokens privados
- ❌ Contraseñas

**SÍ puedes subir** (son públicas):
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)

### Deploy Automático
Una vez configurado, cada `git push` a la rama `main` deployará automáticamente.

```bash
# Workflow típico:
git add .
git commit -m "Nuevas funcionalidades"
git push origin main
# ⏳ Vercel/Netlify/Cloudflare automáticamente hace build y deploy
```

---

## 🆘 Solución de Problemas

### Build falla
```bash
# Prueba el build localmente primero:
npm run build

# Si falla, revisa:
# - Que no haya errores en el código
# - Que las dependencias estén instaladas
# - Que las variables de entorno estén configuradas
```

### App no carga
1. Verifica que las variables de entorno estén configuradas
2. Revisa los logs en el dashboard del hosting
3. Verifica que `.env.local` NO esté en `.gitignore`

### Routing no funciona (404 en páginas)
Ya está solucionado con `vercel.json` que creamos.

---

## 🎯 Comparación Rápida

| Característica | Vercel | Netlify | Cloudflare |
|---------------|--------|---------|------------|
| Precio | ✅ Gratis | ✅ Gratis | ✅ Gratis |
| Deploy automático | ✅ | ✅ | ✅ |
| SSL gratis | ✅ | ✅ | ✅ |
| CDN global | ✅ | ✅ | ✅ Mejor |
| Fácil de usar | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Builds ilimitados | ✅ | ✅ | ✅ |
| Dominio gratis | ✅ | ✅ | ✅ |

---

## 🚀 Siguiente Paso

**Recomendación**: Empieza con Vercel por su simplicidad.

1. Sube los cambios a GitHub
2. Ve a vercel.com y conecta tu repo
3. ¡En 5 minutos tu app estará en línea!

**Tu dominio será**: `whatsapp-sender-pro.vercel.app` (o el nombre que elijas)

