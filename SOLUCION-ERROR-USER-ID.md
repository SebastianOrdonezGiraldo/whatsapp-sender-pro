# 🔧 Solución: Error "Could not find the 'user_id' column of 'jobs'"

## ❌ Error
```
Error: Could not find the 'user_id' column of 'jobs' in the schema cache
```

## ✅ Solución Rápida (5 minutos)

### Paso 1: Ir al Dashboard de Supabase
1. Abre tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a **SQL Editor** (icono de base de datos en el menú izquierdo)

### Paso 2: Ejecutar el Script de Corrección
1. Crea una nueva query
2. Copia y pega el contenido del archivo `fix-user-id-error.sql`
3. Haz clic en **Run** (o presiona Ctrl+Enter)
4. Deberías ver mensajes de confirmación en verde

### Paso 3: Verificar que funcionó
Ejecuta esta query para verificar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'jobs'
  AND column_name = 'user_id';
```

Deberías ver un resultado con:
- `column_name`: user_id
- `data_type`: uuid

### Paso 4: Actualizar los Tipos de TypeScript (Opcional)
En tu proyecto local, ejecuta:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/integrations/supabase/types.ts
```

Reemplaza `TU_PROJECT_ID` con el ID de tu proyecto de Supabase.

### Paso 5: Probar el Envío
1. Recarga tu aplicación web
2. Intenta enviar mensajes nuevamente
3. ✅ Debería funcionar correctamente

---

## 📋 ¿Qué causó el error?

Las migraciones de la base de datos se ejecutaron en un orden incorrecto, lo que causó que:
- La tabla `jobs` se creara sin la columna `user_id`
- Las políticas RLS de `message_queue` intentaran referenciar `jobs.user_id` que no existía

El script de corrección:
1. ✅ Verifica si `user_id` existe
2. ✅ La crea si no existe
3. ✅ Recrea todas las políticas RLS correctamente
4. ✅ Es seguro ejecutarlo múltiples veces (idempotente)

---

## 🆘 Si el problema persiste

Si después de ejecutar el script sigues viendo el error:

1. **Limpia la caché del navegador**: Ctrl+F5
2. **Cierra sesión y vuelve a iniciar**: Para refrescar el token
3. **Verifica las políticas RLS**:
   ```sql
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE tablename = 'jobs';
   ```
   Deberías ver 4 políticas (view, insert, update, delete)

4. **Contacta con soporte**: Si nada funciona, hay un problema más profundo con la configuración de Supabase

