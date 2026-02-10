# WA Notify (MVP local)

Aplicación mínima para:

1. Cargar un Excel (`.xls/.xlsx/.xml`) de Servientrega.
2. Previsualizar y validar filas.
3. Enviar mensajes de WhatsApp directamente desde el frontend usando token local.
4. Ver historial y detalle guardados en `localStorage` del navegador.

## Configuración local de token

Edita `src/config/whatsapp.ts`:

- `token`: token de Meta WhatsApp.
- `phoneNumberId`: id del número de WhatsApp.
- `sendDelayMs`: espera entre mensajes (ms).

> ⚠️ Este MVP guarda credenciales en frontend y **no es seguro para producción**.

## Scripts

```bash
npm i
npm run dev
npm run test -- --run
npm run build
```
