# POSManual — Guía de Deploy Manual (sin CLI)
## Para quienes prefieren el dashboard web de GitHub y Railway

---

## PARTE 1 — GitHub (10 minutos)

### Paso 1: Crear el repositorio

1. Ir a **https://github.com/new**
2. Completar:
   - **Repository name:** `posmanual`
   - **Description:** `Sistema POS — DevSys Honduras`
   - **Visibility:** Private (recomendado)
   - **NO** marcar "Initialize with README"
   - **NO** agregar .gitignore ni licencia
3. Clic en **Create repository**
4. GitHub mostrará la URL del repo: `https://github.com/TU_USUARIO/posmanual.git`

### Paso 2: Primer push desde la terminal

```bash
# Desde la carpeta raíz del proyecto (donde están client/ y server/)
cd posmanual/

# Crear .gitignore si no existe
cat > .gitignore << 'EOF'
.env
server/.env
node_modules/
client/node_modules/
server/node_modules/
client/dist/
*.log
coverage/
.DS_Store
EOF

# Inicializar Git
git init
git add .
git commit -m "feat: POSManual v1.0 — DevSys Honduras"

# Conectar con GitHub (reemplazá TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/posmanual.git
git branch -M main
git push -u origin main
```

Si te pide credenciales de GitHub, usá tu usuario y un **Personal Access Token**:
- GitHub → Settings → Developer settings → Personal access tokens → Generate new token
- Permisos mínimos: `repo`

### Paso 3: Verificar en GitHub

Ir a `https://github.com/TU_USUARIO/posmanual` y verificar que los archivos aparecen.

### Paso 4: Agregar el workflow de CI (opcional pero recomendado)

```bash
# Crear carpeta y copiar el workflow
mkdir -p .github/workflows
cp ci.yml .github/workflows/ci.yml
git add .github/
git commit -m "ci: agregar GitHub Actions"
git push
```

---

## PARTE 2 — Railway (15 minutos)

### Paso 1: Crear cuenta y proyecto

1. Ir a **https://railway.app** → Sign up con GitHub
2. Dashboard → **New Project**
3. Elegir **Deploy from GitHub repo**
4. Autorizar Railway para acceder a tus repos
5. Seleccionar `posmanual`
6. Railway detecta `railway.toml` automáticamente

### Paso 2: Agregar PostgreSQL

1. En el proyecto → **New** → **Database** → **Add PostgreSQL**
2. Railway crea la instancia y genera `DATABASE_URL` automáticamente
3. Verificar en **Variables** que `DATABASE_URL` aparece

### Paso 3: Configurar variables de entorno

En el dashboard del servicio → **Variables** → agregar una por una:

```
NODE_ENV              production
JWT_EXPIRES_IN        8h
CLIENT_URL            https://TU-APP.up.railway.app   ← actualizar después del primer deploy
RTN_EMPRESA           05019009204111
NOMBRE_EMPRESA        INVERSIONES BUENOS AIRES S.A.
DIRECCION_EMPRESA     Bo. Buenos Aires BLVD del norte, San Pedro Sula, Honduras
TELEFONO_EMPRESA      +504 2527-8133/8119
EMAIL_EMPRESA         gerenciatexacoba@gmail.com
CAI_ACTIVO            40BC19-7CF1EF-C2FBE0-63BE03-0909B8-D4
CAI_FECHA_LIMITE      09/10/2026
CAI_RANGO_INICIO      000-009-01-03816501
CAI_RANGO_FIN         000-009-01-04066500
```

Para `JWT_SECRET`, generarlo en la terminal local:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copiar el resultado (128 caracteres) y pegarlo como valor de `JWT_SECRET`.

### Paso 4: Configurar Release Command (migración automática)

En el servicio → **Settings** → **Deploy** → **Release Command**:
```
cd server && npm run migrate
```

Esto ejecuta `01_schema.sql` + `02_seed.sql` antes de cada deploy.

### Paso 5: Configurar Build y Start Commands

En **Settings** → **Build**:
- **Build Command:**
  ```
  cd client && npm install && npm run build && cd ../server && npm install
  ```
- **Start Command:**
  ```
  cd server && node src/index.js
  ```

### Paso 6: Configurar el dominio

1. En el servicio → **Settings** → **Networking** → **Generate Domain**
2. Railway genera algo como `posmanual-production.up.railway.app`
3. Volver a **Variables** y actualizar:
   ```
   CLIENT_URL    https://posmanual-production.up.railway.app
   VITE_API_URL  https://posmanual-production.up.railway.app/api/v1
   ```

### Paso 7: Primer deploy

En el dashboard → **Deploy** → el build comienza automáticamente.

El proceso toma 3-5 minutos:
```
[1/4] Installing dependencies...
[2/4] Building React app...
[3/4] Running release command (migrations)...
[4/4] Starting server...
```

### Paso 8: Verificar que funciona

```bash
# Health check
curl https://posmanual-production.up.railway.app/health
# Respuesta esperada: {"status":"ok","env":"production",...}

# Test de login
curl -X POST https://posmanual-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin2024!"}'
# Respuesta esperada: {"token":"eyJ...","user":{"rol":"ADMINISTRADOR",...}}
```

---

## PARTE 3 — Deploy automático (pushes futuros)

Después de la configuración inicial, cada `git push origin main` desencadena:

```
GitHub push → GitHub Actions (tests) → Railway deploy automático
```

Para hacer un cambio y deployar:
```bash
# Editar archivos...
git add .
git commit -m "fix: descripción del cambio"
git push origin main
# Railway hace el deploy automáticamente en ~3 minutos
```

---

## Verificación final

Abrir `https://posmanual-production.up.railway.app` en el navegador:

1. Aparece la pantalla de **login**
2. Ingresar `admin` / `Admin2024!`
3. Verificar que el sidebar muestra todos los módulos
4. Ir a **POS** → abrir turno → facturar un artículo
5. Ir a **Artículos** → importar `articulo.xlsx`
6. Ir a **Reportes** → generar Master de Ventas

---

## Solución de problemas comunes

**El build falla con "Cannot find module"**
```bash
# Verificar que package.json del servidor tiene todas las dependencias
cd server && npm install && git add package-lock.json && git push
```

**La migración falla con "relation already exists"**
→ Normal si la BD ya existe. El schema usa `CREATE TABLE IF NOT EXISTS`. No es un error.

**Login falla con 500**
→ Verificar que `DATABASE_URL` y `JWT_SECRET` están configurados en Railway Variables.

**La app carga pero las llamadas API fallan**
→ Verificar que `VITE_API_URL` tiene la URL correcta del backend Railway.
→ Hacer un nuevo build con `git commit --allow-empty -m "chore: rebuild" && git push`
