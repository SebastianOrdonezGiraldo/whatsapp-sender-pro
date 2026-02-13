# Sistema de Roles de Administrador

## Configuración

Para otorgar permisos de administrador a un usuario:

1. Ve a **Supabase Dashboard** → **Authentication** → **Users**
2. Selecciona el usuario
3. En **User Metadata**, agrega o actualiza:
   ```json
   {
     "role": "admin"
   }
   ```
4. Guarda los cambios

## Permisos de Admin

Los usuarios con `user_metadata.role = "admin"` tienen:

- ✅ Acceso completo a todos los jobs (lectura, escritura, eliminación)
- ✅ Acceso a message_queue de cualquier job
- ✅ Acceso a sent_messages de cualquier job
- ✅ Bypass de validación de ownership en Edge Functions

## Verificación

Para verificar el rol de un usuario:

```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log('Role:', user.user_metadata?.role);
```

## Seguridad

- Los roles se almacenan en `user_metadata` de Supabase Auth
- Las políticas RLS verifican el rol en cada consulta
- Las Edge Functions validan el rol antes de operaciones sensibles
- Solo administradores de Supabase pueden modificar `user_metadata`
