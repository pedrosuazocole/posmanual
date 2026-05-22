/**
 * POSManual - DevSys Honduras
 * Rutas y controlador: Reportes + PDF de factura
 * Archivo: server/src/routes/reportes.routes.js + controllers/reportes.controller.js
 */

/* ── RUTAS ─────────────────────────────────────────────────── */
// reportes.routes.js
const router     = require('express').Router();
const auth       = require('../middlewares/auth');
const roles      = require('../middlewares/roles');
const ctrl       = require('../controllers/reportes.controller');

// GET /api/v1/reportes/grupos?fecha_ini=&fecha_fin=
router.get('/grupos',    auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.ventasPorGrupo);
// GET /api/v1/reportes/articulos?fecha_ini=&fecha_fin=&grupo_id=
router.get('/articulos', auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.ventasPorArticulo);
// GET /api/v1/ventas/:id/pdf  — genera PDF Puppeteer
router.get('/ventas/:id/pdf', auth, ctrl.generarPdf);

