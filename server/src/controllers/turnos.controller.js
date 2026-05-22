/**
 * POSManual - DevSys Honduras
 * Controlador: Turnos de caja
 * Archivo: server/src/controllers/turnos.controller.js
 *
 * Endpoints:
 *  GET  /turnos/activo       → turno abierto del usuario en sesión
 *  POST /turnos/abrir        → abre turno (valida que no haya uno abierto)
 *  POST /turnos/:id/cerrar   → cierra turno con arqueo atómico
 *  GET  /turnos/:id          → detalle de un turno
 *  GET  /turnos              → listado con paginación (Admin/Supervisor)
 */
const { pool } = require('../db');

/* ── GET /turnos/activo ──────────────────────────────────── */
exports.obtenerActivo = async (req, res) => {
  try {
    const { rows: [turno] } = await pool.query(
      `SELECT t.*, u.nombre_completo AS cajero_nombre,
              COUNT(v.id)  FILTER (WHERE v.estado='COMPLETADA') AS total_ventas_count,
              COALESCE(SUM(v.total) FILTER (WHERE v.estado='COMPLETADA'), 0) AS total_ventas,
              COALESCE(SUM(v.isv_15+v.isv_18) FILTER (WHERE v.estado='COMPLETADA'), 0) AS isv_total
       FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN ventas v ON v.turno_id = t.id
       WHERE t.usuario_id = $1 AND t.estado = 'ABIERTO'
       GROUP BY t.id, u.nombre_completo
       ORDER BY t.abierto_en DESC LIMIT 1`,
      [req.user.id]
    );
    if (!turno) return res.status(404).json({ message: 'No hay turno activo' });
    return res.json(turno);
  } catch (err) {
    return res.status(500).json({ message: 'Error consultando turno activo' });
  }
};

/* ── POST /turnos/abrir ──────────────────────────────────── */
exports.abrir = async (req, res) => {
  const { monto_inicial = 0 } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que no haya un turno abierto para este cajero
    const { rows: [existing] } = await client.query(
      `SELECT id FROM turnos WHERE usuario_id = $1 AND estado = 'ABIERTO' LIMIT 1`,
      [req.user.id]
    );
    if (existing) {
      throw new Error(`Ya tenés el turno #${existing.id} abierto. Cerralo antes de abrir uno nuevo.`);
    }

    const { rows: [turno] } = await client.query(
      `INSERT INTO turnos (usuario_id, monto_inicial, estado)
       VALUES ($1, $2, 'ABIERTO')
       RETURNING *`,
      [req.user.id, +monto_inicial]
    );

    await client.query('COMMIT');

    // Enriquecer respuesta con nombre del cajero
    const { rows: [cajero] } = await pool.query(
      'SELECT nombre_completo FROM usuarios WHERE id=$1', [req.user.id]
    );
    return res.status(201).json({ ...turno, cajero_nombre: cajero.nombre_completo });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};

/* ── POST /turnos/:id/cerrar ─────────────────────────────── */
exports.cerrar = async (req, res) => {
  const { monto_final_declarado, monto_final_sistema, observaciones } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el turno le pertenece y está abierto
    const { rows: [turno] } = await client.query(
      `SELECT * FROM turnos WHERE id=$1 AND estado='ABIERTO'`,
      [req.params.id]
    );
    if (!turno) throw new Error('Turno no encontrado o ya cerrado');

    // Solo el dueño o Admin/Supervisor puede cerrarlo
    const esDueno = String(turno.usuario_id) === String(req.user.id);
    const esAdmin = ['ADMINISTRADOR','SUPERVISOR'].includes(req.user.rol);
    if (!esDueno && !esAdmin) throw new Error('No tenés permiso para cerrar este turno');

    // Calcular totales reales de las ventas del turno
    const { rows: [totales] } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE estado='COMPLETADA') AS ventas_count,
         COALESCE(SUM(total)  FILTER (WHERE estado='COMPLETADA'), 0) AS total_ventas,
         COALESCE(SUM(total)  FILTER (WHERE estado='ANULADA'),    0) AS total_anuladas,
         COALESCE(SUM(isv_15+isv_18) FILTER (WHERE estado='COMPLETADA'), 0) AS isv_total
       FROM ventas WHERE turno_id=$1`,
      [turno.id]
    );

    const sistemaCalcula = monto_final_sistema ??
      (+turno.monto_inicial + +totales.total_ventas);

    const { rows: [cerrado] } = await client.query(
      `UPDATE turnos SET
         estado                 = 'CERRADO',
         monto_final_declarado  = $1,
         monto_final_sistema    = $2,
         total_ventas           = $3,
         total_anuladas         = $4,
         observaciones          = $5,
         cerrado_en             = NOW(),
         cerrado_por            = $6
       WHERE id = $7
       RETURNING *`,
      [
        +monto_final_declarado || 0,
        +sistemaCalcula,
        +totales.total_ventas,
        +totales.total_anuladas,
        observaciones || null,
        req.user.id,
        turno.id,
      ]
    );

    await client.query('COMMIT');

    const { rows: [cajero] } = await pool.query(
      'SELECT nombre_completo FROM usuarios WHERE id=$1', [turno.usuario_id]
    );
    return res.json({
      ...cerrado,
      cajero_nombre:       cajero.nombre_completo,
      total_ventas_count:  +totales.ventas_count,
      isv_total:           +totales.isv_total,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};

/* ── GET /turnos/:id ────────────────────────────────────── */
exports.obtener = async (req, res) => {
  try {
    const { rows: [t] } = await pool.query(
      `SELECT t.*, u.nombre_completo AS cajero_nombre,
              COUNT(v.id) FILTER (WHERE v.estado='COMPLETADA') AS total_ventas_count,
              COALESCE(SUM(v.total) FILTER (WHERE v.estado='COMPLETADA'),0) AS total_ventas,
              COALESCE(SUM(v.isv_15+v.isv_18) FILTER (WHERE v.estado='COMPLETADA'),0) AS isv_total
       FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN ventas v ON v.turno_id = t.id
       WHERE t.id = $1
       GROUP BY t.id, u.nombre_completo`,
      [req.params.id]
    );
    if (!t) return res.status(404).json({ message: 'Turno no encontrado' });
    return res.json(t);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener turno' });
  }
};

/* ── GET /turnos ─────────────────────────────────────────── */
exports.listar = async (req, res) => {
  const { cajero_id, estado, page = 1, limit = 20 } = req.query;
  const offset = (+page - 1) * +limit;
  const params = [];
  const wheres = [];

  // Un cajero solo ve sus propios turnos
  if (req.user.rol === 'CAJERO') {
    params.push(req.user.id);
    wheres.push(`t.usuario_id = $${params.length}`);
  } else {
    if (cajero_id) { params.push(cajero_id); wheres.push(`t.usuario_id = $${params.length}`); }
    if (estado)    { params.push(estado);    wheres.push(`t.estado = $${params.length}`); }
  }

  const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre_completo AS cajero_nombre,
              COUNT(v.id) FILTER (WHERE v.estado='COMPLETADA') AS total_ventas_count,
              COALESCE(SUM(v.total) FILTER (WHERE v.estado='COMPLETADA'),0) AS total_ventas,
              COUNT(*) OVER() AS total_registros
       FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       LEFT JOIN ventas v ON v.turno_id = t.id
       ${where}
       GROUP BY t.id, u.nombre_completo
       ORDER BY t.abierto_en DESC
       LIMIT $${params.push(+limit)} OFFSET $${params.push(offset)}`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar turnos' });
  }
};
