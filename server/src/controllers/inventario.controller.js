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
router.get('/movimientos', auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.listarMovimientos);

// Kardex de un artículo específico
// GET /api/v1/inventario/kardex/:articulo_id
router.get('/kardex/:articulo_id', auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.kardex);

// Alertas: artículos con stock <= stock_minimo
// GET /api/v1/inventario/alertas
router.get('/alertas', auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.alertas);

// NUEVO MOVIMIENTO (atómico)
// POST /api/v1/inventario/movimientos
router.post('/movimientos', auth, roles(['ADMINISTRADOR','SUPERVISOR']), ctrl.registrarMovimiento);

module.exports = router;


/* ═══════════════════════════════════════════════════════════
   CONTROLADOR
   Archivo: server/src/controllers/inventario.controller.js
═══════════════════════════════════════════════════════════ */
const { pool } = require('../db');

/* ── GET /inventario/stock ────────────────────────────────── */
exports.stock = async (req, res) => {
  const { q, grupo_id, estado, page = 1, limit = 30 } = req.query;
  const offset = (+page - 1) * +limit;
  const params = [];
  const wheres = ['a.activo = TRUE'];

  if (q)       wheres.push(`(a.nombre ILIKE $${params.push('%'+q+'%')} OR a.codigo ILIKE $${params.push('%'+q+'%')})`);
  if (grupo_id) wheres.push(`a.grupo_id = $${params.push(+grupo_id)}`);
  if (estado === 'bajo')  wheres.push('a.no_usar_existencia = FALSE AND a.stock_actual <= a.stock_minimo');
  if (estado === 'ok')    wheres.push('a.no_usar_existencia = FALSE AND a.stock_actual > a.stock_minimo');
  if (estado === 'srv')   wheres.push('a.no_usar_existencia = TRUE');

  try {
    const { rows } = await pool.query(
      `SELECT a.*, g.nombre AS grupo_nombre,
              COUNT(*) OVER() AS total_registros
       FROM articulos a LEFT JOIN grupos g ON g.id = a.grupo_id
       WHERE ${wheres.join(' AND ')}
       ORDER BY a.nombre
       LIMIT $${params.push(+limit)} OFFSET $${params.push(offset)}`,
      params
    );

    // Resumen global (sin filtros de paginación)
    const { rows: [r] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT no_usar_existencia)  AS total_articulos,
         COALESCE(SUM(precio_costo * stock_actual) FILTER (WHERE NOT no_usar_existencia), 0) AS valor_total,
         COUNT(*) FILTER (WHERE NOT no_usar_existencia AND stock_actual <= stock_minimo) AS bajo_minimo,
         COUNT(*) FILTER (WHERE no_usar_existencia) AS servicios
       FROM articulos WHERE activo = TRUE`
    );

    return res.json({
      data:    rows,
      total:   +(rows[0]?.total_registros ?? 0),
      resumen: {
        total_articulos: +r.total_articulos,
        valor_total:     +r.valor_total,
        bajo_minimo:     +r.bajo_minimo,
        servicios:       +r.servicios,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error consultando stock' });
  }
};

/* ── GET /inventario/movimientos ─────────────────────────── */
exports.listarMovimientos = async (req, res) => {
  const { q, tipo, referencia_tipo, fecha_ini, fecha_fin, limit = 200 } = req.query;
  const params = [];
  const wheres = [];

  if (q)               wheres.push(`(a.nombre ILIKE $${params.push('%'+q+'%')} OR a.codigo ILIKE $${params.push('%'+q+'%')})`);
  if (tipo)            wheres.push(`m.tipo = $${params.push(tipo)}`);
  if (referencia_tipo) wheres.push(`m.referencia_tipo = $${params.push(referencia_tipo)}`);
  if (fecha_ini)       wheres.push(`m.creado_en >= $${params.push(fecha_ini)}`);
  if (fecha_fin)       wheres.push(`m.creado_en <= $${params.push(fecha_fin)}::date + 1`);

  const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      `SELECT m.*, a.nombre AS articulo_nombre, a.codigo AS articulo_codigo,
              u.nombre_completo AS usuario_nombre,
              p.nombre AS proveedor_nombre
       FROM movimientos_inventario m
       JOIN articulos a ON a.id = m.articulo_id
       JOIN usuarios  u ON u.id = m.usuario_id
       LEFT JOIN proveedores p ON p.id = m.proveedor_id
       ${where}
       ORDER BY m.creado_en DESC
       LIMIT $${params.push(+limit)}`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error listando movimientos' });
  }
};

/* ── GET /inventario/kardex/:articulo_id ─────────────────── */
exports.kardex = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.*, u.nombre_completo AS usuario_nombre
       FROM movimientos_inventario m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.articulo_id = $1
       ORDER BY m.creado_en ASC`,
      [req.params.articulo_id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error cargando Kardex' });
  }
};

/* ── GET /inventario/alertas ─────────────────────────────── */
exports.alertas = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, g.nombre AS grupo_nombre
       FROM articulos a LEFT JOIN grupos g ON g.id = a.grupo_id
       WHERE a.activo = TRUE
         AND a.no_usar_existencia = FALSE
         AND a.stock_actual <= a.stock_minimo
       ORDER BY a.stock_actual ASC, a.nombre`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error consultando alertas' });
  }
};

/* ── POST /inventario/movimientos ────────────────────────── */
exports.registrarMovimiento = async (req, res) => {
  const {
    articulo_id, tipo, cantidad, costo_unitario,
    referencia_tipo = 'AJUSTE_MANUAL', referencia_id,
    proveedor_id, observaciones,
  } = req.body;

  // Validaciones básicas
  if (!articulo_id)                                 return res.status(400).json({ message: 'articulo_id es obligatorio' });
  if (!tipo)                                        return res.status(400).json({ message: 'tipo es obligatorio' });
  if (!cantidad || +cantidad <= 0)                  return res.status(400).json({ message: 'cantidad debe ser mayor a 0' });

  const TIPOS_VALIDOS = ['ENTRADA','SALIDA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','MERMA','TRANSFERENCIA'];
  if (!TIPOS_VALIDOS.includes(tipo))                return res.status(400).json({ message: `tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener artículo (con FOR UPDATE para evitar race conditions)
    const { rows: [art] } = await client.query(
      'SELECT id, nombre, stock_actual, no_usar_existencia FROM articulos WHERE id=$1 AND activo=TRUE FOR UPDATE',
      [articulo_id]
    );
    if (!art)                    throw new Error('Artículo no encontrado o inactivo');
    if (art.no_usar_existencia)  throw new Error('Este artículo es un servicio y no maneja existencias');

    // 2. Calcular nuevo stock
    const esPositivo = ['ENTRADA','AJUSTE_POSITIVO'].includes(tipo);
    const esNegativo = ['SALIDA','AJUSTE_NEGATIVO','MERMA'].includes(tipo);
    const stockAnterior = +art.stock_actual;
    let   stockNuevo    = stockAnterior;

    if (esPositivo) {
      stockNuevo = stockAnterior + +cantidad;
    } else if (esNegativo) {
      stockNuevo = Math.max(0, stockAnterior - +cantidad);
      // Advertencia (no error) si stock resultante es negativo
      if (stockAnterior - +cantidad < 0) {
        console.warn(`[inventario] Stock de "${art.nombre}" quedará en 0 (insuficiente: ${stockAnterior} < ${cantidad})`);
      }
    }
    // TRANSFERENCIA no modifica el stock del artículo origen directamente

    // 3. Actualizar stock del artículo
    await client.query(
      'UPDATE articulos SET stock_actual=$1, actualizado_en=NOW() WHERE id=$2',
      [stockNuevo, articulo_id]
    );

    // 4. Insertar movimiento en el registro de auditoría
    const { rows: [mov] } = await client.query(
      `INSERT INTO movimientos_inventario
         (articulo_id, tipo, cantidad, costo_unitario, stock_anterior, stock_nuevo,
          referencia_tipo, referencia_id, proveedor_id, usuario_id, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        articulo_id, tipo, +cantidad,
        costo_unitario ? +costo_unitario : null,
        stockAnterior, stockNuevo,
        referencia_tipo, referencia_id || null,
        proveedor_id   || null,
        req.user.id,
        observaciones  || null,
      ]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      ...mov,
      articulo_nombre: art.nombre,
      message: `Movimiento registrado: ${art.nombre} → ${stockAnterior} → ${stockNuevo}`,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[inventario.registrarMovimiento]', err.message);
    return res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};
