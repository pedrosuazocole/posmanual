/**
 * POSManual - DevSys Honduras
 * Controlador + Rutas: Inventario
 * Archivo: server/src/controllers/inventario.controller.js
 *          server/src/routes/inventario.routes.js
 *
 * Principio atómico: cada movimiento actualiza stock y registra
 * en movimientos_inventario dentro de una sola transacción.
 */

/* ═══════════════════════════════════════════════════════════
   RUTAS
   Archivo: server/src/routes/inventario.routes.js
═══════════════════════════════════════════════════════════ */
const router = require('express').Router();
const auth   = require('../middlewares/auth');
const roles  = require('../middlewares/roles');
const ctrl   = require('../controllers/inventario.controller');

// Stock actual con resumen
// GET /api/v1/inventario/stock?q=&grupo_id=&estado=&page=&limit=
router.get('/stock', auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.stock);

// Movimientos con filtros
// GET /api/v1/inventario/movimientos?q=&tipo=&referencia_tipo=&fecha_ini=&fecha_fin=
