# 🚚 Sistema Multi-Transportadora

## 📋 Resumen

Tu aplicación ahora detecta **automáticamente** la transportadora basándose en el formato del número de guía y envía el template de WhatsApp correcto para cada una.

---

## 🔍 Detección Automática

### Reglas de Detección:

| Transportadora | Formato Guía | Ejemplo | Template WhatsApp |
|---------------|--------------|---------|-------------------|
| **Servientrega** | 10 dígitos exactos | `2258298191` | `servientrega_tracking_notification` |
| **Envia** | 12 dígitos (NO empieza con 888) | `957000255300` | `envia_tracking_notification` |
| **Deprisa** | 12 dígitos (empieza con 888) | `888004907296` | `deprisa_tracking_notification` |

---

## 📱 Templates de WhatsApp

### Estructura de cada template:

Cada template debe tener la siguiente estructura en Meta Business:

#### **Body (Cuerpo del mensaje):**
```
Hola {{1}}, tu pedido con número de guía {{2}} está {{3}}.
```

Variables:
- `{{1}}` = Nombre del destinatario
- `{{2}}` = Número de guía
- `{{3}}` = Estado del envío (ej: "En tránsito")

#### **Button (Botón con URL dinámica):**
```
Rastrear mi pedido
URL: [URL de rastreo con {{1}} como variable]
```

Variable:
- `{{1}}` = Número de guía (se inserta en la URL)

---

## 🔧 Configuración en Meta Business

### Paso 1: Crear los 3 templates

Ve a: **Meta Business Manager → WhatsApp → Message Templates**

#### **Template 1: Servientrega**
- **Nombre**: `servientrega_tracking_notification`
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)
- **Body**: 
  ```
  Hola {{1}}, tu pedido con número de guía {{2}} está {{3}}.
  ```
- **Button**: URL Button
  - Texto: "Rastrear mi pedido"
  - URL: `https://www.servientrega.com/rastreo/multiple/{{1}}`

#### **Template 2: Envia**
- **Nombre**: `envia_tracking_notification`
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)
- **Body**: 
  ```
  Hola {{1}}, tu pedido con número de guía {{2}} está {{3}}.
  ```
- **Button**: URL Button
  - Texto: "Rastrear mi pedido"
  - URL: `https://envia.co/rastreo/?guia={{1}}`

#### **Template 3: Deprisa**
- **Nombre**: `deprisa_tracking_notification`
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)
- **Body**: 
  ```
  Hola {{1}}, tu pedido con número de guía {{2}} está {{3}}.
  ```
- **Button**: URL Button
  - Texto: "Rastrear mi pedido"
  - URL: `https://www.deprisa.com/rastreo/?guia={{1}}`

### Paso 2: Esperar aprobación

Meta revisará cada template (generalmente tarda 1-24 horas).

---

## 🎯 Cómo Funciona

### 1. **Usuario sube archivo Excel**
El Excel debe tener estas columnas:
```
| phone_e164    | guide_number | recipient_name  |
|---------------|--------------|-----------------|
| +573001234567 | 2258298191   | Carlos Ruiz     |  ← Servientrega (10 dígitos)
| +573012345678 | 957000255300 | Ana López       |  ← Envia (12 dígitos, no 888)
| +573023456789 | 888004907296 | Pedro Martínez  |  ← Deprisa (12 dígitos, empieza 888)
```

### 2. **Sistema detecta automáticamente**
- Parser analiza cada número de guía
- Detecta la transportadora por el formato
- Asigna el template correcto
- Genera URL de rastreo correspondiente

### 3. **Preview muestra la transportadora**
En la vista previa, verás una columna "Transportadora" que muestra:
- 🚚 **Servientrega**
- 🚚 **Envia**
- 🚚 **Deprisa**

### 4. **WhatsApp usa el template correcto**
Cuando se envía el mensaje:
- Se usa el template específico de cada transportadora
- El botón apunta a la URL de rastreo correcta
- El cliente recibe un mensaje personalizado

---

## 📊 Ejemplo de Mensaje Final

### Para Servientrega:
```
Hola Carlos Ruiz, tu pedido con número de guía 2258298191 está En tránsito.

[Botón: Rastrear mi pedido]
```
Al hacer clic: `https://www.servientrega.com/rastreo/multiple/2258298191`

### Para Envia:
```
Hola Ana López, tu pedido con número de guía 957000255300 está En tránsito.

[Botón: Rastrear mi pedido]
```
Al hacer clic: `https://envia.co/rastreo/?guia=957000255300`

### Para Deprisa:
```
Hola Pedro Martínez, tu pedido con número de guía 888004907296 está En tránsito.

[Botón: Rastrear mi pedido]
```
Al hacer clic: `https://www.deprisa.com/rastreo/?guia=888004907296`

---

## 🔍 Verificar en la Base de Datos

Las tablas ahora tienen los campos:
- `carrier` → Transportadora detectada (servientrega/envia/deprisa)
- `tracking_url` → URL completa de rastreo
- `template_name` → Nombre del template usado

---

## 🆘 Solución de Problemas

### ❌ "Template not found"
**Causa**: El template no está aprobado en Meta
**Solución**: Ve a Meta Business Manager y verifica que los 3 templates estén aprobados

### ❌ "Invalid template parameter"
**Causa**: La estructura del template no coincide
**Solución**: Verifica que tengas exactamente:
- 3 variables en body: `{{1}}`, `{{2}}`, `{{3}}`
- 1 variable en button: `{{1}}`

### ❌ Transportadora detectada incorrectamente
**Causa**: Formato de guía no estándar
**Solución**: Verifica que las guías tengan el formato correcto:
- Servientrega: exactamente 10 dígitos
- Envia: exactamente 12 dígitos (NO 888...)
- Deprisa: exactamente 12 dígitos (888...)

### ❌ URL de rastreo no funciona
**Causa**: La URL del template en Meta no coincide
**Solución**: Verifica que las URLs en Meta sean:
- Servientrega: `https://www.servientrega.com/rastreo/multiple/{{1}}`
- Envia: `https://envia.co/rastreo/?guia={{1}}`
- Deprisa: `https://www.deprisa.com/rastreo/?guia={{1}}`

---

## 🔧 Personalización

### Cambiar el mensaje de estado

En `supabase/functions/process-message-queue/index.ts`, línea que dice:
```typescript
{ type: "text", text: "En tránsito" }, // {{3}} - Default status
```

Puedes cambiar "En tránsito" por:
- "Fue despachado"
- "Está en camino"
- "Se encuentra en distribución"
- etc.

### Agregar nueva transportadora

1. **Edita** `src/lib/carrier-detection.ts`
2. **Agrega** la nueva transportadora al objeto `CARRIERS`
3. **Actualiza** la función `detectCarrier()` con la lógica de detección
4. **Crea** el template en Meta Business
5. **Despliega** los cambios

---

## 📈 Estadísticas

En el dashboard podrás ver:
- Total de mensajes por transportadora
- Tasa de éxito por transportadora
- Tiempos de envío
- Errores específicos de cada template

---

## ✅ Checklist de Configuración

- [ ] Templates creados en Meta Business Manager
- [ ] Templates aprobados (status: APPROVED)
- [ ] Nombres exactos:
  - [ ] `servientrega_tracking_notification`
  - [ ] `envia_tracking_notification`
  - [ ] `deprisa_tracking_notification`
- [ ] URLs de rastreo configuradas correctamente
- [ ] Prueba con números reales de cada transportadora
- [ ] Verifica que los botones funcionen

---

## 🎉 ¡Todo Listo!

Tu sistema ahora:
- ✅ Detecta automáticamente 3 transportadoras
- ✅ Usa el template correcto para cada una
- ✅ Genera URLs de rastreo dinámicas
- ✅ Muestra la transportadora en el preview
- ✅ Guarda todo en la base de datos

**URL de tu app**: https://guias.icmtherapy.com

---

## 📞 Soporte

Si tienes dudas o problemas:
1. Revisa los logs en Supabase Dashboard
2. Verifica los templates en Meta Business Manager
3. Prueba con guías de ejemplo de cada formato

