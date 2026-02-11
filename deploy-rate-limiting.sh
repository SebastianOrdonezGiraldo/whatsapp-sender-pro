#!/bin/bash
# Script de deployment para Rate Limiting System
# WA Notify - WhatsApp Sender Pro

set -e  # Exit on error

echo "🚀 Desplegando Sistema de Rate Limiting Avanzado"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI no está instalado${NC}"
    echo "Instálalo con: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✓ Supabase CLI encontrado${NC}"

# Step 1: Apply database migration
echo ""
echo "📊 Paso 1: Aplicando migración de base de datos..."
echo "---------------------------------------------------"

if supabase db push; then
    echo -e "${GREEN}✓ Migración aplicada exitosamente${NC}"
else
    echo -e "${RED}❌ Error aplicando migración${NC}"
    echo "Intenta manualmente: supabase db push"
    exit 1
fi

# Step 2: Deploy Edge Functions
echo ""
echo "⚡ Paso 2: Desplegando Edge Functions..."
echo "----------------------------------------"

# Deploy enqueue-messages
echo "Desplegando enqueue-messages..."
if supabase functions deploy enqueue-messages; then
    echo -e "${GREEN}✓ enqueue-messages desplegada${NC}"
else
    echo -e "${RED}❌ Error desplegando enqueue-messages${NC}"
    exit 1
fi

# Deploy process-message-queue
echo "Desplegando process-message-queue..."
if supabase functions deploy process-message-queue; then
    echo -e "${GREEN}✓ process-message-queue desplegada${NC}"
else
    echo -e "${RED}❌ Error desplegando process-message-queue${NC}"
    exit 1
fi

# Step 3: Verify secrets
echo ""
echo "🔐 Paso 3: Verificando secretos..."
echo "----------------------------------"

echo "Verificando secretos configurados..."
if supabase secrets list | grep -q "WA_TOKEN"; then
    echo -e "${GREEN}✓ WA_TOKEN configurado${NC}"
else
    echo -e "${YELLOW}⚠ WA_TOKEN no configurado${NC}"
    echo "Configúralo con: supabase secrets set WA_TOKEN=your_token"
fi

if supabase secrets list | grep -q "WA_PHONE_NUMBER_ID"; then
    echo -e "${GREEN}✓ WA_PHONE_NUMBER_ID configurado${NC}"
else
    echo -e "${YELLOW}⚠ WA_PHONE_NUMBER_ID no configurado${NC}"
    echo "Configúralo con: supabase secrets set WA_PHONE_NUMBER_ID=your_id"
fi

# Step 4: List deployed functions
echo ""
echo "📋 Paso 4: Funciones desplegadas:"
echo "---------------------------------"
supabase functions list

# Step 5: Run tests (optional)
echo ""
echo "🧪 Paso 5: Tests (opcional)"
echo "---------------------------"
read -p "¿Deseas ejecutar tests de integración? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Ejecutando tests..."
    
    # Get project URL
    PROJECT_URL=$(supabase status | grep "API URL" | awk '{print $3}')
    
    if [ -z "$PROJECT_URL" ]; then
        echo -e "${YELLOW}⚠ No se pudo obtener URL del proyecto${NC}"
        echo "Ejecuta tests manualmente siguiendo DEPLOYMENT_RATE_LIMITING.md"
    else
        echo "URL del proyecto: $PROJECT_URL"
        echo "Ver tests en: DEPLOYMENT_RATE_LIMITING.md"
    fi
fi

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}✅ Despliegue completado exitosamente!${NC}"
echo "================================================"
echo ""
echo "📚 Próximos pasos:"
echo "  1. Verificar que el frontend esté desplegado"
echo "  2. Probar flujo completo en la UI"
echo "  3. Monitorear logs: supabase functions logs process-message-queue --tail"
echo "  4. Revisar documentación: RATE_LIMITING_GUIDE.md"
echo ""
echo "🎯 Configuración recomendada para producción:"
echo "  - Ajustar rate_limit_config en la base de datos"
echo "  - Configurar procesamiento periódico (cron)"
echo "  - Establecer alertas de monitoreo"
echo ""
echo -e "${GREEN}¡Sistema de Rate Limiting listo para usar!${NC} 🚀"

