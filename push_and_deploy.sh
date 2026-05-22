#!/usr/bin/env bash
# ================================================================
# POSManual - DevSys Honduras
# Script: push_and_deploy.sh
#
# USO:
#   chmod +x push_and_deploy.sh
#   ./push_and_deploy.sh
#
# Qué hace:
#   1. Verifica que Git y Node estén instalados
#   2. Inicializa el repo si no existe
#   3. Hace el push inicial a GitHub
#   4. Instala Railway CLI si no está
#   5. Crea el proyecto en Railway y configura variables
#   6. Hace el deploy
# ================================================================

set -e  # detener si cualquier comando falla
GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${BLUE}[POSManual]${NC} $1"; }
ok()   { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC}  $1"; }
err()  { echo -e "${RED}❌${NC} $1"; exit 1; }

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   POSManual — Push a GitHub + Deploy en Railway${NC}"
echo -e "${BLUE}   DevSys Honduras${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Verificar dependencias ─────────────────────────────────
log "Verificando dependencias..."
command -v git  >/dev/null 2>&1 || err "Git no está instalado. Instalá desde https://git-scm.com"
command -v node >/dev/null 2>&1 || err "Node.js no está instalado. Instalá desde https://nodejs.org"
command -v npm  >/dev/null 2>&1 || err "npm no está instalado."
ok "Git $(git --version | cut -d' ' -f3), Node $(node -v), npm $(npm -v)"

# ── 2. Verificar que estamos en la raíz del proyecto ──────────
if [ ! -f "01_schema.sql" ] || [ ! -d "client" ] || [ ! -d "server" ]; then
  err "Ejecutá este script desde la raíz del proyecto posmanual/ (donde están client/ y server/)"
fi
ok "Estructura del proyecto verificada"

# ── 3. Pedir datos de GitHub ──────────────────────────────────
echo ""
echo -e "${YELLOW}━━ Configuración de GitHub ━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
read -p "Tu usuario de GitHub: " GH_USER
read -p "Nombre del repositorio [posmanual]: " REPO_NAME
REPO_NAME=${REPO_NAME:-posmanual}
GH_REPO="https://github.com/${GH_USER}/${REPO_NAME}.git"
echo ""
warn "Antes de continuar, creá el repositorio en GitHub:"
echo "  → https://github.com/new"
echo "  → Nombre: ${REPO_NAME}"
echo "  → Privado o público (tu elección)"
echo "  → NO inicializar con README ni .gitignore"
echo ""
read -p "¿Ya creaste el repositorio? [s/n]: " CREATED
[[ "$CREATED" != "s" && "$CREATED" != "S" ]] && err "Creá el repositorio primero y volvé a ejecutar."

# ── 4. Inicializar Git si no existe ───────────────────────────
log "Configurando repositorio Git..."
if [ ! -d ".git" ]; then
  git init
  ok "Repositorio Git inicializado"
else
  ok "Repositorio Git ya existe"
fi

# ── 5. Configurar .gitignore si no existe ─────────────────────
if [ ! -f ".gitignore" ]; then
  cat > .gitignore << 'GITEOF'
.env
.env.local
server/.env
node_modules/
client/node_modules/
server/node_modules/
client/dist/
*.log
coverage/
.DS_Store
GITEOF
  ok ".gitignore creado"
fi

# ── 6. Primer commit y push ───────────────────────────────────
log "Preparando commit inicial..."
git add .

# Verificar si hay algo que commitear
if git diff --cached --quiet; then
  warn "No hay cambios nuevos para commitear"
else
  git commit -m "feat: POSManual v1.0 — Sistema POS completo DevSys Honduras

Módulos incluidos:
- Punto de Venta con ticket Proforma 80mm
- Turnos y Corte de Caja
- Gestión de Artículos (2000 productos)
- Inventario con Kardex
- Reportes Excel + PDF
- Cuentas por Cobrar/Pagar
- Bancos
- Gestión de Usuarios
- Deploy Railway configurado"
  ok "Commit creado"
fi

# Configurar remote
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$GH_REPO"
  ok "Remote 'origin' actualizado → $GH_REPO"
else
  git remote add origin "$GH_REPO"
  ok "Remote 'origin' configurado → $GH_REPO"
fi

# Renombrar rama a main
git branch -M main

log "Haciendo push a GitHub..."
git push -u origin main
ok "Código subido a GitHub: ${GH_REPO}"

# ── 7. Instalar Railway CLI ───────────────────────────────────
echo ""
echo -e "${YELLOW}━━ Configuración de Railway ━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if ! command -v railway >/dev/null 2>&1; then
  log "Instalando Railway CLI..."
  npm install -g @railway/cli
  ok "Railway CLI instalado"
else
  ok "Railway CLI ya instalado ($(railway --version))"
fi

# ── 8. Login en Railway ───────────────────────────────────────
log "Iniciando sesión en Railway..."
echo "Se abrirá el navegador para autenticarte en Railway."
read -p "Presioná Enter para continuar..."
railway login
ok "Sesión iniciada en Railway"

# ── 9. Crear proyecto en Railway ─────────────────────────────
log "Creando proyecto en Railway..."
railway new --name "posmanual"
ok "Proyecto 'posmanual' creado en Railway"

# ── 10. Agregar PostgreSQL ────────────────────────────────────
log "Agregando base de datos PostgreSQL..."
railway add --plugin postgresql
echo ""
warn "Railway está provisionando PostgreSQL..."
warn "En unos segundos tendrás la DATABASE_URL disponible."
sleep 5

# ── 11. Configurar variables de entorno ───────────────────────
echo ""
echo -e "${YELLOW}━━ Variables de entorno ━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
warn "Necesitamos configurar las variables. Algunas requieren valores tuyos."
echo ""

# Generar JWT_SECRET aleatorio
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
ok "JWT_SECRET generado automáticamente (64 bytes)"

# Pedir URL del frontend (se asigna después del primer deploy)
echo ""
warn "La URL de Railway se asigna después del primer deploy."
warn "Por ahora usaremos un placeholder — lo actualizás en el dashboard."
CLIENT_URL="https://posmanual.up.railway.app"

# Configurar variables
log "Configurando variables de entorno en Railway..."
railway variables set \
  JWT_SECRET="$JWT_SECRET" \
  JWT_EXPIRES_IN="8h" \
  NODE_ENV="production" \
  CLIENT_URL="$CLIENT_URL" \
  RTN_EMPRESA="05019009204111" \
  NOMBRE_EMPRESA="INVERSIONES BUENOS AIRES S.A." \
  DIRECCION_EMPRESA="Bo. Buenos Aires BLVD del norte, San Pedro Sula, Honduras" \
  TELEFONO_EMPRESA="+504 2527-8133/8119" \
  EMAIL_EMPRESA="gerenciatexacoba@gmail.com" \
  CAI_ACTIVO="40BC19-7CF1EF-C2FBE0-63BE03-0909B8-D4" \
  CAI_FECHA_LIMITE="09/10/2026" \
  CAI_RANGO_INICIO="000-009-01-03816501" \
  CAI_RANGO_FIN="000-009-01-04066500"

ok "Variables configuradas en Railway"

# ── 12. Configurar Release Command (migración automática) ─────
log "Configurando Release Command para migraciones automáticas..."
railway service update --release-command "cd server && npm run migrate"
ok "Release Command configurado: 'cd server && npm run migrate'"

# ── 13. Deploy ────────────────────────────────────────────────
echo ""
log "Iniciando deploy en Railway..."
railway up --detach
ok "Deploy iniciado en Railway"

# ── 14. Abrir dashboard ───────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}   🎉 POSManual en camino a producción${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  GitHub:   ${GH_REPO}"
echo ""
echo -e "${YELLOW}  Próximos pasos:${NC}"
echo "  1. Esperá 3-5 minutos que Railway termine el build"
echo "  2. Abrí el dashboard: railway open"
echo "  3. Copiá la URL pública del proyecto"
echo "  4. Actualizá CLIENT_URL y VITE_API_URL con esa URL:"
echo "     railway variables set CLIENT_URL=https://TU_URL.railway.app"
echo "     railway variables set VITE_API_URL=https://TU_URL.railway.app/api/v1"
echo "  5. Hacé un redeploy: railway up"
echo "  6. Verificá: curl https://TU_URL.railway.app/health"
echo ""
echo -e "${YELLOW}  Credenciales iniciales:${NC}"
echo "  admin     / Admin2024!"
echo "  cajero01  / Cajero2024!"
echo ""

railway open
