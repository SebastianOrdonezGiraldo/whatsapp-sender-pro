# Pruebas de Estrés - WhatsApp Sender Pro

Este documento explica cómo ejecutar una prueba de estrés controlada contra el sistema de cola y envío de mensajes.

## Script

Se añadió el script:

```bash
npm run stress:test
```

Internamente ejecuta `scripts/stress-test.mjs`.

## Variables requeridas

```bash
export SUPABASE_URL="https://<tu-proyecto>.supabase.co"
export SUPABASE_ANON_KEY="<anon-key>"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export STRESS_USER_JWT="<jwt-de-usuario-valido>"
export API_KEY="<api-key-edge-functions>"
```

## Variables opcionales

```bash
export STRESS_TOTAL_MESSAGES=1000
export STRESS_ENQUEUE_CHUNK=200
export STRESS_PROCESS_MAX_MESSAGES=20
export STRESS_POLL_INTERVAL_MS=500
export STRESS_SOURCE_FILENAME="stress-test-2026-02-13.xlsx"
```

## Qué hace la prueba

1. Crea un `job` de prueba asociado al usuario del JWT.
2. Encola mensajes sintéticos en bloques.
3. Ejecuta `process-message-queue` en bucle.
4. Consulta estadísticas con `get_job_queue_stats`.
5. Reporta duración, enviados/fallidos y throughput promedio.

## Recomendaciones

- Ejecutar primero en **staging**.
- Usar plantillas/credenciales de prueba para evitar impacto real.
- Empezar con 500-1000 mensajes y escalar gradualmente.
- Monitorear `% failed` y `% retrying`, no solo throughput.

## Ejemplo rápido

```bash
STRESS_TOTAL_MESSAGES=2000 STRESS_PROCESS_MAX_MESSAGES=50 npm run stress:test
```
