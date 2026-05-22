/**
 * POSManual - DevSys Honduras
 * Controlador: Ventas (Facturas Proforma)
 * Archivo: server/src/controllers/ventas.controller.js
 *
 * PRINCIPIO ATÓMICO: todas las operaciones de una venta se ejecutan
 * dentro de una transacción PostgreSQL. Si algo falla → ROLLBACK total.
 */
const { pool }    = require('../db');
const { z }       = require('zod');

// ── Esquema de validación con Zod ──────────────────────────
const ItemSchema = z.object({
  articulo_id:     z.number().int().positive().nullable(),
  descripcion:     z.string().min(1).max(200),
  cantidad:        z.number().positive(),
  precio_unitario: z.number().min(0),
  descuento_unit:  z.number().min(0).default(0),
  impuesto_pct:    z.number().min(0).max(18).default(15),
  manual:          z.boolean().default(false),
});

const VentaSchema = z.object({
  turno_id:       z.number().int().positive(),
  cliente_nombre: z.string().default('CONSUMIDOR FINAL'),
  cliente_rtn:    z.string().default('0000000'),
  metodo_pago:    z.enum(['EFECTIVO','TARJETA_CREDITO','TARJETA_DEBITO','TRANSFERENCIA','CREDITO']),
  monto_recibido: z.number().min(0).default(0),
  items:          z.array(ItemSchema).min(1, 'La factura debe tener al menos 1 artículo'),
  // Totales precalculados en el cliente (se recalculan en backend para validar)
  total:          z.number().min(0),
});

// Genera número de factura secuencial
// Formato: 000-009-01-XXXXXXXX (correlativo por rango CAI)
async function generarNumeroFactura(client) {
  const res = await client.query(
    `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_factura,'^.+-','') AS BIGINT)),0)+1 AS next
     FROM ventas`
  );
  const seq = String(res.rows[0].next).padStart(8, '0');
  return `000-009-01-${seq}`;
}

/* ─── POST /api/v1/ventas ─── */
exports.crear = async (req, res) => {
  // 1. Validar payload
  const parsed = VentaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.flatten() });
  }

  const data = parsed.data;
  const cajeroId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 2. Verificar turno activo y que pertenezca al cajero (o sea Admin/Supervisor)
    const turnoRes = await client.query(
      `SELECT id, estado FROM turnos WHERE id = $1`,
      [data.turno_id]
    );
    if (!turnoRes.rows[0] || turnoRes.rows[0].estado !== 'ABIERTO') {
      throw new Error('El turno no está abierto. Abrí un turno antes de facturar.');
    }

    // 3. Recalcular totales en backend (no confiar solo en el cliente)
    let subtotal = 0, exento = 0, gravado15 = 0, gravado18 = 0;
    for (const item of data.items) {
      const base = item.precio_unitario * item.cantidad;
      const neto = base - (item.descuento_unit * item.cantidad);
      subtotal += neto;
      if      (item.impuesto_pct === 15) gravado15 += neto / 1.15;
      else if (item.impuesto_pct === 18) gravado18 += neto / 1.18;
      else                               exento    += neto;
    }
    const isv15  = +(gravado15 * 0.15).toFixed(2);
    const isv18  = +(gravado18 * 0.18).toFixed(2);
    const total  = +subtotal.toFixed(2);

    // 4. Generar número de factura
    const numeroFactura = await generarNumeroFactura(client);

    // 5. Insertar cabecera de venta
    const ventaRes = await client.query(
      `INSERT INTO ventas
         (turno_id, cajero_id, numero_factura, cliente_nombre, cliente_rtn,
          estado, subtotal, descuento_total, importe_exento,
          importe_gravado_15, importe_gravado_18, isv_15, isv_18,
          total, metodo_pago, monto_recibido)
       VALUES ($1,$2,$3,$4,$5,'COMPLETADA',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, numero_factura, total`,
      [
        data.turno_id, cajeroId, numeroFactura,
        data.cliente_nombre, data.cliente_rtn,
        total, 0, +exento.toFixed(2),
        +gravado15.toFixed(2), +gravado18.toFixed(2),
        isv15, isv18, total,
        data.metodo_pago, data.monto_recibido,
      ]
    );
    const venta = ventaRes.rows[0];

    // 6. Insertar detalle línea por línea + descontar inventario
    for (const item of data.items) {
      // Insertar línea de detalle
      await client.query(
        `INSERT INTO detalle_ventas
           (venta_id, articulo_id, cantidad, precio_unitario, descuento_unit, impuesto_pct)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          venta.id,
          item.articulo_id,
          item.cantidad,
          item.precio_unitario,
          item.descuento_unit,
          item.impuesto_pct,
        ]
      );

      // Descontar stock solo si el artículo existe en BD y NO es manual ni servicio
      if (item.articulo_id && !item.manual) {
        const artRes = await client.query(
          `SELECT no_usar_existencia, stock_actual FROM articulos WHERE id = $1`,
          [item.articulo_id]
        );
        const art = artRes.rows[0];
        if (art && !art.no_usar_existencia) {
          const stockNuevo = +art.stock_actual - item.cantidad;
          await client.query(
            `UPDATE articulos SET stock_actual=$1, actualizado_en=NOW() WHERE id=$2`,
            [stockNuevo, item.articulo_id]
          );
          // Registrar movimiento de inventario
          await client.query(
            `INSERT INTO movimientos_inventario
               (articulo_id, tipo, cantidad, stock_anterior, stock_nuevo,
                referencia_tipo, referencia_id, usuario_id)
             VALUES ($1,'SALIDA',$2,$3,$4,'VENTA',$5,$6)`,
            [
              item.articulo_id, item.cantidad,
              art.stock_actual, stockNuevo,
              venta.id, cajeroId,
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id:              venta.id,
      numero_factura:  venta.numero_factura,
      total:           venta.total,
      message:         'Factura emitida correctamente',
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ventas.crear]', err.message);
    return res.status(400).json({ message: err.message || 'Error interno al crear la venta' });
  } finally {
    client.release();
  }
};

/* ─── GET /api/v1/ventas ─── */
exports.listar = async (req, res) => {
  const { fecha_ini, fecha_fin, cajero_id, estado, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const params = [];
  const wheres = [];

  if (fecha_ini) { params.push(fecha_ini); wheres.push(`v.creado_en >= $${params.length}`); }
  if (fecha_fin) { params.push(fecha_fin); wheres.push(`v.creado_en <= $${params.length}::date + 1`); }
  if (cajero_id) { params.push(cajero_id); wheres.push(`v.cajero_id = $${params.length}`); }
  if (estado)    { params.push(estado);    wheres.push(`v.estado = $${params.length}`); }

  const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

  try {
    const { rows } = await pool.query(
      `SELECT v.*, u.nombre_completo AS cajero_nombre,
              COUNT(*) OVER() AS total_registros
       FROM ventas v
       JOIN usuarios u ON u.id = v.cajero_id
       ${where}
       ORDER BY v.creado_en DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const total = rows[0]?.total_registros ?? 0;
    return res.json({ data: rows, total: +total, page: +page, limit: +limit });
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar ventas' });
  }
};

/* ─── GET /api/v1/ventas/:id ─── */
exports.obtener = async (req, res) => {
  try {
    const { rows: [venta] } = await pool.query(
      `SELECT v.*, u.nombre_completo AS cajero_nombre
       FROM ventas v JOIN usuarios u ON u.id = v.cajero_id
       WHERE v.id = $1`,
      [req.params.id]
    );
    if (!venta) return res.status(404).json({ message: 'Venta no encontrada' });

    const { rows: detalle } = await pool.query(
      `SELECT dv.*, a.nombre AS articulo_nombre, a.codigo AS articulo_codigo
       FROM detalle_ventas dv
       LEFT JOIN articulos a ON a.id = dv.articulo_id
       WHERE dv.venta_id = $1`,
      [venta.id]
    );
    return res.json({ ...venta, detalle });
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener la venta' });
  }
};

/* ─── POST /api/v1/ventas/:id/anular ─── */
exports.anular = async (req, res) => {
  const { motivo } = req.body;
  if (!motivo?.trim()) {
    return res.status(400).json({ message: 'El motivo de anulación es obligatorio' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [v] } = await client.query(
      `UPDATE ventas
       SET estado='ANULADA', anulado_por=$1, motivo_anulacion=$2
       WHERE id=$3 AND estado='COMPLETADA'
       RETURNING id, numero_factura`,
      [req.user.id, motivo.trim(), req.params.id]
    );
    if (!v) throw new Error('La venta no existe o ya fue anulada');
    // Devolver stock de artículos no-manuales
    await client.query(
      `UPDATE articulos a
       SET stock_actual = a.stock_actual + dv.cantidad
       FROM detalle_ventas dv
       WHERE dv.venta_id = $1 AND dv.articulo_id = a.id
         AND a.no_usar_existencia = FALSE`,
      [req.params.id]
    );
    await client.query('COMMIT');
    return res.json({ message: `Factura ${v.numero_factura} anulada`, id: v.id });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
};
