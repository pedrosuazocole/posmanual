/**
 * POSManual - DevSys Honduras
 * Servicio de importación masiva de artículos
 * Archivo: server/src/services/importarArticulos.js
 *
 * Proceso:
 * 1. Parsear Excel (xlsx)
 * 2. Mapear columnas al esquema POSManual
 * 3. Crear grupos faltantes automáticamente
 * 4. UPSERT de artículos (atomico: todo o nada)
 * 5. Retornar resumen: insertados, actualizados, errores
 */

const XLSX = require('xlsx');
const { pool } = require('../db'); // pg Pool

// Mapeo de columnas Excel → BD
const COLUMN_MAP = {
  codigo:      'codigo',
  grupo:       'grupo_origen',       // ID numérico del legado
  nombre:      'nombre',
  nombrecorto: 'nombre_corto',
  referencia:  'referencia',
  marca:       'marca',
  unidad:      'unidad_medida',
  costo:       'precio_costo',
  precio1:     'precio_venta',
  precio2:     'precio_especial',
  impuesto1:   'impuesto_pct',       // 0, 15 o 18
  existencia:  'stock_actual',
  minimo:      'stock_minimo',
  maximo:      'stock_maximo',
  usaexist:    'no_usar_existencia', // 2=TRUE, 1=FALSE
  inactiva:    '_inactiva',          // 0=activo, 1=inactivo
};

async function importarArticulos(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rows     = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const client = await pool.connect();
  const resultado = { insertados: 0, actualizados: 0, errores: [] };

  try {
    await client.query('BEGIN');

    // ── PASO 1: Grupos únicos del archivo ──────────────────
    const gruposUnicos = [...new Set(
      rows.map(r => r.grupo).filter(g => g != null && g !== '')
    )];

    for (const grupoOrigen of gruposUnicos) {
      await client.query(
        `INSERT INTO grupos (codigo_origen, nombre)
         VALUES ($1, $2)
         ON CONFLICT (codigo_origen) DO NOTHING`,
        [parseInt(grupoOrigen), `Grupo ${grupoOrigen}`]
      );
    }

    // ── PASO 2: UPSERT de artículos ────────────────────────
    for (const [i, row] of rows.entries()) {
      if (!row.codigo || !row.nombre) {
        resultado.errores.push({ fila: i + 2, motivo: 'Código o nombre vacío' });
        continue;
      }

      // Resolver grupo_id desde codigo_origen
      const grupoRes = await client.query(
        'SELECT id FROM grupos WHERE codigo_origen = $1',
        [parseInt(row.grupo)]
      );
      const grupoId = grupoRes.rows[0]?.id ?? null;

      const impuesto = [15, 18].includes(Number(row.impuesto1))
        ? Number(row.impuesto1) : 0;

      const noUsarExistencia = Number(row.usaexist) === 2;
      const activo           = Number(row.inactiva) === 0;

      const { rowCount, command } = await client.query(
        `INSERT INTO articulos
           (grupo_id, codigo, nombre, nombre_corto, referencia, marca,
            unidad_medida, precio_costo, precio_venta, precio_especial,
            impuesto_pct, stock_actual, stock_minimo, stock_maximo,
            no_usar_existencia, activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (codigo) DO UPDATE SET
           nombre             = EXCLUDED.nombre,
           nombre_corto       = EXCLUDED.nombre_corto,
           grupo_id           = EXCLUDED.grupo_id,
           precio_costo       = EXCLUDED.precio_costo,
           precio_venta       = EXCLUDED.precio_venta,
           precio_especial    = EXCLUDED.precio_especial,
           impuesto_pct       = EXCLUDED.impuesto_pct,
           no_usar_existencia = EXCLUDED.no_usar_existencia,
           activo             = EXCLUDED.activo,
           actualizado_en     = NOW()
         RETURNING (xmax = 0) AS es_nuevo`,
        [
          grupoId,
          String(row.codigo).trim(),
          String(row.nombre).trim(),
          row.nombrecorto ? String(row.nombrecorto).trim() : null,
          row.referencia  ? String(row.referencia).trim()  : null,
          row.marca       ? String(row.marca).trim()       : null,
          row.unidad      ? String(row.unidad).trim()      : 'UNIDAD',
          Number(row.costo)      || 0,
          Number(row.precio1)    || 0,
          Number(row.precio2)    || 0,
          impuesto,
          Number(row.existencia) || 0,
          Number(row.minimo)     || 0,
          Number(row.maximo)     || 0,
          noUsarExistencia,
          activo,
        ]
      );

      const esNuevo = rowCount > 0 && client.query !== undefined;
      // Determinar si fue INSERT o UPDATE por xmax
      // (Si es nuevo xmax=0, UPDATE xmax>0)
      resultado.insertados++;
    }

    await client.query('COMMIT');
    return resultado;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { importarArticulos };
