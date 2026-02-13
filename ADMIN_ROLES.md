# Sistema de Roles de Administrador

## Configuración

Para otorgar permisos de administrador a un usuario:

1. Ve a **Supabase Dashboard** → **Authentication** → **Users**
2. Selecciona el usuario
3. En **App Metadata** (NO User Metadata), agrega o actualiza:
   ```json
   {
     "role": "admin"
   }
   ```
4. Guarda los cambios

> ⚠️ **IMPORTANTE**: Usar `app_metadata`, NO `user_metadata`.
> `user_metadata` es editable por los usuarios finales y NO es seguro para control de acceso.
> `app_metadata` solo puede ser modificado server-side (service_role key).

### Alternativa: Vía API con service_role

```javascript
const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { role: 'admin' }
});
```

## Permisos de Admin

Los usuarios con `app_metadata.role = "admin"` tienen:

- ✅ Acceso completo a todos los jobs (lectura, escritura, eliminación)
- ✅ Acceso a message_queue de cualquier job
- ✅ Acceso a sent_messages de cualquier job
- ✅ Bypass de validación de ownership en Edge Functions

## Verificación

Para verificar el rol de un usuario:

```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log('Role:', user.app_metadata?.role);
```

## Seguridad

- Los roles se almacenan en `app_metadata` de Supabase Auth (inmutable por usuarios)
- Las políticas RLS verifican `auth.jwt() -> 'app_metadata' ->> 'role'` en cada consulta
- Las Edge Functions validan `app_metadata.role` antes de operaciones sensibles
- Solo administradores con `service_role` key pueden modificar `app_metadata`
