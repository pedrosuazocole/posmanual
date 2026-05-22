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

module.exports = router;


/* ── CONTROLADOR ───────────────────────────────────────────── */
// controllers/reportes.controller.js
const { pool } = require('../db');

/* Ventas por grupo */
exports.ventasPorGrupo = async (req, res) => {
  const { fecha_ini, fecha_fin } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(g.nombre,'Sin Grupo')          AS grupo,
         COUNT(DISTINCT v.id)::INT               AS num_facturas,
         SUM(dv.cantidad)                        AS unidades_vendidas,
         SUM(dv.subtotal)                        AS total_ventas,
         ROUND(SUM(dv.subtotal*dv.impuesto_pct/100)::numeric,2) AS isv_generado,
         ROUND(
           SUM(dv.subtotal)*100.0/
           NULLIF(SUM(SUM(dv.subtotal)) OVER(),0)
         ,2)                                     AS "%_participacion"
       FROM detalle_ventas dv
       JOIN ventas v    ON v.id = dv.venta_id AND v.estado = 'COMPLETADA'
                       AND v.creado_en BETWEEN $1 AND $2::date+1
       JOIN articulos a ON a.id = dv.articulo_id
       LEFT JOIN grupos g ON g.id = a.grupo_id
       GROUP BY g.nombre
       ORDER BY total_ventas DESC`,
      [fecha_ini || '2000-01-01', fecha_fin || 'now()']
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error en reporte de grupos' });
  }
};

/* Ventas por artículo */
exports.ventasPorArticulo = async (req, res) => {
  const { fecha_ini, fecha_fin, grupo_id } = req.query;
  const params  = [fecha_ini || '2000-01-01', fecha_fin || 'now()'];
  const grupoWhere = grupo_id ? `AND a.grupo_id = $${params.push(+grupo_id)}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT
         a.codigo, a.nombre,
         COALESCE(g.nombre,'Sin Grupo')     AS grupo,
         COUNT(DISTINCT v.id)::INT          AS veces_facturado,
         SUM(dv.cantidad)                   AS cantidad_total,
         ROUND(AVG(dv.precio_unitario)::numeric,2) AS precio_promedio,
         SUM(dv.subtotal)                   AS total_ventas,
         ROUND(
           (SUM(dv.subtotal)-SUM(a.precio_costo*dv.cantidad))*100.0/
           NULLIF(SUM(dv.subtotal),0)
         ,2)                                AS "%_margen"
       FROM detalle_ventas dv
       JOIN ventas v    ON v.id = dv.venta_id AND v.estado='COMPLETADA'
                       AND v.creado_en BETWEEN $1 AND $2::date+1
       JOIN articulos a ON a.id = dv.articulo_id ${grupoWhere}
       LEFT JOIN grupos g ON g.id = a.grupo_id
       GROUP BY a.id, a.codigo, a.nombre, g.nombre
       ORDER BY total_ventas DESC
       LIMIT 500`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Error en reporte de artículos' });
  }
};

/**
 * Generar PDF de factura vía Puppeteer
 * Requiere: npm install puppeteer-core @sparticuz/chromium
 *
 * Para Railway/hosting sin Chromium:
 *   npm install puppeteer-core @sparticuz/chromium-min
 */
exports.generarPdf = async (req, res) => {
  let browser;
  try {
    // Obtener datos de la venta
    const { rows: [venta] } = await pool.query(
      `SELECT v.*, u.nombre_completo AS cajero_nombre
       FROM ventas v JOIN usuarios u ON u.id=v.cajero_id WHERE v.id=$1`,
      [req.params.id]
    );
    if (!venta) return res.status(404).json({ message: 'Venta no encontrada' });

    const { rows: detalle } = await pool.query(
      `SELECT dv.*, COALESCE(a.nombre, dv.descripcion) AS descripcion
       FROM detalle_ventas dv LEFT JOIN articulos a ON a.id=dv.articulo_id
       WHERE dv.venta_id=$1`,
      [venta.id]
    );
    venta.detalle = detalle;

    // Generar HTML del ticket (misma función que el frontend)
    const html = buildTicketHtmlServer(venta);

    // Puppeteer (headless)
    const chromium  = require('@sparticuz/chromium-min');
    const puppeteer = require('puppeteer-core');

    browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(
        process.env.CHROMIUM_PATH || undefined
      ),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        body{font-family:'Courier New',monospace;width:72mm;margin:0 auto;padding:3mm;font-size:11px}
        @page{size:80mm auto;margin:0}
      </style></head><body>${html}</body></html>`);

    const pdf = await page.pdf({ format: undefined, width: '80mm', printBackground: true });

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura_${venta.numero_factura.replace(/\//g,'-')}.pdf"`);
    return res.send(pdf);

  } catch (err) {
    console.error('[reportes.generarPdf]', err.message);
    return res.status(500).json({ message: 'Error generando PDF: ' + err.message });
  } finally {
    if (browser) await browser.close();
  }
};

/* HTML del ticket para el servidor (sin JSX) */
function buildTicketHtmlServer(v) {
  const det = v.detalle || [];
  let sub=0,g15=0,g18=0,ex=0;
  det.forEach(it=>{
    const n=it.precio_unitario*it.cantidad;
    sub+=n;
    if(+it.impuesto_pct===15) g15+=n/1.15;
    else if(+it.impuesto_pct===18) g18+=n/1.18;
    else ex+=n;
  });
  const L = n => `L. ${n.toFixed(2)}`;
  const cam = Math.max(0,(v.monto_recibido||0)-sub);
  return `<div style="text-align:center">
    <b>INVERSIONES BUENOS AIRES S.A.</b><br>
    <small>RTN: 05019009204111</small>
  </div>
  <div style="text-align:center;background:#000;color:#fff;padding:1px 0;margin:3px 0;font-size:10px">
    FACTURA PROFORMA
  </div>
  <div style="font-size:11px">
    <div>Factura #: <b>${v.numero_factura}</b></div>
    <div>Fecha: ${new Date(v.creado_en).toLocaleString('es-HN')}</div>
    <div>Cliente: <b>${v.cliente_nombre}</b></div>
    <div>RTN: ${v.cliente_rtn}</div>
  </div>
  <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
  <table style="width:100%;font-size:10px;border-collapse:collapse">
    <tr style="border-bottom:1px solid #ccc"><th>Descripción</th><th>Qty</th><th>P.Unit</th><th>Total</th></tr>
    ${det.map(it=>`<tr><td>${it.descripcion}</td><td>${it.cantidad}</td><td>${it.precio_unitario.toFixed(2)}</td><td>${(it.precio_unitario*it.cantidad).toFixed(2)}</td></tr>`).join('')}
  </table>
  <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
  <div style="font-size:11px">
    <div style="display:flex;justify-content:space-between"><span>TOTAL A PAGAR</span><span><b>${L(sub)}</b></span></div>
    <div style="display:flex;justify-content:space-between"><span>ISV 15%</span><span>${L(g15*0.15)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>CAMBIO</span><span>${L(cam)}</span></div>
  </div>
  <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
  <div style="font-size:9px;text-align:center">
    C.A.I.: ${process.env.CAI_ACTIVO || '40BC19-7CF1EF-C2FBE0-63BE03-0909B8-D4'}<br>
    Fecha Límite: ${process.env.CAI_FECHA_LIMITE || '09/10/2026'}<br>
    ** DevSys Honduras - POSManual **
  </div>`;
}
