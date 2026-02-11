

# Plan: Rate Limiting Avanzado + Dashboard de Analytics

## 1. Rate Limiting Avanzado (Cola de mensajes)

### Cambios en la Edge Function `send-whatsapp`
- Implementar envio por lotes (batches) con tamano configurable via secret `WA_BATCH_SIZE` (default: 10)
- Agregar backoff exponencial cuando WhatsApp devuelve error 429 (rate limit)
- Reportar progreso parcial: actualizar el job con contadores intermedios cada batch
- Agregar campo `status: 'PROCESSING'` con progreso parcial visible

### Cambios en la base de datos
- Agregar columna `progress_percent` (integer, default 0) a la tabla `jobs` para tracking de progreso en tiempo real
- Habilitar realtime en la tabla `jobs` para que el frontend pueda ver el progreso

### Cambios en el frontend (Preview.tsx)
- Mostrar barra de progreso durante el envio, suscribiendose a cambios realtime del job
- Mostrar contador actualizado de enviados/fallidos mientras se procesa

---

## 2. Dashboard de Analytics

### Nueva pagina: `src/pages/Analytics.tsx`
Dashboard con graficas usando Recharts (ya instalado) que incluira:

- **Grafica de barras**: Mensajes enviados vs fallidos por dia (ultimos 30 dias)
- **Grafica de pastel**: Distribucion de estados (SENT, FAILED, PENDING)
- **KPIs en tarjetas**: Total enviados, tasa de exito (%), promedio diario, total de jobs
- **Filtro de rango de fechas** con selector de periodo (7d, 30d, 90d)

### Datos
- Se consultan directamente las tablas `jobs` y `sent_messages` agrupando por fecha con queries desde el frontend
- No se necesitan tablas nuevas para analytics

### Navegacion
- Agregar entrada "Analytics" en el menu de navegacion (`Layout.tsx`) con icono `BarChart3`
- Agregar ruta `/analytics` en `App.tsx` como ruta protegida

---

## Detalle tecnico

### Migracion SQL
```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
```

### Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `supabase/functions/send-whatsapp/index.ts` | Batching, backoff exponencial, progreso parcial |
| `src/pages/Preview.tsx` | Barra de progreso con realtime subscription |
| `src/pages/Analytics.tsx` | Nueva pagina con dashboard de metricas |
| `src/components/Layout.tsx` | Agregar link "Analytics" en la nav |
| `src/App.tsx` | Agregar ruta `/analytics` |

### Nuevos archivos
| Archivo | Descripcion |
|---------|-------------|
| `src/pages/Analytics.tsx` | Dashboard completo con Recharts |

