# 🚨 PLAN DE REMEDIACIÓN - CREDENCIALES EXPUESTAS

## 📋 RESUMEN

**Fecha de detección:** 2026-02-12  
**Severidad:** 🔴 **CRÍTICA**  
**Estado:** ⚠️ **ACCIÓN INMEDIATA REQUERIDA**

---

## ❌ CREDENCIALES QUE FUERON EXPUESTAS

Las siguientes credenciales estaban en archivos de documentación:

1. **API Key:** `02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk`
   - Archivos: `API_KEY_SETUP.md`
   - Riesgo: ALTO

2. **Supabase Project ID:** `lrknetzftkezvqmcincb`
   - Archivos: `supabase/config.toml`, `API_KEY_SETUP.md`
   - Riesgo: MEDIO (público de todas formas)

3. **Supabase URL:** `https://lrknetzftkezvqmcincb.supabase.co`
   - Archivos: Varios
   - Riesgo: BAJO (público en frontend)

---

## ⚠️ IMPACTO DE LA EXPOSICIÓN

### Si el repositorio ES PÚBLICO:

**🔴 RIESGO CRÍTICO:**
- Cualquiera puede usar tu API Key para llamar Edge Functions
- Posible uso no autorizado de tu cuenta de Supabase
- Consumo de recursos (quotas/billing)
- Acceso potencial a datos si JWT no está bien implementado

### Si el repositorio ES PRIVADO:

**🟡 RIESGO MEDIO:**
- Solo colaboradores del repo tienen acceso
- Aún así, es una mala práctica
- Riesgo si alguien con acceso comparte el código

---

## 🔧 ACCIONES CORRECTIVAS APLICADAS

### ✅ Paso 1: Archivos Limpiados (COMPLETADO)

| Archivo | Acción | Estado |
|---------|--------|--------|
| `API_KEY_SETUP.md` | Credenciales reemplazadas con placeholders | ✅ |
| `supabase/config.toml` | Project ID reemplazado | ✅ |
| `SECURITY_AUDIT_REPORT.md` | API Key redactada | ✅ |
| `ENV_SETUP_TEMPLATE.md` | Guía creada con placeholders | ✅ |

### ✅ Paso 2: .gitignore Verificado (COMPLETADO)

```
✅ .env está en .gitignore
✅ .env.local está en .gitignore
✅ *.local está en .gitignore
```

---

## 🚀 PASOS INMEDIATOS REQUERIDOS

### **Paso 1: Rotar API Key (URGENTE)**

```bash
# 1. Generar nueva API Key
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Ejemplo de salida: qZ3vK8mN2pT7wX5yB1cD4eF6gH9iJ0kL1mN2oP3qR4s
```

```bash
# 2. Actualizar en Supabase Secrets
supabase secrets set API_KEY="NUEVA_KEY_AQUI"

# 3. Actualizar .env local
# VITE_API_KEY=NUEVA_KEY_AQUI

# 4. Redesplegar Edge Functions
supabase functions deploy enqueue-messages
supabase functions deploy process-message-queue
```

### **Paso 2: Verificar Actividad Sospechosa**

1. **Revisar logs de Supabase:**
   - Ve a: https://supabase.com/dashboard/project/lrknetzftkezvqmcincb/logs
   - Busca llamadas inusuales a Edge Functions
   - Revisa horarios fuera de lo normal

2. **Verificar tabla de jobs:**
   ```sql
   -- Buscar jobs creados por usuarios desconocidos
   SELECT * FROM jobs 
   WHERE created_at > '2026-02-12'
   ORDER BY created_at DESC;
   ```

3. **Verificar autenticaciones:**
   ```sql
   -- En Supabase Dashboard → Authentication → Users
   -- Verificar que solo hay usuarios autorizados
   ```

### **Paso 3: Limpiar Historial de Git (SI NECESARIO)**

**⚠️ Solo si el repo ES PÚBLICO y tiene credenciales en historial:**

```bash
# OPCIÓN A: Borrar historial completo (más simple)
# 1. Hacer backup del código actual
cp -r . ../whatsapp-sender-pro-backup

# 2. Borrar historial
rm -rf .git

# 3. Inicializar nuevo repo
git init
git add .
git commit -m "Initial commit (credentials removed)"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main --force

# OPCIÓN B: Usar git-filter-repo (más complejo pero mejor)
# Requiere instalar: pip install git-filter-repo
git-filter-repo --invert-paths --path API_KEY_SETUP.md --force
```

### **Paso 4: Crear .env Local**

```bash
# Crear archivo .env con nuevas credenciales
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://lrknetzftkezvqmcincb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tu_anon_key_real
VITE_API_KEY=tu_nueva_api_key_generada
EOF
```

### **Paso 5: Actualizar Vercel (Si está desplegado)**

1. Ve a Vercel Dashboard
2. Tu proyecto → Settings → Environment Variables
3. Actualiza `VITE_API_KEY` con la nueva clave
4. Redesplega

---

## 📊 CHECKLIST DE REMEDIACIÓN

### Inmediato (Hoy):
- [ ] Generar nueva API Key
- [ ] Actualizar Supabase Secrets
- [ ] Actualizar .env local
- [ ] Redesplegar Edge Functions
- [ ] Actualizar Vercel (si aplica)
- [ ] Revisar logs de Supabase
- [ ] Verificar usuarios en BD

### Corto Plazo (Esta Semana):
- [ ] Limpiar historial de Git (si repo es público)
- [ ] Implementar rotación automática mensual
- [ ] Configurar alertas de uso anómalo
- [ ] Documentar fecha de rotación

### Largo Plazo (Este Mes):
- [ ] Implementar secrets management (Vault/AWS Secrets)
- [ ] Configurar CI/CD para verificar credenciales
- [ ] Auditoría de seguridad completa
- [ ] Training de equipo sobre gestión de secrets

---

## 🛡️ PREVENCIÓN FUTURA

### 1. **Pre-commit Hook**

Crea `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Detectar posibles credenciales antes de commit

if git diff --cached | grep -i "api_key\|secret\|password\|token" | grep -v "YOUR_"; then
    echo "⚠️  ADVERTENCIA: Posibles credenciales detectadas"
    echo "Revisa los archivos antes de hacer commit"
    exit 1
fi
```

```bash
chmod +x .git/hooks/pre-commit
```

### 2. **GitHub Secret Scanning**

Si usas GitHub:
1. Settings → Security → Code security and analysis
2. Habilitar "Secret scanning"
3. GitHub alertará automáticamente

### 3. **Usar Variables de Entorno Correctamente**

```typescript
// ✅ CORRECTO
const apiKey = import.meta.env.VITE_API_KEY;

// ❌ INCORRECTO
const apiKey = "02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk";
```

### 4. **Documentación Segura**

```markdown
<!-- ✅ CORRECTO -->
VITE_API_KEY=your_generated_api_key_here

<!-- ❌ INCORRECTO -->
VITE_API_KEY=02F5yhscLpWezI-bjWqHTZDdQt-kEW-LiDAzjf0Sspk
```

---

## 📈 MONITOREO POST-REMEDIACIÓN

### Semana 1-2:
- Revisar logs diariamente
- Verificar uso de recursos
- Monitorear creación de jobs

### Mes 1:
- Rotación programada de API Key
- Auditoría de usuarios
- Revisión de accesos

---

## 🆘 ESCENARIO DE PEOR CASO

### Si detectas uso no autorizado:

1. **Deshabilitar acceso inmediatamente:**
   ```bash
   # Cambiar TODAS las credenciales
   supabase secrets set API_KEY="NUEVA_KEY_TEMPORAL"
   ```

2. **Congelar proyecto:**
   - Supabase Dashboard → Settings → General
   - Pausar proyecto temporalmente

3. **Contactar Soporte:**
   - Supabase Support: support@supabase.io
   - Reportar incidente de seguridad

4. **Migrar a nuevo proyecto:**
   - Crear proyecto Supabase nuevo
   - Exportar datos limpios
   - Importar en nuevo proyecto
   - Actualizar toda la configuración

---

## 📞 CONTACTO Y SOPORTE

**Para dudas sobre remediación:**
- Documentación: `ENV_SETUP_TEMPLATE.md`
- Security Best Practices: Supabase Docs

**En caso de emergencia:**
- Pausar proyecto en Supabase
- Rotar TODAS las credenciales
- Contactar soporte

---

## ✅ CONFIRMACIÓN DE REMEDIACIÓN

Una vez completados todos los pasos:

```bash
# Verificar que no hay credenciales expuestas
git grep "02F5yhscLpWezI" || echo "✅ API Key antigua no encontrada"
git grep "lrknetzftkezvqmcincb" || echo "✅ Project ID no hardcodeado"

# Verificar .env no está en repo
git status | grep ".env" && echo "❌ .env está en staging!" || echo "✅ .env ignorado"
```

---

**Estado de Remediación:** ⚠️ **PENDIENTE ROTACIÓN DE API KEY**

**Próximos Pasos:**
1. ✅ Archivos limpiados
2. ⏳ Rotar API Key (URGENTE)
3. ⏳ Verificar logs
4. ⏳ Limpiar historial Git (si necesario)

**Fecha límite recomendada:** INMEDIATO (Hoy)

