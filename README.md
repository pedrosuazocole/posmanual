# POSManual
### Sistema de Punto de Venta — DevSys Honduras
**Cliente:** Inversiones Buenos Aires S.A. · San Pedro Sula, Honduras

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Zustand + TanStack Query |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Autenticación | JWT + bcrypt |
| Deploy | Railway (monorepo) |

---

## Módulos implementados

- **Punto de Venta** — Facturación con ISV 15%/18%, artículos manuales, ticket Proforma 80mm
- **Turnos / Corte de Caja** — Apertura, arqueo y cierre con cuadre de efectivo
- **Artículos** — CRUD completo, flag `no_usar_existencia` para servicios
- **Importación masiva** — Carga de 2 000+ artículos desde Excel con creación automática de grupos
- **Inventario** — Entradas, salidas, ajustes, Kardex y alertas de stock mínimo
- **Reportes** — Master de ventas, corte de caja, por grupo y por artículo (Excel + PDF)
- **Cuentas por Cobrar/Pagar** — Registro de cuentas, pagos parciales y liquidación
- **Bancos** — Cuentas bancarias y movimientos con saldo en tiempo real
- **Usuarios** — CRUD con roles (Administrador / Supervisor / Cajero) y permisos granulares

---

## Instalación rápida

```bash
# Base de datos
psql -U postgres -c "CREATE DATABASE posmanual;"
psql -U postgres -d posmanual -f 01_schema.sql
psql -U postgres -d posmanual -f 02_seed.sql

# Backend
cd server && npm install
cp ../.env.example server/.env   # completar variables
npm run dev

# Frontend
cd client && npm install
npm run dev
```

## Pruebas

```bash
# Unitarias (frontend)
cd client && npx vitest run

# Integración (backend)
cd server && npm test
```

## Deploy en Railway

Ver [`DEPLOY_GUIDE.md`](./DEPLOY_GUIDE.md) para instrucciones completas.

---

## Credenciales iniciales

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `Admin2024!` | Administrador |
| `cajero01`–`cajero06` | `Cajero2024!` | Cajero |

> Cambiar contraseñas en el primer login.

---

*DevSys Honduras · 2026*
