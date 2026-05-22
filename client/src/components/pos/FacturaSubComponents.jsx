/**
 * POSManual - DevSys Honduras
 * Componentes auxiliares del panel de factura
 * Archivo: client/src/components/pos/FacturaSubComponents.jsx
 *
 * Exporta: ItemsFactura | TotalesBox | PagoBox | ModalArticuloManual
 */
import { useState } from 'react';
import { usePOSStore } from '../../store/posStore';

const fmt = (n) => `L. ${Number(n).toFixed(2)}`;

/* ─── ITEMS FACTURA ──────────────────────────────────────── */
export function ItemsFactura() {
  const { items, cambiarQty, eliminarItem } = usePOSStore();

  if (!items.length) {
    return (
      <div className="items-empty">
        <i className="ti ti-shopping-cart" aria-hidden="true" />
        <p>Seleccioná artículos del catálogo<br />o ingresalos manualmente</p>
      </div>
    );
  }

  return (
    <div className="items-list" role="list" aria-label="Artículos en la factura">
      {items.map((it) => (
        <div key={it.codigo} className="item-row" role="listitem">
          <div className="item-info">
            <div className="item-nombre">
              {it.nombre}
              {it.manual && <span className="badge-manual">manual</span>}
            </div>
            <div className="item-meta">
              <span className="item-codigo">{it.codigo}</span>
              {it.isv > 0
                ? <span className="item-isv">ISV {it.isv}%</span>
                : <span className="item-exento">Exento</span>
              }
            </div>
          </div>

          <div className="qty-ctrl" aria-label={`Cantidad: ${it.qty}`}>
            <button
              className="qty-btn"
              onClick={() => cambiarQty(it.codigo, -1)}
              aria-label="Disminuir"
            >−</button>
            <span className="qty-val">{it.qty}</span>
            <button
              className="qty-btn"
              onClick={() => cambiarQty(it.codigo, 1)}
              aria-label="Aumentar"
            >+</button>
          </div>

          <div className="item-precio">{fmt(it.precio * it.qty)}</div>

          <button
            className="item-del"
            onClick={() => eliminarItem(it.codigo)}
            aria-label={`Eliminar ${it.nombre}`}
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── TOTALES BOX ────────────────────────────────────────── */
export function TotalesBox() {
  const { totales } = usePOSStore();
  const { subtotal, descuento, exento, gravado15, isv15, gravado18, isv18, total } = totales;

  return (
    <div className="totales-box" aria-label="Resumen de totales">
      <TotalRow label="Sub Total"            value={subtotal} />
      <TotalRow label="(-) Descuentos"       value={descuento} />
      <TotalRow label="Importe Exento"       value={exento} />
      <TotalRow label="Gravado 15%"          value={gravado15} />
      <TotalRow label="ISV 15%"              value={isv15} />
      <TotalRow label="Gravado 18%"          value={gravado18} />
      <TotalRow label="ISV 18%"              value={isv18} />
      <TotalRow label="TOTAL A PAGAR"        value={total} isMain />
    </div>
  );
}

function TotalRow({ label, value, isMain }) {
  return (
    <div className={`total-row ${isMain ? 'total-main' : ''}`}>
      <span className="total-label">{label}</span>
      <span className="total-val">{fmt(value)}</span>
    </div>
  );
}

/* ─── PAGO BOX ───────────────────────────────────────────── */
const METODOS = [
  { key: 'EFECTIVO',      label: 'Efectivo' },
  { key: 'TARJETA',       label: 'Tarjeta' },
  { key: 'TRANSFERENCIA', label: 'Transf.' },
  { key: 'CREDITO',       label: 'Crédito' },
];

export function PagoBox() {
  const {
    metodoPago, setMetodoPago,
    montoRecibido, setMontoRecibido,
    getCambio, totales,
  } = usePOSStore();

  const cambio = getCambio();
  const okCambio = metodoPago === 'EFECTIVO' && montoRecibido >= totales.total && montoRecibido > 0;

  return (
    <div className="pago-box">
      <div className="pago-label">Forma de pago</div>

      <div className="metodos" role="group" aria-label="Seleccionar método de pago">
        {METODOS.map(m => (
          <button
            key={m.key}
            className={`metodo-btn ${metodoPago === m.key ? 'active' : ''}`}
            onClick={() => setMetodoPago(m.key)}
            aria-pressed={metodoPago === m.key}
          >
            {m.label}
          </button>
        ))}
      </div>

      {metodoPago === 'EFECTIVO' && (
        <>
          <div className="recibido-row">
            <label htmlFor="montoRecibido">Recibido:</label>
            <input
              id="montoRecibido"
              type="number"
              min="0"
              step="1"
              value={montoRecibido || ''}
              placeholder="0.00"
              onChange={e => setMontoRecibido(e.target.value)}
            />
          </div>
          <div className={`cambio-display ${okCambio ? 'cambio-ok' : ''}`}>
            <span>Cambio</span>
            <strong>{fmt(cambio)}</strong>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── MODAL ARTÍCULO MANUAL ──────────────────────────────── */
export function ModalArticuloManual({ initialData = {}, onClose }) {
  const { agregarItemManual } = usePOSStore();
  const [form, setForm] = useState({
    nombre:   initialData.nombre   || '',
    precio:   '',
    cantidad: 1,
    isv:      initialData.isv      ?? 15,
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'El nombre es obligatorio';
    if (!form.precio || +form.precio <= 0) e.precio = 'Ingresá un precio válido';
    if (!form.cantidad || +form.cantidad < 1) e.cantidad = 'Mínimo 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAgregar = () => {
    if (!validar()) return;
    agregarItemManual({
      nombre:   form.nombre.trim(),
      precio:   +form.precio,
      qty:      +form.cantidad,
      isv:      +form.isv,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Artículo manual">
      <div className="modal-box">
        <div className="modal-title">
          <i className="ti ti-edit" aria-hidden="true" /> Artículo Manual
        </div>

        {[
          { id:'nombre',   label:'Descripción del artículo', type:'text',   placeholder:'Ej: Servicio de instalación' },
          { id:'precio',   label:'Precio unitario (L.)',     type:'number', placeholder:'0.00', step:'0.01', min:'0' },
          { id:'cantidad', label:'Cantidad',                 type:'number', placeholder:'1',    step:'1',    min:'1' },
          { id:'isv',      label:'ISV (%)',                  type:'number', placeholder:'15',   step:'1',    min:'0', max:'18' },
        ].map(f => (
          <div key={f.id} className="modal-field">
            <label htmlFor={`mf-${f.id}`}>{f.label}</label>
            <input
              id={`mf-${f.id}`}
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.id]}
              onChange={e => set(f.id, e.target.value)}
              step={f.step} min={f.min} max={f.max}
            />
            {errors[f.id] && (
              <span className="field-error">{errors[f.id]}</span>
            )}
          </div>
        ))}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="btn-confirm" onClick={handleAgregar}>
            <i className="ti ti-plus" aria-hidden="true" /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
