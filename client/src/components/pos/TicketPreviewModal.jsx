/**
 * POSManual - DevSys Honduras
 * Componente: Modal de vista previa e impresión del ticket
 * Archivo: client/src/components/pos/TicketPreviewModal.jsx
 *
 * Funciones:
 *  - Preview del ticket Factura Proforma en formato 80mm
 *  - Selector de impresora y formato (80mm / Carta)
 *  - Control de copias (1–5)
 *  - Toggle "siempre previsualizar" por usuario (localStorage)
 *  - Impresión directa vía window.print() en iframe aislado
 *  - Descarga PDF (requiere jsPDF en el cliente O endpoint /ventas/:id/pdf)
 *
 * Props:
 *  venta    - objeto completo de la venta (con detalle[])
 *  onClose  - cierra el modal
 */
import { useState, useRef, useEffect } from 'react';
import styles from './TicketPreviewModal.module.css';

// Datos fiscales fijos de la empresa (vienen del .env en producción)
const EMPRESA = {
  nombre:    'INVERSIONES BUENOS AIRES S.A.',
  direccion: 'Bo. Buenos Aires BLVD del norte, San Pedro Sula, Honduras',
  telefono:  '+504 2527-8133/8119',
  rtn:       '05019009204111',
  email:     'gerenciatexacoba@gmail.com',
  cai:       process.env.REACT_APP_CAI_ACTIVO        || '40BC19-7CF1EF-C2FBE0-63BE03-0909B8-D4',
  caiLimite: process.env.REACT_APP_CAI_FECHA_LIMITE  || '09/10/2026',
  rangoIni:  process.env.REACT_APP_CAI_RANGO_INICIO  || '000-009-01-03816501',
  rangoFin:  process.env.REACT_APP_CAI_RANGO_FIN     || '000-009-01-04066500',
};

const ALWAYS_PREVIEW_KEY = 'posmanual_always_preview';

export default function TicketPreviewModal({ venta, onClose }) {
  const [formato,   setFormato]   = useState('80mm');
  const [copias,    setCopias]    = useState(1);
  const [impresora, setImpresora] = useState('Térmica 80mm — USB001');
  const [alwaysPrev,setAlwaysPrev]= useState(
    () => localStorage.getItem(ALWAYS_PREVIEW_KEY) !== 'false'
  );
  const iframeRef = useRef(null);

  // Persistir preferencia "siempre previsualizar"
  useEffect(() => {
    localStorage.setItem(ALWAYS_PREVIEW_KEY, alwaysPrev);
  }, [alwaysPrev]);

  // ── Calcular totales a partir del detalle ──────────────
  const totales = calcularTotales(venta.detalle || []);
  const cambio  = Math.max(0, (venta.monto_recibido || 0) - totales.total);

  // ── Generar HTML del ticket ─────────────────────────────
  const ticketHtml = generarTicketHtml({ venta, totales, cambio, empresa: EMPRESA });

  // ── Imprimir ────────────────────────────────────────────
  const imprimir = () => {
    const win = window.open('', '_blank', 'width=420,height=750');
    const css = formato === '80mm'
      ? `body{width:72mm;margin:0 auto;padding:3mm} @page{size:80mm auto;margin:0}`
      : `body{width:210mm;margin:20mm auto;padding:0} @page{size:A4;margin:20mm}`;

    // Imprimir N copias concatenando el ticket
    const body = Array.from({ length: +copias }, () => ticketHtml).join(
      '<div style="page-break-after:always"></div>'
    );

    win.document.write(`<!DOCTYPE html><html><head><title>Factura ${venta.numero_factura}</title>
      <style>
        body{font-family:'Courier New',Courier,monospace;font-size:11px;color:#111}
        ${css}
        .ticket{padding:2mm}
        @media print{.ticket{}}
      </style></head><body>
      <div class="ticket">${body}</div>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
    win.document.close();
  };

  // ── Descargar PDF vía endpoint del servidor ─────────────
  const descargarPdf = async () => {
    try {
      const res = await fetch(`/api/v1/ventas/${venta.id}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('posmanual_token')}` },
      });
      if (!res.ok) throw new Error('Error generando PDF');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `factura_${venta.numero_factura.replace(/\//g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF error:', err);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Vista previa del ticket">
      <div className={styles.container}>

        {/* Panel de controles (izquierda) */}
        <div className={styles.controls}>
          <h3 className={styles.controlsTitle}>
            <i className="ti ti-printer" aria-hidden="true" /> Configuración de impresión
          </h3>

          {/* Estado impresora */}
          <div className={styles.printerStatus}>
            <div className={styles.printerIcon}>
              <i className="ti ti-printer" aria-hidden="true" />
            </div>
            <div>
              <div className={styles.printerName}>{impresora}</div>
              <div className={styles.printerConn}>
                <span className={styles.dot} />Puerto USB001 · Conectada
              </div>
            </div>
          </div>

          <label className={styles.fieldLabel}>Impresora</label>
          <select value={impresora} onChange={e => setImpresora(e.target.value)} className={styles.select}>
            <option>Térmica 80mm — USB001</option>
            <option>Impresora de Oficina (Carta)</option>
            <option>Guardar como PDF</option>
          </select>

          <label className={styles.fieldLabel}>Formato de papel</label>
          <select value={formato} onChange={e => setFormato(e.target.value)} className={styles.select}>
            <option value="80mm">Ticket 80mm (térmica)</option>
            <option value="carta">Carta completa</option>
          </select>

          <div className={styles.copiesRow}>
            <label className={styles.fieldLabel}>Copias</label>
            <input
              type="number" min={1} max={5} step={1}
              value={copias}
              onChange={e => setCopias(Math.min(5, Math.max(1, +e.target.value)))}
              className={styles.copiesInput}
            />
          </div>

          <div className={styles.toggleRow}>
            <span>Siempre previsualizar</span>
            <Toggle checked={alwaysPrev} onChange={setAlwaysPrev} />
          </div>

          <div className={styles.sep} />

          <button className={styles.btnPrim} onClick={imprimir}>
            <i className="ti ti-printer" aria-hidden="true" /> Imprimir ahora
          </button>
          <button className={styles.btnSec} onClick={descargarPdf}>
            <i className="ti ti-file-download" aria-hidden="true" /> Descargar PDF
          </button>
          <button className={styles.btnClose} onClick={onClose}>
            <i className="ti ti-x" aria-hidden="true" /> Cerrar
          </button>
        </div>

        {/* Vista previa (derecha) */}
        <div className={styles.preview}>
          <div className={styles.previewLabel}>Vista previa del ticket</div>
          <div className={styles.ticketFrame}>
            <div
              className={styles.ticketInner}
              dangerouslySetInnerHTML={{ __html: ticketHtml }}
            />
          </div>
          <div className={styles.previewMeta}>
            Formato {formato} · {copias} copia{+copias > 1 ? 's' : ''}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Toggle simple ────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-wrap" style={{ position:'relative', width:40, height:22, cursor:'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ opacity:0, width:0, height:0, position:'absolute' }} />
      <div style={{
        position:'absolute', inset:0,
        background: checked ? '#1B4F9B' : 'var(--color-border-secondary)',
        borderRadius:11, transition:'.2s',
      }} />
      <div style={{
        position:'absolute', top:3, left: checked ? 21 : 3,
        width:16, height:16, background:'#fff', borderRadius:'50%', transition:'.2s',
      }} />
    </label>
  );
}

// ─── Calcular totales fiscales ────────────────────────────
function calcularTotales(detalle) {
  let sub = 0, ex = 0, g15 = 0, g18 = 0;
  detalle.forEach(({ precio_unitario, cantidad, descuento_unit, impuesto_pct }) => {
    const neto = (precio_unitario - (descuento_unit || 0)) * cantidad;
    sub += neto;
    if      (+impuesto_pct === 15) g15 += neto / 1.15;
    else if (+impuesto_pct === 18) g18 += neto / 1.18;
    else                           ex  += neto;
  });
  return {
    subtotal: +sub.toFixed(2), exento: +ex.toFixed(2),
    gravado15: +g15.toFixed(2), isv15: +(g15 * 0.15).toFixed(2),
    gravado18: +g18.toFixed(2), isv18: +(g18 * 0.18).toFixed(2),
    total: +sub.toFixed(2),
  };
}

const L = n => `L. ${(+n || 0).toFixed(2)}`;

// ─── Número en letras (Lempiras) ──────────────────────────
function numLetras(n) {
  const ent = Math.floor(n);
  const dec = Math.round((n - ent) * 100);
  const u   = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ',
    'ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO',
    'DIECINUEVE','VEINTE'];
  const d   = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const c   = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
    'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  let r = '';
  if (ent >= 100) { r = ent === 100 ? 'CIEN' : c[Math.floor(ent / 100)]; }
  const rem = ent % 100;
  if (rem <= 20)  r += (r ? ' ' : '') + u[rem];
  else            r += (r ? ' ' : '') + d[Math.floor(rem / 10)] + (rem % 10 ? ' Y ' + u[rem % 10] : '');
  return (r || 'CERO') + ' CON ' + String(dec).padStart(2, '0') + '/100';
}

// ─── Generar HTML completo del ticket ─────────────────────
function generarTicketHtml({ venta, totales, cambio, empresa }) {
  const itemRows = (venta.detalle || []).map(it => `
    <tr>
      <td style="max-width:120px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${it.descripcion || it.articulo_nombre}</td>
      <td style="text-align:center">${it.cantidad}</td>
      <td style="text-align:right">${it.descuento_unit > 0 ? it.descuento_unit.toFixed(2) : '0.00'}</td>
      <td style="text-align:right">${it.precio_unitario.toFixed(2)}</td>
      <td style="text-align:right">${(it.precio_unitario * it.cantidad).toFixed(2)}</td>
    </tr>`).join('');

  return `
    <div style="text-align:center;margin-bottom:5px">
      <div style="font-size:16px;font-weight:700">POSManual</div>
      <div style="font-size:13px;font-weight:700">${empresa.nombre}</div>
      <div style="font-size:9px">${empresa.direccion}</div>
      <div style="font-size:9px">Tel. ${empresa.telefono}</div>
      <div style="font-size:9px">RTN: ${empresa.rtn}</div>
      <div style="font-size:9px">Email: ${empresa.email}</div>
    </div>
    <div style="text-align:center;background:#1B4F9B;color:#fff;font-size:10px;font-weight:700;padding:2px 0;margin:4px 0">
      ★ FACTURA PROFORMA ★
    </div>
    <div style="font-size:11px;line-height:1.7">
      <div style="display:flex;justify-content:space-between"><span>Factura #:</span><span style="font-weight:700;font-size:10px">${venta.numero_factura}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Fecha:</span><span>${new Date(venta.creado_en).toLocaleString('es-HN')}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Atendido por:</span><span>${venta.cajero_nombre || 'CAJA VENTAS'}</span></div>
    </div>
    <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
    <div style="font-size:11px;line-height:1.7">
      <div style="display:flex;justify-content:space-between"><span>CLIENTE:</span><span style="font-weight:700">${venta.cliente_nombre}</span></div>
      <div style="display:flex;justify-content:space-between"><span>R.T.N.:</span><span>${venta.cliente_rtn}</span></div>
    </div>
    <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
    <table style="width:100%;font-size:10px;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid #ccc">
        <th style="text-align:left">DESCRIPCION</th>
        <th style="text-align:center">CANT</th>
        <th style="text-align:right">DSCTO</th>
        <th style="text-align:right">P.UNIT</th>
        <th style="text-align:right">TOTAL</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
    <div style="font-size:11px;line-height:1.8">
      <div style="display:flex;justify-content:space-between"><span>SUB TOTAL</span><span>${L(totales.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>(-) DESCUENTOS Y REBAJAS</span><span>L. 0.00</span></div>
      <div style="display:flex;justify-content:space-between"><span>IMPORTE EXENTO:</span><span>${L(totales.exento)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>IMPORTE EXONERADO:</span><span>L. 0.0,</span></div>
      <div style="display:flex;justify-content:space-between"><span>IMPORTE GRAVADO AL 15%</span><span>${L(totales.gravado15)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>I.S.V. 15%</span><span>${L(totales.isv15)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>IMPORTE GRAVADO AL 18%</span><span>${L(totales.gravado18)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>I.S.V. 18%</span><span>${L(totales.isv18)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>SERVICIO SUGERIDO</span><span>L. 0.00</span></div>
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;border-top:1px solid #999;border-bottom:2px solid #111;padding:2px 0;margin:3px 0">
        <span>TOTAL A PAGAR</span><span>${L(totales.total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between"><span>Forma de Pago:</span><span>${venta.metodo_pago || 'EFECTIVO'}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Transacción al</span><span>CONTADO</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700"><span>CAMBIO:</span><span>${L(cambio)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>PENDIENTE DE PAGO:</span><span>L. 0.00</span></div>
    </div>
    <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
    <div style="text-align:center;font-size:9px;font-style:italic">
      Son: <strong>${numLetras(totales.total)} LEMPIRAS</strong>
    </div>
    <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
    <div style="font-size:9px;line-height:1.6">
      <div>No. Orden de Compra Exenta:</div>
      <div>No. Constancia del Registro Exonerado:</div>
      <div>No. Identificativo del Registro de la SAG:</div>
      <div style="text-align:center;font-weight:700;margin:3px 0">C.A.I.</div>
      <div style="text-align:center;font-size:9px;word-break:break-all">${empresa.cai}</div>
      <div style="display:flex;justify-content:space-between;margin-top:2px">
        <span>Fecha Límite Emisión:</span><span>${empresa.caiLimite}</span>
      </div>
      <div style="font-size:8px;text-align:center">Rango Autorizado</div>
      <div style="font-size:8px;text-align:center">${empresa.rangoIni} al ${empresa.rangoFin}</div>
    </div>
    <hr style="border:none;border-top:1px dashed #999;margin:4px 0">
    <div style="text-align:center;font-size:9px;color:#555">
      " La Factura es beneficio de todos, ¡Exijala! "<br>
      "Original / Cliente &nbsp;&nbsp; Copia / Emisor"<br>
      <strong>** DevSys Honduras - POSManual **</strong>
    </div>`;
}
