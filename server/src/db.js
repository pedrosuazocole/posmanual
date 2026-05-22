/**
 * POSManual - DevSys Honduras
 * ─── 1. Middleware de roles ──────────────────────────────────
 * Archivo: server/src/middlewares/roles.js
 *
 * Uso: roles(['ADMINISTRADOR','SUPERVISOR'])
 * Aplica DESPUÉS del middleware auth.js (que ya validó el JWT y
 * pobló req.user con { id, username, rol, permisos })
 */
module.exports = function roles(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        message: `Acceso denegado. Se requiere uno de: ${rolesPermitidos.join(', ')}`,
        tuRol: req.user.rol,
      });
    }
    next();
  };
};

/*
 * ─── 2. Rutas de autenticación ──────────────────────────────
 * Archivo: server/src/routes/auth.routes.js
 */
const router  = require('express').Router();
const auth    = require('../middlewares/auth');
const ctrl    = require('../controllers/auth.controller');

// POST /api/v1/auth/login            → pública
router.post('/login',            ctrl.login);
// GET  /api/v1/auth/me               → requiere token
router.get('/me',                auth, ctrl.me);
// POST /api/v1/auth/cambiar-password → requiere token
router.post('/cambiar-password', auth, ctrl.cambiarPassword);

module.exports = router;

/*
 * ─── 3. Entry point Express ─────────────────────────────────
 * Archivo: server/src/index.js
 *
 * Arranca el servidor con todas las rutas registradas.
 * Compatible con Railway (usa process.env.PORT).
 */
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');

const app = express();

// ── Middlewares globales ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rutas ────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth.routes');
const posRoutes       = require('./routes/pos.routes');       // articulos, grupos, ventas, turnos
const reportesRoutes  = require('./routes/reportes.routes');

app.use('/api/v1/auth',       authRoutes);
app.use('/api/v1',            posRoutes);
app.use('/api/v1/reportes',   reportesRoutes);

// ── Health check para Railway ────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Manejador de errores global ──────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' });
});

// ── Iniciar ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ POSManual API corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

/*
 * ─── 4. db.js — Pool de PostgreSQL ──────────────────────────
 * Archivo: server/src/db.js
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL requerido en Railway y la mayoría de hosts PaaS
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max:              10,
  idleTimeoutMillis:30000,
  connectionTimeoutMillis:2000,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = { pool };
