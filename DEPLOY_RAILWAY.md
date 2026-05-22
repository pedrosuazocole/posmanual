# POSManual — Guía de Deploy en Railway
## DevSys Honduras — Inversiones Buenos Aires S.A.

---

## Estructura del repositorio

```
posmanual/                      ← raíz del repo en GitHub
├── client/                     ← React + Vite (frontend)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js          ← proxy /api → localhost:3001
├── server/                     ← Express + PostgreSQL (backend)
│   ├── src/
│   │   ├── index.js            ← entry point (sirve también el dist de React)
│   │   ├── db.js
│   │   ├── db/migrate.js       ← ejecuta schema + seed automáticamente
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── middlewares/
│   └── package.json
├── 01_schema.sql               ← esquema PostgreSQL
├── 02_seed.sql                 ← usuarios y grupos iniciales
├── railway.toml
├── Procfile
└── .env.example
```

---

## Estrategia de deploy (monorepo — un solo servicio)

En producción, Express sirve directamente el build de React desde
`client/dist`. Esto simplifica el deploy a un solo servicio en Railway.

```
Request del navegador
        │
        ▼
Railway → Express (puerto $PORT)
        │
        ├── /api/v1/*  → controladores Express
        └── /*          → client/dist/index.html  (React SPA)
```

---

## Paso a paso en Railway

### 1. Crear el proyecto

```bash
# Desde la CLI de Railway
npm install -g @railway/cli
railway login
railway new
```

O desde el dashboard web en https://railway.app → "New Project".

### 2. Conectar el repositorio de GitHub

- En el dashboard: "Deploy from GitHub repo"
- Seleccionar el repo `posmanual`
- Railway detecta `railway.toml` automáticamente

### 3. Agregar PostgreSQL

En el dashboard del proyecto → "Add Plugin" → "PostgreSQL"

Railway genera automáticamente la variable `DATABASE_URL`.

### 4. Configurar variables de entorno

En el dashboard → Variables → Agregar cada variable del `.env.example`:

```
DATABASE_URL          (generada por Railway automáticamente)
JWT_SECRET            (generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_EXPIRES_IN        8h
NODE_ENV              production
CLIENT_URL            https://TU_APP.up.railway.app
PORT                  3001
RTN_EMPRESA           05019009204111
NOMBRE_EMPRESA        INVERSIONES BUENOS AIRES S.A.
CAI_ACTIVO            40BC19-7CF1EF-C2FBE0-63BE03-0909B8-D4
CAI_FECHA_LIMITE      09/10/2026
CAI_RANGO_INICIO      000-009-01-03816501
CAI_RANGO_FIN         000-009-01-04066500
VITE_API_URL          https://TU_APP.up.railway.app/api/v1
```

### 5. Configurar el "Release Command" (migración automática)

En Settings → Deploy → Release Command:
```
cd server && npm run migrate
```

Esto ejecuta `01_schema.sql` y `02_seed.sql` antes de cada deploy.
Es seguro de re-ejecutar (usa `CREATE TABLE IF NOT EXISTS`).

### 6. Build Command y Start Command

Railway detecta el `Procfile` automáticamente. Si no:

- **Build Command:**
  ```
  cd client && npm install && npm run build && cd ../server && npm install
  ```
- **Start Command:**
  ```
  cd server && node src/index.js
  ```

### 7. Primer deploy

```bash
railway up
```

O Railway lo hace automáticamente cuando hacés push a la rama `main`.

---

## Comandos útiles post-deploy

```bash
# Ver logs en tiempo real
railway logs

# Conectarse a la base de datos PostgreSQL de Railway
railway run psql $DATABASE_URL

# Ejecutar migración manualmente
railway run "cd server && npm run migrate"

# Ejecutar seed manualmente (solo si la BD está vacía)
railway run "cd server && npm run seed"

# Abrir la URL del proyecto
railway open
```

---

## Verificar que todo funciona

```bash
# Health check
curl https://TU_APP.up.railway.app/health

# Respuesta esperada:
# {"status":"ok","version":"1.0.0","env":"production","ts":"2026-05-22T..."}

# Test de login
curl -X POST https://TU_APP.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin2024!"}'
```

---

## Deploy en VPS propio (alternativa Railway)

Si preferís un VPS con Ubuntu 22 / 24:

```bash
# 1. Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER posmanual WITH PASSWORD 'tu_password';"
sudo -u postgres psql -c "CREATE DATABASE posmanual OWNER posmanual;"

# 3. Instalar PM2 (process manager)
npm install -g pm2

# 4. Clonar y configurar
git clone https://github.com/TU_USUARIO/posmanual.git
cd posmanual
cp .env.example server/.env
# Editar server/.env con los valores correctos

# 5. Build
cd client && npm install && npm run build
cd ../server && npm install

# 6. Migración
node src/db/migrate.js

# 7. Iniciar con PM2
pm2 start src/index.js --name posmanual
pm2 save
pm2 startup

# 8. Nginx como reverse proxy (opcional)
sudo apt install -y nginx
# Crear /etc/nginx/sites-available/posmanual con:
# location / { proxy_pass http://localhost:3001; }
```

---

## Credenciales iniciales (cambiar en primer login)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin2024!` | ADMINISTRADOR |
| `cajero01`–`cajero06` | `Cajero2024!` | CAJERO |

---

## Checklist de seguridad para producción

- [ ] `JWT_SECRET` es aleatorio y tiene al menos 64 caracteres
- [ ] `NODE_ENV=production` está configurado
- [ ] Contraseñas de los usuarios cambiadas desde el primer login
- [ ] `DATABASE_URL` usa SSL (`?sslmode=require` si tu host lo requiere)
- [ ] El dominio tiene HTTPS activo (Railway lo provee automáticamente)
- [ ] El CAI tiene fecha límite vigente (`CAI_FECHA_LIMITE`)
- [ ] Backups de PostgreSQL configurados (Railway los hace automáticamente en plan Pro)

---

## Estado del proyecto al deploy

| Módulo | Estado |
|---|---|
| Esquema PostgreSQL + Seed | ✅ |
| Autenticación JWT + Guards de rol | ✅ |
| Punto de Venta (POS) | ✅ |
| Turnos / Corte de Caja | ✅ |
| Importación masiva (2 000 artículos) | ✅ |
| Gestión de Artículos CRUD | ✅ |
| Inventario (entradas/salidas/ajustes/Kardex) | ✅ |
| Reportes con exportación Excel + PDF | ✅ |
| Ticket Factura Proforma 80mm | ✅ |
| Cuentas por Cobrar/Pagar | Fase siguiente |
| Bancos | Fase siguiente |
| Gestión de Usuarios (Admin) | Fase siguiente |
