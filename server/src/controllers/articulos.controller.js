/**
 * POSManual - DevSys Honduras
 * Controlador: Artículos y Catálogo
 * Archivo: server/src/controllers/articulos.controller.js
 */
const { pool }   = require('../db');
const XLSX       = require('xlsx');
const multer     = require('multer');

// Multer: almacenar en memoria (buffer), max 10 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
exports.multerMiddleware = upload.single('archivo');

/* ─── GET /api/v1/articulos ─── */
exports.listar = async (req, res) => {
  const { q, grupo_id, activo = 'true', page = 1, limit = 100 } = req.query;
  const offset = (+page - 1) * +limit;
  const params = [];
  const wheres = [`a.activo = $${params.push(activo === 'true')}`];

  if (q)        wheres.push(`(a.nombre ILIKE $${params.push('%' + q + '%')} OR a.codigo ILIKE $${params.push('%' + q + '%')})`);
  if (grupo_id) wheres.push(`a.grupo_id = $${params.push(+grupo_id)}`);

  try {
    const { rows } = await pool.query(
      `SELECT a.*, g.nombre AS grupo_nombre, COUNT(*) OVER() AS total_registros
       FROM articulos a
       LEFT JOIN grupos g ON g.id = a.grupo_id
       WHERE ${wheres.join(' AND ')}
       ORDER BY a.nombre
       LIMIT $${params.push(+limit)} OFFSET $${params.push(offset)}`,
      params
    );
    return res.json({ data: rows, total: +(rows[0]?.total_registros ?? 0) });
  } catch (err) {
    return res.status(500).json({ message: 'Error al listar artículos' });
  }
};

/* ─── GET /api/v1/articulos/codigo/:codigo ─── */
exports.buscarPorCodigo = async (req, res) => {
  try {
    const { rows: [art] } = await pool.query(
      `SELECT a.*, g.nombre AS grupo_nombre
       FROM articulos a LEFT JOIN grupos g ON g.id = a.grupo_id
       WHERE a.codigo = $1 AND a.activo = TRUE`,
      [req.params.codigo]
    );
    if (!art) return res.status(404).json({ message: 'Artículo no encontrado' });
    return res.json(art);
  } catch (err) {
    return res.status(500).json({ message: 'Error al buscar artículo' });
  }
};

/* ─── GET /api/v1/articulos/:id ─── */
exports.obtener = async (req, res) => {
  try {
    const { rows: [art] } = await pool.query(
      `SELECT a.*, g.nombre AS grupo_nombre
       FROM articulos a LEFT JOIN grupos g ON g.id = a.grupo_id WHERE a.id = $1`,
      [req.params.id]
    );
    if (!art) return res.status(404).json({ message: 'Artículo no encontrado' });
    return res.json(art);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener artículo' });
  }
};

/* ─── POST /api/v1/articulos ─── */
exports.crear = async (req, res) => {
  const { grupo_id, codigo, nombre, nombre_corto, referencia, marca,
          unidad_medida='UNIDAD', precio_costo=0, precio_venta=0,
          precio_especial=0, impuesto_pct=15, stock_actual=0,
          stock_minimo=0, stock_maximo=0, no_usar_existencia=false } = req.body;

  if (!codigo?.trim() || !nombre?.trim()) {
    return res.status(400).json({ message: 'Código y nombre son obligatorios' });
  }
  try {
    const { rows: [art] } = await pool.query(
      `INSERT INTO articulos
         (grupo_id,codigo,nombre,nombre_corto,referencia,marca,unidad_medida,
          precio_costo,precio_venta,precio_especial,impuesto_pct,
          stock_actual,stock_minimo,stock_maximo,no_usar_existencia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [grupo_id||null, codigo.trim(), nombre.trim(), nombre_corto||null,
       referencia||null, marca||null, unidad_medida,
       precio_costo, precio_venta, precio_especial, impuesto_pct,
       stock_actual, stock_minimo, stock_maximo, no_usar_existencia]
    );
    return res.status(201).json(art);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: `El código "${codigo}" ya existe` });
    return res.status(500).json({ message: 'Error al crear artículo' });
  }
};

/* ─── PUT /api/v1/articulos/:id ─── */
exports.actualizar = async (req, res) => {
  const fields = ['grupo_id','nombre','nombre_corto','referencia','marca','unidad_medida',
                  'precio_costo','precio_venta','precio_especial','impuesto_pct',
                  'stock_minimo','stock_maximo','no_usar_existencia','activo'];
  const updates = [];
  const params  = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f}=$${params.length}`);
    }
  });
  if (!updates.length) return res.status(400).json({ message: 'Nada que actualizar' });
  params.push(req.params.id);
  try {
    const { rows: [art] } = await pool.query(
      `UPDATE articulos SET ${updates.join(',')},actualizado_en=NOW()
       WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!art) return res.status(404).json({ message: 'Artículo no encontrado' });
    return res.json(art);
  } catch (err) {
    return res.status(500).json({ message: 'Error al actualizar artículo' });
  }
};

/* ─── DELETE /api/v1/articulos/:id  (desactivar, no borrar) ─── */
exports.desactivar = async (req, res) => {
  const { rows: [art] } = await pool.query(
    `UPDATE articulos SET activo=FALSE,actualizado_en=NOW() WHERE id=$1 RETURNING id,nombre`,
    [req.params.id]
  );
  if (!art) return res.status(404).json({ message: 'Artículo no encontrado' });
  return res.json({ message: `Artículo "${art.nombre}" desactivado`, id: art.id });
};

/* ─── POST /api/v1/articulos/importar ─── */
exports.importar = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo' });

  const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (!rows.length) return res.status(400).json({ message: 'El archivo está vacío' });

  const client = await pool.connect();
  const resultado = { insertados: 0, actualizados: 0, errores: [] };

  try {
    await client.query('BEGIN');

    // 1. Crear grupos faltantes automáticamente
    const gruposOriginales = [...new Set(rows.map(r => r.grupo).filter(Boolean))];
    for (const go of gruposOriginales) {
      await client.query(
        `INSERT INTO grupos (codigo_origen, nombre)
         VALUES ($1, $2) ON CONFLICT (codigo_origen) DO NOTHING`,
        [parseInt(go), `Grupo ${go}`]
      );
    }

    // 2. UPSERT de artículos
    for (const [i, row] of rows.entries()) {
      if (!row.codigo || !row.nombre) {
        resultado.errores.push({ fila: i + 2, motivo: 'Código o nombre vacío' });
        continue;
      }
      const grupoRes = await client.query(
        'SELECT id FROM grupos WHERE codigo_origen = $1', [parseInt(row.grupo)]
      );
      const grupoId   = grupoRes.rows[0]?.id ?? null;
      const impuesto  = [15, 18].includes(+row.impuesto1) ? +row.impuesto1 : 0;
      const noUsar    = +row.usaexist === 2;
      const activo    = +row.inactiva === 0;

      const { rows: r } = await client.query(
        `INSERT INTO articulos
           (grupo_id,codigo,nombre,nombre_corto,referencia,marca,
            precio_costo,precio_venta,precio_especial,impuesto_pct,
            stock_actual,stock_minimo,stock_maximo,no_usar_existencia,activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (codigo) DO UPDATE SET
           nombre=$3,nombre_corto=$4,grupo_id=$1,
           precio_costo=$7,precio_venta=$8,precio_especial=$9,
           impuesto_pct=$10,no_usar_existencia=$14,activo=$15,
           actualizado_en=NOW()
         RETURNING (xmax=0) AS es_nuevo`,
        [
          grupoId, String(row.codigo).trim(), String(row.nombre).trim(),
          row.nombrecorto ? String(row.nombrecorto).trim() : null,
          row.referencia  ? String(row.referencia).trim()  : null,
          row.marca       ? String(row.marca).trim()       : null,
          +row.costo||0, +row.precio1||0, +row.precio2||0,
          impuesto, +row.existencia||0, +row.minimo||0, +row.maximo||0,
          noUsar, activo,
        ]
      );
      r[0]?.es_nuevo ? resultado.insertados++ : resultado.actualizados++;
    }

    await client.query('COMMIT');
    return res.json({
      message: `Importación completada: ${resultado.insertados} nuevos, ${resultado.actualizados} actualizados, ${resultado.errores.length} errores`,
      ...resultado,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ message: 'Error en la importación: ' + err.message });
  } finally {
    client.release();
  }
};

/* ─── GET /api/v1/articulos/plantilla ─── */
exports.descargarPlantilla = (req, res) => {
  const wb    = XLSX.utils.book_new();
  const datos = [
    ['codigo','nombre','grupo','unidad','costo','precio1','precio2','impuesto1','existencia','minimo','maximo','usaexist','inactiva','nombrecorto','referencia','marca'],
    ['1001','EJEMPLO PRODUCTO',4,'UNIDAD',15.00,25.00,22.00,15,100,10,500,1,0,'Nombre corto','REF-001','Mi Marca'],
    ['SRV-001','SERVICIO SIN STOCK',50,'SERVICIO',0,50.00,0,0,0,0,0,2,0,'','',''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws['!cols'] = datos[0].map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Artículos');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla_articulos.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
};
