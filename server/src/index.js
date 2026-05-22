/**
 * POSManual - DevSys Honduras
 * Entry point del servidor — VERSIÓN INTEGRADA FINAL
 * Archivo: server/src/index.js
 *
 * Registra todas las rutas del sistema en el orden correcto.
 * En producción (NODE_ENV=production) sirve también el build de React.
 */
require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const path        = require('path');

const app = express();

// ── Middlewares globales ──────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({
  origin:         process.env.CLIENT_URL || 'http://localhost:5173',
  credentials:    true,
  methods:        ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Rutas API ─────────────────────────────────────────────────
app.use('/api/v1/auth',       require('./routes/auth.routes'));
app.use('/api/v1',            require('./routes/pos.routes'));       // articulos, grupos, ventas, turnos
app.use('/api/v1/inventario', require('./routes/inventario.routes'));
app.use('/api/v1/reportes',   require('./routes/reportes.routes'));
app.use('/api/v1',            require('./routes/cuentas.routes'));   // cuentas, bancos
app.use('/api/v1/usuarios',   require('./routes/usuarios.routes'));

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status:  'ok',
  version: process.env.npm_package_version || '1.0.0',
  ts:      new Date().toISOString(),
  env:     process.env.NODE_ENV,
}));

// ── Servir React en producción ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'Endpoint no encontrado' });
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// ── Manejador de errores global ───────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
});

// ── Iniciar ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ POSManual API corriendo en http://0.0.0.0:${PORT}`);
  console.log(`   Entorno:    ${process.env.NODE_ENV || 'development'}`);
  console.log(`   PostgreSQL: ${process.env.DATABASE_URL ? '✓ configurado' : '✗ falta DATABASE_URL'}`);
  console.log(`   JWT Secret: ${process.env.JWT_SECRET ? '✓ configurado' : '✗ falta JWT_SECRET'}\n`);
});

module.exports = app;
