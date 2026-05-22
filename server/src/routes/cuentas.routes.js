/**
 * POSManual - DevSys Honduras
 * Backend: Cuentas por Cobrar/Pagar + Bancos
 *
 * ═══ RUTAS ═══════════════════════════════════════════════════
 * Archivo: server/src/routes/cuentas.routes.js
 */
const router = require('express').Router();
const auth   = require('../middlewares/auth');
const roles  = require('../middlewares/roles');
const cc     = require('../controllers/cuentas.controller');
const bc     = require('../controllers/bancos.controller');

const SV = ['ADMINISTRADOR','SUPERVISOR'];

// ── CUENTAS ──────────────────────────────────────────────────
// GET  /api/v1/cuentas?tipo=COBRAR&q=&estado=
router.get('/cuentas',                auth, roles(SV), cc.listar);
// GET  /api/v1/cuentas/pagos
router.get('/cuentas/pagos',          auth, roles(SV), cc.historialPagos);
// GET  /api/v1/cuentas/:id
router.get('/cuentas/:id',            auth, roles(SV), cc.obtener);
// POST /api/v1/cuentas
router.post('/cuentas',               auth, roles(SV), cc.crear);
// PUT  /api/v1/cuentas/:id
router.put('/cuentas/:id',            auth, roles(SV), cc.actualizar);
// POST /api/v1/cuentas/:id/pagar   ← registro de pago (atómico)
router.post('/cuentas/:id/pagar',     auth, roles(SV), cc.registrarPago);

// ── BANCOS ───────────────────────────────────────────────────
// GET  /api/v1/bancos
router.get('/bancos',                 auth, roles(SV), bc.listar);
// POST /api/v1/bancos
router.post('/bancos',                auth, roles(['ADMINISTRADOR']), bc.crear);
// PUT  /api/v1/bancos/:id
