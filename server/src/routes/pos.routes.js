/**
 * POSManual - DevSys Honduras
 * Rutas Express: Artículos, Grupos y Ventas
 * Archivo: server/src/routes/pos.routes.js
 */
const router = require('express').Router();
const auth   = require('../middlewares/auth');
const roles  = require('../middlewares/roles');
const artCtrl   = require('../controllers/articulos.controller');
const gruCtrl   = require('../controllers/grupos.controller');
const ventCtrl  = require('../controllers/ventas.controller');
const turnoCtrl = require('../controllers/turnos.controller');

// ── ARTÍCULOS ──────────────────────────────────────────────
// GET /api/v1/articulos?q=texto&grupo_id=5&page=1&limit=50
router.get('/articulos',
  auth,
  artCtrl.listar
);

// GET /api/v1/articulos/codigo/:codigo  (búsqueda por barcode)
router.get('/articulos/codigo/:codigo',
  auth,
  artCtrl.buscarPorCodigo
);

// GET /api/v1/articulos/:id
router.get('/articulos/:id',
  auth,
  artCtrl.obtener
);

// POST /api/v1/articulos (Admin/Supervisor)
router.post('/articulos',
  auth, roles(['ADMINISTRADOR', 'SUPERVISOR']),
  artCtrl.crear
);

// PUT /api/v1/articulos/:id
router.put('/articulos/:id',
  auth, roles(['ADMINISTRADOR', 'SUPERVISOR']),
  artCtrl.actualizar
);

// DELETE /api/v1/articulos/:id  (solo desactiva, no borra)
router.delete('/articulos/:id',
  auth, roles(['ADMINISTRADOR']),
  artCtrl.desactivar
);

// POST /api/v1/articulos/importar  (carga masiva Excel)
router.post('/articulos/importar',
  auth, roles(['ADMINISTRADOR', 'SUPERVISOR']),
  artCtrl.importar  // usa multer + importarArticulos.js
);

// GET /api/v1/articulos/plantilla  (descarga CSV de plantilla)
router.get('/articulos/plantilla',
  auth,
  artCtrl.descargarPlantilla
);

// ── GRUPOS ─────────────────────────────────────────────────
router.get('/grupos',        auth, gruCtrl.listar);
router.post('/grupos',       auth, roles(['ADMINISTRADOR','SUPERVISOR']), gruCtrl.crear);
router.put('/grupos/:id',    auth, roles(['ADMINISTRADOR','SUPERVISOR']), gruCtrl.actualizar);
router.delete('/grupos/:id', auth, roles(['ADMINISTRADOR']),              gruCtrl.desactivar);

// ── VENTAS ─────────────────────────────────────────────────
// POST /api/v1/ventas  — emitir factura (operación atómica)
router.post('/ventas',
  auth, roles(['ADMINISTRADOR', 'SUPERVISOR', 'CAJERO']),
  ventCtrl.crear
);

// GET /api/v1/ventas?fecha_ini=&fecha_fin=&cajero_id=&estado=
router.get('/ventas',
  auth, roles(['ADMINISTRADOR', 'SUPERVISOR']),
  ventCtrl.listar
);

// GET /api/v1/ventas/:id
router.get('/ventas/:id',
  auth,
  ventCtrl.obtener
);

// POST /api/v1/ventas/:id/anular  (requiere Supervisor)
router.post('/ventas/:id/anular',
  auth, roles(['ADMINISTRADOR', 'SUPERVISOR']),
  ventCtrl.anular
);

// ── TURNOS ─────────────────────────────────────────────────
// GET  /api/v1/turnos/activo   — turno del cajero en sesión
router.get('/turnos/activo',  auth, turnoCtrl.obtenerActivo);
router.post('/turnos/abrir',  auth, roles(['ADMINISTRADOR','SUPERVISOR','CAJERO']), turnoCtrl.abrir);
router.post('/turnos/cerrar', auth, roles(['ADMINISTRADOR','SUPERVISOR','CAJERO']), turnoCtrl.cerrar);
router.get('/turnos/:id',     auth, turnoCtrl.obtener);
router.get('/turnos',         auth, roles(['ADMINISTRADOR','SUPERVISOR']), turnoCtrl.listar);

module.exports = router;
