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
router.put('/bancos/:id',             auth, roles(['ADMINISTRADOR']), bc.actualizar);
// GET  /api/v1/bancos/movimientos?banco_id=&tipo=&fecha_ini=&fecha_fin=
router.get('/bancos/movimientos',     auth, roles(SV), bc.listarMovimientos);
// POST /api/v1/bancos/movimientos   ← nuevo movimiento (atómico)
router.post('/bancos/movimientos',    auth, roles(SV), bc.registrarMovimiento);

module.exports = router;


/**
 * ═══ CONTROLADOR CUENTAS ════════════════════════════════════
 * Archivo: server/src/controllers/cuentas.controller.js
 */
const { pool } = require('../db');

exports.listar = async (req, res) => {
  const { tipo, q, estado, page=1, limit=50 } = req.query;
  const params=[], wheres=[];
  if(tipo)   { params.push(tipo);    wheres.push(`c.tipo=$${params.length}`); }
  if(estado) { params.push(estado);  wheres.push(`c.estado=$${params.length}`); }
  if(q)      { wheres.push(`(c.tercero_nombre ILIKE $${params.push('%'+q+'%')} OR c.descripcion ILIKE $${params.push('%'+q+'%')})`); }
  const where = wheres.length ? 'WHERE '+wheres.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      `SELECT c.*, COUNT(*) OVER() AS total_registros
       FROM cuentas c ${where}
       ORDER BY
         CASE c.estado WHEN 'VENCIDO' THEN 1 WHEN 'PENDIENTE' THEN 2 WHEN 'PARCIAL' THEN 3 ELSE 4 END,
         c.fecha_vencimiento NULLS LAST
       LIMIT $${params.push(+limit)} OFFSET $${params.push((+page-1)*+limit)}`,
      params
    );
    return res.json(rows);
  } catch(err){ return res.status(500).json({message:'Error al listar cuentas'}); }
};

exports.historialPagos = async (req,res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.tipo AS cuenta_tipo, c.tercero_nombre,
              u.nombre_completo AS usuario_nombre
       FROM pagos_cuentas p
       JOIN cuentas  c ON c.id = p.cuenta_id
       JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.pagado_en DESC LIMIT 200`
    );
    return res.json(rows);
  } catch(err){ return res.status(500).json({message:'Error en historial'}); }
};

exports.obtener = async (req,res) => {
  try {
    const {rows:[c]} = await pool.query('SELECT * FROM cuentas WHERE id=$1',[req.params.id]);
    if(!c) return res.status(404).json({message:'Cuenta no encontrada'});
    const {rows:pagos} = await pool.query(
      `SELECT p.*, u.nombre_completo AS usuario_nombre FROM pagos_cuentas p
       JOIN usuarios u ON u.id=p.usuario_id WHERE p.cuenta_id=$1 ORDER BY p.pagado_en DESC`,
      [c.id]
    );
    return res.json({...c, pagos});
  } catch(err){ return res.status(500).json({message:'Error al obtener cuenta'}); }
};

exports.crear = async (req,res) => {
  const { tipo,tercero_nombre,tercero_rtn,descripcion,monto_total,fecha_vencimiento,proveedor_id,referencia_venta_id } = req.body;
  if(!tipo||!tercero_nombre||!descripcion||!monto_total)
    return res.status(400).json({message:'tipo, tercero_nombre, descripcion y monto_total son obligatorios'});
  try {
    const {rows:[c]} = await pool.query(
      `INSERT INTO cuentas (tipo,tercero_nombre,tercero_rtn,descripcion,monto_total,fecha_vencimiento,proveedor_id,referencia_venta_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tipo,tercero_nombre,tercero_rtn||null,descripcion,+monto_total,fecha_vencimiento||null,proveedor_id||null,referencia_venta_id||null]
    );
    return res.status(201).json(c);
  } catch(err){ return res.status(500).json({message:'Error al crear cuenta'}); }
};

exports.actualizar = async (req,res) => {
  const fields=['tercero_nombre','tercero_rtn','descripcion','monto_total','fecha_vencimiento'];
  const updates=[], params=[];
  fields.forEach(f=>{ if(req.body[f]!==undefined){ params.push(req.body[f]); updates.push(`${f}=$${params.length}`); }});
  if(!updates.length) return res.status(400).json({message:'Nada que actualizar'});
  params.push(req.params.id);
  try {
    const {rows:[c]} = await pool.query(
      `UPDATE cuentas SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`,params
    );
    if(!c) return res.status(404).json({message:'Cuenta no encontrada'});
    return res.json(c);
  } catch(err){ return res.status(500).json({message:'Error al actualizar cuenta'}); }
};

exports.registrarPago = async (req,res) => {
  const {monto, metodo_pago='EFECTIVO', observaciones} = req.body;
  if(!monto||+monto<=0) return res.status(400).json({message:'El monto debe ser mayor a 0'});
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows:[c]} = await client.query(
      'SELECT * FROM cuentas WHERE id=$1 FOR UPDATE', [req.params.id]
    );
    if(!c) throw new Error('Cuenta no encontrada');
    if(c.estado==='PAGADO') throw new Error('Esta cuenta ya está completamente pagada');
    const saldo = +c.monto_total - +c.monto_pagado;
    if(+monto > saldo+0.01) throw new Error(`El monto (L.${(+monto).toFixed(2)}) supera el saldo (L.${saldo.toFixed(2)})`);
    const nuevoMontoPagado = +c.monto_pagado + +monto;
    const nuevoEstado = nuevoMontoPagado >= +c.monto_total-0.01 ? 'PAGADO' : 'PARCIAL';
    await client.query(
      'UPDATE cuentas SET monto_pagado=$1, estado=$2 WHERE id=$3',
      [nuevoMontoPagado, nuevoEstado, c.id]
    );
    const {rows:[pago]} = await client.query(
      `INSERT INTO pagos_cuentas (cuenta_id,monto,metodo_pago,usuario_id,observaciones)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [c.id, +monto, metodo_pago, req.user.id, observaciones||null]
    );
    await client.query('COMMIT');
    return res.status(201).json({...pago, nuevo_estado:nuevoEstado, saldo_restante:Math.max(0,saldo-+monto)});
  } catch(err){
    await client.query('ROLLBACK');
    return res.status(400).json({message:err.message});
  } finally { client.release(); }
};


/**
 * ═══ CONTROLADOR BANCOS ═════════════════════════════════════
 * Archivo: server/src/controllers/bancos.controller.js
 */
exports.listar = async (req,res) => {
  try {
    const {rows} = await pool.query(
      `SELECT b.*, b.saldo_inicial +
         COALESCE(SUM(CASE WHEN t.tipo IN ('DEPOSITO','COBRO_CLIENTE') THEN t.monto
                          ELSE -t.monto END),0) AS saldo_actual
       FROM bancos b LEFT JOIN transacciones_bancarias t ON t.banco_id=b.id
       WHERE b.activo=TRUE GROUP BY b.id ORDER BY b.nombre`
    );
    return res.json(rows);
  } catch(err){ return res.status(500).json({message:'Error al listar bancos'}); }
};

exports.crear = async (req,res) => {
  const {nombre,numero_cuenta,saldo_inicial=0} = req.body;
  if(!nombre?.trim()) return res.status(400).json({message:'El nombre es obligatorio'});
  try {
    const {rows:[b]} = await pool.query(
      'INSERT INTO bancos (nombre,numero_cuenta,saldo_inicial) VALUES ($1,$2,$3) RETURNING *',
      [nombre.trim(), numero_cuenta||null, +saldo_inicial]
    );
    return res.status(201).json({...b, saldo_actual:+saldo_inicial});
  } catch(err){ return res.status(500).json({message:'Error al crear banco'}); }
};

exports.actualizar = async (req,res) => {
  const {nombre,numero_cuenta,activo} = req.body;
  const updates=[], params=[];
  if(nombre!==undefined){ params.push(nombre); updates.push(`nombre=$${params.length}`); }
  if(numero_cuenta!==undefined){ params.push(numero_cuenta); updates.push(`numero_cuenta=$${params.length}`); }
  if(activo!==undefined){ params.push(activo); updates.push(`activo=$${params.length}`); }
  if(!updates.length) return res.status(400).json({message:'Nada que actualizar'});
  params.push(req.params.id);
  try {
    const {rows:[b]} = await pool.query(
      `UPDATE bancos SET ${updates.join(',')} WHERE id=$${params.length} RETURNING *`,params
    );
    if(!b) return res.status(404).json({message:'Banco no encontrado'});
    return res.json(b);
  } catch(err){ return res.status(500).json({message:'Error al actualizar banco'}); }
};

exports.listarMovimientos = async (req,res) => {
  const {banco_id,q,tipo,fecha_ini,fecha_fin,limit=200} = req.query;
  const params=[], wheres=[];
  if(banco_id){ params.push(+banco_id); wheres.push(`t.banco_id=$${params.length}`); }
  if(tipo)    { params.push(tipo);      wheres.push(`t.tipo=$${params.length}`); }
  if(fecha_ini){ params.push(fecha_ini); wheres.push(`t.creado_en>=$${params.length}`); }
  if(fecha_fin){ params.push(fecha_fin); wheres.push(`t.creado_en<=$${params.length}::date+1`); }
  if(q){ wheres.push(`(t.descripcion ILIKE $${params.push('%'+q+'%')} OR t.referencia ILIKE $${params.push('%'+q+'%')})`); }
  const where=wheres.length?'WHERE '+wheres.join(' AND '):'';
  try {
    const {rows} = await pool.query(
      `SELECT t.*, u.nombre_completo AS usuario_nombre,
              SUM(CASE WHEN tt.tipo IN ('DEPOSITO','COBRO_CLIENTE') THEN tt.monto ELSE -tt.monto END)
                OVER (PARTITION BY t.banco_id ORDER BY t.creado_en, t.id) +
                b.saldo_inicial AS saldo_nuevo
       FROM transacciones_bancarias t
       JOIN bancos   b ON b.id=t.banco_id
       JOIN usuarios u ON u.id=t.usuario_id
       JOIN transacciones_bancarias tt ON tt.banco_id=t.banco_id AND tt.id<=t.id
       ${where.replace(/t\./g,'t.').replace('WHERE','WHERE')}
       ORDER BY t.creado_en DESC LIMIT $${params.push(+limit)}`,
      params
    );
    return res.json(rows);
  } catch(err){ return res.status(500).json({message:'Error al listar movimientos'}); }
};

exports.registrarMovimiento = async (req,res) => {
  const {banco_id,tipo,monto,referencia,descripcion} = req.body;
  const TIPOS_VALIDOS=['DEPOSITO','RETIRO','TRANSFERENCIA','PAGO_PROVEEDOR','COBRO_CLIENTE'];
  if(!banco_id||!tipo||!monto)   return res.status(400).json({message:'banco_id, tipo y monto son obligatorios'});
  if(!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({message:'Tipo inválido'});
  if(+monto<=0)                   return res.status(400).json({message:'El monto debe ser mayor a 0'});
  try {
    const {rows:[t]} = await pool.query(
      `INSERT INTO transacciones_bancarias (banco_id,tipo,monto,descripcion,referencia,usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [+banco_id,tipo,+monto,descripcion||tipo,referencia||null,req.user.id]
    );
    return res.status(201).json(t);
  } catch(err){ return res.status(500).json({message:'Error al registrar movimiento'}); }
};
