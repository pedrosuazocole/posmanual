# POSManual — Guía de Integración y Pruebas
## DevSys Honduras — Versión Final

---

## Estructura final del proyecto integrado

```
posmanual/
├── client/                          ← React + Vite
│   ├── src/
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx       ← Provider + useAuth hook
│   │   │   └── ProtectedRoute.jsx   ← Guard por rol y módulo
│   │   ├── router/
│   │   │   └── AppRouter.jsx        ← Todas las rutas con guards
│   │   ├── layouts/
│   │   │   └── MainLayout.jsx       ← Sidebar + topbar integrados
│   │   ├── store/
│   │   │   └── posStore.js          ← Zustand: POS + turno activo
│   │   ├── api/
│   │   │   └── axios.js             ← Cliente HTTP con JWT
│   │   ├── hooks/
│   │   │   └── useArticulos.js
│   │   ├── pages/
│   │   │   ├── Login/LoginPage.jsx
│   │   │   ├── POS/POSPage.jsx
│   │   │   ├── Turnos/TurnosPage.jsx
│   │   │   ├── Articulos/ArticulosPage.jsx
│   │   │   ├── Importacion/ImportacionPage.jsx
│   │   │   ├── Inventario/InventarioPage.jsx
│   │   │   ├── Reportes/ReportesPage.jsx
│   │   │   ├── Cuentas/CuentasPage.jsx
│   │   │   ├── Bancos/BancosPage.jsx
│   │   │   ├── Usuarios/UsuariosPage.jsx
│   │   │   └── SinAcceso/SinAccesoPage.jsx
│   │   ├── components/
│   │   │   ├── pos/                 ← CatalogoPanel, FacturaPanel, TicketPreviewModal
│   │   │   └── ui/                  ← ConfirmDialog, Stepper
│   │   ├── tests/
│   │   │   └── unit.test.js         ← Pruebas unitarias Vitest
│   │   └── main.jsx                 ← Entry point React
│   ├── vite.config.js
│   └── package.json
│
├── server/                          ← Express + PostgreSQL
│   ├── src/
│   │   ├── index.js                 ← Entry point — todas las rutas registradas
│   │   ├── db.js                    ← Pool pg con SSL para Railway
│   │   ├── db/
│   │   │   └── migrate.js           ← Corre schema + seed automáticamente
│   │   ├── middlewares/
│   │   │   ├── auth.js              ← Verificar JWT
│   │   │   └── roles.js             ← Guard por rol
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── pos.routes.js        ← articulos, grupos, ventas, turnos
│   │   │   ├── inventario.routes.js
│   │   │   ├── reportes.routes.js
│   │   │   ├── cuentas.routes.js    ← cuentas + bancos
│   │   │   └── usuarios.routes.js
│   │   └── controllers/
│   │       ├── auth.controller.js
│   │       ├── articulos.controller.js
│   │       ├── ventas.controller.js
│   │       ├── turnos.controller.js
│   │       ├── inventario.controller.js
│   │       ├── reportes.controller.js
│   │       ├── cuentas.controller.js
│   │       ├── bancos.controller.js
│   │       └── usuarios.controller.js
│   ├── tests/
│   │   └── integration.test.js      ← Suite Jest + Supertest
│   └── package.json
│
├── 01_schema.sql                    ← Esquema PostgreSQL
├── 02_seed.sql                      ← Usuarios, grupos, bancos iniciales
├── railway.toml
├── Procfile
└── .env.example
```

---

## Instalación y arranque local

```bash
# 1. Base de datos
psql -U postgres -c "CREATE DATABASE posmanual;"
psql -U postgres -d posmanual -f 01_schema.sql
psql -U postgres -d posmanual -f 02_seed.sql

# 2. Backend
cd server
npm install
cp ../.env.example .env    # editar con tu DATABASE_URL y JWT_SECRET
npm run dev                # nodemon → http://localhost:3001

# 3. Frontend (nueva terminal)
cd client
npm install
npm run dev                # Vite → http://localhost:5173
```

---

## Ejecutar pruebas

### Pruebas de integración (backend con Jest + Supertest)

```bash
cd server

# Instalar dependencias de prueba
npm install --save-dev jest supertest

# Agregar en package.json:
# "jest": { "testEnvironment": "node", "testTimeout": 30000 },
# "scripts": { "test": "jest --runInBand --detectOpenHandles --forceExit" }

# IMPORTANTE: crear base de datos de prueba
psql -U postgres -c "CREATE DATABASE posmanual_test;"
psql -U postgres -d posmanual_test -f ../01_schema.sql
psql -U postgres -d posmanual_test -f ../02_seed.sql

# Variable de entorno para test
DATABASE_URL=postgresql://postgres:pass@localhost:5432/posmanual_test npm test

# Con cobertura
npm run test:coverage
```

### Pruebas unitarias (frontend con Vitest)

```bash
cd client

# Instalar Vitest
npm install --save-dev vitest @vitest/coverage-v8 jsdom

# Copia el vite.config.test.js como vite.config.js (agrega sección test)

# Ejecutar pruebas
npx vitest run

# Con UI interactivo
npx vitest --ui

# Con cobertura
npx vitest run --coverage
```

---

## Resumen de la suite de pruebas

### Backend — integration.test.js (45 tests)

| Módulo | Tests | Cubre |
|---|---|---|
| Auth | 6 | Login correcto/incorrecto, JWT, /me |
| Usuarios | 5 | CRUD admin, duplicados, permisos |
| Artículos | 7 | CRUD, búsqueda, guard cajero |
| Turnos | 5 | Apertura, doble apertura, activo |
| Ventas | 6 | Factura normal, manual, turno inválido, anulación |
| Inventario | 6 | Entrada, salida, servicio, alertas, Kardex |
| Cuentas | 7 | Crear, pago parcial, pago total, overflow |
| Bancos | 5 | Crear, depósito, tipo inválido, movimientos |
| Turno cierre | 2 | Cierre con arqueo, verificación |
| Health | 1 | /health → ok |

### Frontend — unit.test.js (30 tests)

| Suite | Tests | Cubre |
|---|---|---|
| calcTotales | 7 | ISV 15%, 18%, exento, cantidades, cambio |
| validarFila | 7 | Errores de importación Excel |
| calcularEstadisticas | 5 | Grupos, servicios, ISV, errores |
| Validaciones formularios | 9 | Login, artículos, movimientos |
| numLetras | 6 | Importes en Lempiras para el ticket |

**Total: 75 pruebas**

---

## Flujo de prueba manual (smoke test)

Seguí este orden para verificar el sistema completo:

```
1. Login como admin / Admin2024!
   → Verificar que aparece el dashboard con todos los módulos

2. Abrir turno de caja
   → Turnos → Abrir turno → Fondo: L. 2,000

3. Ir al POS y facturar
   → Buscar "COCA COLA" → agregar → ISV 15% visible
   → Cambiar a "DIESEL PISTA" → abre modal manual (precio 0)
   → Emitir → aparece número de factura
   → Vista previa del ticket → imprimir

4. Importar catálogo
   → Artículos → Importar → subir articulo.xlsx
   → Paso 2: verificar 2000 filas, grupos detectados
   → Importar → confirmar resultado

5. Registrar movimiento de inventario
   → Inventario → Nuevo movimiento → ENTRADA → COCA COLA → 50 unidades
   → Verificar Kardex actualizado

6. Crear cuenta por cobrar
   → Cuentas → Por cobrar → Nueva → L. 5,000 → vencimiento 30/06/2026
   → Registrar pago parcial L. 2,000 → estado → PARCIAL

7. Ver reportes
   → Master de Ventas → generar → exportar Excel
   → Corte de Caja → seleccionar turno activo → generar

8. Cerrar turno
   → Turnos → Cerrar → declarar efectivo → confirmar

9. Verificar como cajero01
   → Logout → Login cajero01 / Cajero2024!
   → Módulos sin acceso bloqueados (Reportes, Usuarios, Bancos)
   → Solo POS y Turnos disponibles
```

---

## Variables de entorno para pruebas

```bash
# .env.test (solo para la suite de pruebas)
DATABASE_URL=postgresql://postgres:pass@localhost:5432/posmanual_test
JWT_SECRET=test_secret_posmanual_jest_no_usar_en_produccion
JWT_EXPIRES_IN=1h
NODE_ENV=test
PORT=3001
```

---

## Checklist de integración completa

### Backend
- [ ] `server/src/index.js` registra las 6 rutas en el orden correcto
- [ ] `AUTH_SECRET` tiene 64+ caracteres
- [ ] `DATABASE_URL` apunta a la BD correcta
- [ ] `npm run migrate` ejecuta sin errores
- [ ] `GET /health` responde `{"status":"ok"}`
- [ ] Login con `admin / Admin2024!` devuelve token
- [ ] Login con `cajero01 / Cajero2024!` devuelve token

### Frontend
- [ ] `AppRouter.jsx` tiene las 9 rutas protegidas
- [ ] `MainLayout.jsx` filtra el sidebar según `puede()`
- [ ] `VITE_API_URL` apunta al backend correcto
- [ ] `npm run build` compila sin errores
- [ ] `client/dist/` tiene `index.html`

### Pruebas
- [ ] `npm test` en `/server` pasa los 45 tests
- [ ] `npx vitest run` en `/client` pasa los 30 tests
- [ ] Cobertura backend ≥ 80%
- [ ] Cobertura frontend ≥ 70%

### Railway
- [ ] Variables de entorno configuradas en el dashboard
- [ ] Release Command: `cd server && npm run migrate`
- [ ] Health check responde desde la URL de producción
- [ ] Login funciona desde la URL pública

---

## Credenciales iniciales (cambiar en producción)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin2024!` | ADMINISTRADOR |
| `cajero01`–`cajero06` | `Cajero2024!` | CAJERO |
