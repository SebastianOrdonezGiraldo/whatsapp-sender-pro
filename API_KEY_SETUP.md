# 🔐 Configuración de API Key - Guía Completa

## 📋 Resumen

Tu aplicación ahora está protegida con una **API Key secreta** que debe incluirse en todas las peticiones a las Edge Functions de Supabase.

---

## 🔑 API Key Generada

```
02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk
```

**⚠️ IMPORTANTE:**
- ✅ Esta clave ya está configurada en tu `.env` local
- ❌ **NO** compartir esta clave públicamente
- ❌ **NO** subirla a GitHub/repositorios públicos
- 🔄 Rotar cada mes o si se compromete

---

## ⚙️ Configuración Requerida

### **1. Frontend (.env local)** ✅ YA CONFIGURADO

El archivo `.env` en la raíz del proyecto debe tener:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://lrknetzftkezvqmcincb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_key_aqui

# API Key for security
VITE_API_KEY=02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk
```

### **2. Supabase Edge Functions** ⚠️ PENDIENTE

Debes configurar la API Key en Supabase:

```bash
supabase secrets set API_KEY="02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk"
```

**O desde el Dashboard de Supabase:**
1. Ve a: https://supabase.com/dashboard/project/lrknetzftkezvqmcincb/settings/functions
2. Sección "Secrets"
3. Agregar nueva secret:
   - **Nombre:** `API_KEY`
   - **Valor:** `02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk`
4. Guardar

### **3. Vercel (Producción)** ⚠️ CUANDO DESPLIEGUES

Si despliegas en Vercel, agrega la variable de entorno:

1. Ve al Dashboard de Vercel
2. Tu proyecto → Settings → Environment Variables
3. Agregar:
   - **Name:** `VITE_API_KEY`
   - **Value:** `02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk`
   - **Environments:** Production, Preview, Development
4. Redesplegar

---

## 🧪 Probar la Configuración

### **1. Configura la API Key en Supabase**

```bash
supabase secrets set API_KEY="02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk"
```

### **2. Despliega las funciones actualizadas**

```bash
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue
```

### **3. Reinicia el servidor local**

```bash
# Ctrl+C para detener el servidor actual
npm run dev
```

### **4. Prueba subir un archivo**

1. Ve a http://localhost:8080/
2. Sube un archivo Excel
3. Intenta enviar mensajes

**Resultado esperado:**
- ✅ Si la API Key está bien configurada → Funciona normalmente
- ❌ Si falta la API Key → Error: "Acceso denegado. Se requiere autenticación."
- ❌ Si la API Key es incorrecta → Error: "API Key inválida"

---

## 🔄 Cómo Rotar la API Key

### **Cuándo rotar:**
- Cada mes (buena práctica)
- Si sospechas que fue comprometida
- Si un empleado con acceso se va
- Después de un incidente de seguridad

### **Pasos para rotar:**

#### **1. Generar nueva API Key**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Ejemplo de salida:
```
xK9mP2vL7nQ8rT6wY4zA5bC3dE1fG0hJ2iK4lM6nO8p
```

#### **2. Actualizar .env local**

```env
VITE_API_KEY=xK9mP2vL7nQ8rT6wY4zA5bC3dE1fG0hJ2iK4lM6nO8p
```

#### **3. Actualizar en Supabase**

```bash
supabase secrets set API_KEY="xK9mP2vL7nQ8rT6wY4zA5bC3dE1fG0hJ2iK4lM6nO8p"
```

#### **4. Actualizar en Vercel (si aplica)**

Dashboard de Vercel → Environment Variables → Editar `VITE_API_KEY`

#### **5. Redesplegar todo**

```bash
# Funciones de Supabase
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue

# Frontend en Vercel (si está desplegado)
git push  # Vercel redespliega automáticamente
```

#### **6. Reiniciar servidor local**

```bash
npm run dev
```

---

## 🛡️ Niveles de Seguridad Implementados

### **✅ Protección Implementada**

| Aspecto | Estado | Descripción |
|---------|--------|-------------|
| **API Key Validation** | ✅ Activa | Todas las Edge Functions validan la API Key |
| **Headers Seguros** | ✅ Activos | X-API-Key, X-Client-Version, X-Request-Time |
| **Mensajes de Error** | ✅ Amigables | No revelan información sensible |
| **Variables de Entorno** | ✅ Protegidas | .env en .gitignore |
| **CORS** | ✅ Configurado | Headers de CORS apropiados |

### **⚠️ Seguridad Adicional Recomendada**

- 🔐 Habilitar autenticación con login
- 🌐 IP Whitelist (solo desde tu oficina)
- 📊 Logs de auditoría
- 🔄 Rotación automática de claves
- 🔒 Encriptación de datos sensibles

---

## 🚨 Solución de Problemas

### **Error: "API Key no configurada"**

**Causa:** La variable `VITE_API_KEY` no está en el `.env`

**Solución:**
```bash
echo "VITE_API_KEY=02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk" >> .env
npm run dev
```

### **Error: "Acceso denegado. Se requiere autenticación."**

**Causa:** La API Key no llegó al backend

**Solución:**
1. Verificar que `.env` tenga `VITE_API_KEY`
2. Reiniciar servidor (`npm run dev`)
3. Limpiar caché del navegador (Ctrl+Shift+R)

### **Error: "API Key inválida"**

**Causa:** La API Key en el frontend y backend no coinciden

**Solución:**
1. Verificar `.env` local
2. Verificar `supabase secrets list`
3. Asegurarse de que sean idénticas
4. Redesplegar funciones si cambiaste el secret

### **Error: "API Key validation not configured"**

**Causa:** No configuraste `API_KEY` en Supabase

**Solución:**
```bash
supabase secrets set API_KEY="02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk"
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue
```

---

## 📞 Contacto de Soporte

Si tienes problemas con la configuración:
1. Verifica este documento completo
2. Revisa los logs de Supabase
3. Contacta por WhatsApp: https://wa.link/70xv45

---

## 📝 Checklist de Configuración

- [ ] API Key agregada a `.env` local
- [ ] API Key configurada en Supabase (`supabase secrets set API_KEY=...`)
- [ ] Funciones desplegadas (`supabase functions deploy`)
- [ ] Servidor local reiniciado (`npm run dev`)
- [ ] Prueba realizada (subir archivo y enviar)
- [ ] API Key agregada a Vercel (si aplica)
- [ ] Documentar fecha de última rotación

---

**Última actualización:** $(Get-Date -Format "yyyy-MM-dd HH:mm")
**API Key Actual:** `02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk`
**Próxima Rotación Recomendada:** Un mes desde hoy


