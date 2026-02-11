# 📱 Guía de Plantillas WhatsApp - Import Corporal Medical

## 📋 Estructura de Variables

Cada plantilla usa **3 variables** en el body:

```
{{1}} = Nombre del destinatario
{{2}} = Número de guía
{{3}} = Estado de envío
```

**Nota**: La transportadora está **hardcodeada** en el texto de cada plantilla, NO es una variable.

---

## 🔧 Crear en Meta Business Manager

Ve a: **https://business.facebook.com** → WhatsApp → Message Templates

---

## 📱 Template 1: Servientrega

### **Configuración:**
- **Nombre**: `servientrega_tracking_notification`
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)

### **Body:**
```
🚚 Import Corporal Medical - Notificación de Envío

Hola {{1}}, estos son los detalles de tu envio

📦 Detalles del envío:
• Transportadora: Servientrega
• Número de guía: {{2}}
• Estado: {{3}}

🔍 Usa el botón de abajo para rastrear tu pedido en tiempo real.

Gracias por tu compra ✨
```

### **Button (URL):**
- **Tipo**: URL
- **Texto**: Rastrear envío
- **URL**: `https://www.servientrega.com/rastreo/multiple/`
- **Sin variables** en la URL

---

## 📱 Template 2: Envia

### **Configuración:**
- **Nombre**: `envia_tracking_notification`
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)

### **Body:**
```
🚚 Import Corporal Medical - Notificación de Envío

Hola {{1}}, estos son los detalles de tu envio

📦 Detalles del envío:
• Transportadora: Envia
• Número de guía: {{2}}
• Estado: {{3}}

🔍 Usa el botón de abajo para rastrear tu pedido en tiempo real.

Gracias por tu compra ✨
```

### **Button (URL):**
- **Tipo**: URL
- **Texto**: Rastrear envío
- **URL**: `https://envia.co/rastreo/`
- **Sin variables** en la URL

---

## 📱 Template 3: Deprisa

### **Configuración:**
- **Nombre**: `deprisa_tracking_notification`
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)

### **Body:**
```
🚚 Import Corporal Medical - Notificación de Envío

Hola {{1}}, estos son los detalles de tu envio

📦 Detalles del envío:
• Transportadora: Deprisa
• Número de guía: {{2}}
• Estado: {{3}}

🔍 Usa el botón de abajo para rastrear tu pedido en tiempo real.

Gracias por tu compra ✨
```

### **Button (URL):**
- **Tipo**: URL
- **Texto**: Rastrear envío
- **URL**: `https://www.deprisa.com/rastreo/`
- **Sin variables** en la URL

---

## 📊 Ejemplo de Mensaje Final

### **Para Servientrega (guía: 2258298191):**

```
🚚 Import Corporal Medical - Notificación de Envío

Hola Juan Pérez, estos son los detalles de tu envio

📦 Detalles del envío:
• Transportadora: Servientrega
• Número de guía: 2258298191
• Estado: En tránsito

🔍 Usa el botón de abajo para rastrear tu pedido en tiempo real.

Gracias por tu compra ✨

[Botón: Rastrear envío] → https://www.servientrega.com/rastreo/multiple/
```

---

## ✅ Checklist de Creación

### **Para cada template:**

1. **Nombre exacto** (crítico):
   - [ ] `servientrega_tracking_notification`
   - [ ] `envia_tracking_notification`
   - [ ] `deprisa_tracking_notification`

2. **Variables en Body** (3 en total):
   - [ ] {{1}} para Nombre del destinatario
   - [ ] {{2}} para Número de guía
   - [ ] {{3}} para Estado de envío

3. **Texto hardcodeado**:
   - [ ] "Transportadora: Servientrega" (o Envia/Deprisa según template)
   - [ ] Todo el texto decorativo (emojis, formato)

4. **Botón URL**:
   - [ ] Texto: "Rastrear envío"
   - [ ] URL estática (sin variables {{1}})
   - [ ] URL correcta por transportadora

5. **Configuración**:
   - [ ] Categoría: UTILITY
   - [ ] Idioma: Spanish (es)

---

## 🎯 Pasos en Meta Business

### **1. Crear Nuevo Template**
- Haz clic en "Create Template"
- Selecciona "Message Template"

### **2. Información Básica**
- **Nombre**: (uno de los 3 nombres exactos)
- **Categoría**: UTILITY
- **Idioma**: Spanish (es)

### **3. Contenido del Body**
- Pega el texto exacto del template
- Las variables {{1}}, {{2}}, {{3}} se detectan automáticamente
- Etiqueta cada variable:
  - {{1}} → "Nombre del destinatario"
  - {{2}} → "Número de guía"
  - {{3}} → "Estado de envío"

### **4. Agregar Botón**
- Tipo: "URL"
- Texto del botón: "Rastrear envío"
- URL: (según transportadora, sin variables)
- **NO** marcar "Add variable to URL"

### **5. Enviar a Revisión**
- Haz clic en "Submit"
- Espera aprobación de Meta (1-24 horas)

---

## ⏰ Tiempo de Aprobación

- **Promedio**: 2-6 horas
- **Máximo**: 24 horas
- **Verifica**: En la sección "Message Templates"

---

## 🆘 Solución de Problemas

### ❌ "Template rejected"
**Causa**: Texto no cumple políticas de WhatsApp
**Solución**: Asegúrate de no prometer cosas que no puedes cumplir

### ❌ "Invalid template parameter"
**Causa**: Variables mal configuradas
**Solución**: Verifica que tengas exactamente 3 variables {{1}}, {{2}}, {{3}}

### ❌ "Template not found" al enviar
**Causa**: Template no aprobado o nombre incorrecto
**Solución**: 
- Verifica que status sea "APPROVED"
- Verifica nombres exactos (con guiones bajos)

---

## 🎉 Una vez Aprobados

Cuando los 3 templates estén aprobados:

1. ✅ Ve a tu app: https://guias.icmtherapy.com
2. ✅ Sube tu Excel con guías de diferentes transportadoras
3. ✅ El sistema detectará automáticamente la transportadora
4. ✅ Usará el template correcto para cada una
5. ✅ Los mensajes se enviarán con el formato correcto

---

## 💡 Tips

- **Copia exacta**: Copia el texto exactamente como está (con emojis)
- **No modifiques**: El nombre del template NO se puede cambiar después de crearlo
- **Prueba primero**: Usa tu propio número para probar antes de envíos masivos
- **Backup**: Guarda capturas de pantalla de los templates aprobados

---

## 📞 Variables que Envía el Sistema

El sistema automáticamente llena las variables así:

```javascript
{{1}} = Nombre del Excel (columna: recipient_name)
{{2}} = Número de guía del Excel (columna: guide_number)
{{3}} = "En tránsito" (hardcodeado en el código)
```

Si quieres cambiar el estado por defecto, puedes modificarlo en el código de la función edge.

---

## ✅ Estado Actual del Sistema

- ✅ Detección automática de transportadora
- ✅ Código configurado para 3 variables
- ✅ URLs estáticas en botones
- ✅ Sistema listo para usar

**Solo falta**: Crear y aprobar los 3 templates en Meta Business 🚀

