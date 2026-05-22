/**
 * POSManual - DevSys Honduras
 * Modales: Cuenta + Pago
 * Archivo: client/src/pages/Cuentas/CuentaModal.jsx
 */
import { useState } from 'react';

/* ── MODAL CREAR / EDITAR CUENTA ─────────────────────────── */
export function CuentaModal({ cuenta, tipoDefault, onSave, onClose, saving }) {
  const isEdit = Boolean(cuenta?.id);
  const [form, setForm] = useState({
    id:              cuenta?.id               ?? undefined,
    tipo:            cuenta?.tipo             ?? tipoDefault ?? 'COBRAR',
    tercero_nombre:  cuenta?.tercero_nombre   ?? '',
    tercero_rtn:     cuenta?.tercero_rtn      ?? '',
    descripcion:     cuenta?.descripcion      ?? '',
    monto_total:     cuenta?.monto_total      ?? '',
    fecha_vencimiento: cuenta?.fecha_vencimiento
      ? new Date(cuenta.fecha_vencimiento).toISOString().slice(0,10) : '',
    proveedor_id:    cuenta?.proveedor_id     ?? null,
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validar = () => {
    const e = {};
    if (!form.tercero_nombre.trim()) e.tercero_nombre = 'Obligatorio';
    if (!form.descripcion.trim())    e.descripcion    = 'Obligatorio';
    if (!form.monto_total || +form.monto_total <= 0) e.monto_total = 'Debe ser mayor a 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validar()) return;
    onSave({
      ...form,
      monto_total:       +form.monto_total,
      fecha_vencimiento: form.fecha_vencimiento || null,
      tercero_nombre:    form.tercero_nombre.trim(),
      descripcion:       form.descripcion.trim(),
      tercero_rtn:       form.tercero_rtn.trim() || null,
    });
  };

  const tipoLabel = form.tipo === 'COBRAR' ? 'cobrar' : 'pagar';

  return (
    <ModalWrapper title={`${isEdit ? 'Editar' : 'Nueva'} cuenta por ${tipoLabel}`} onClose={onClose}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,padding:18}}>

        {/* Tipo (solo al crear) */}
        {!isEdit && (
          <div style={{gridColumn:'1/-1'}}>
            <label style={labelStyle}>Tipo de cuenta</label>
            <div style={{display:'flex',gap:8,marginTop:4}}>
              {['COBRAR','PAGAR'].map(t => (
                <button key={t} type="button" onClick={() => set('tipo', t)}
                  style={{flex:1,padding:'8px',border:`0.5px solid ${form.tipo===t?(t==='COBRAR'?'#C0DD97':'#F09595'):'var(--color-border-secondary)'}`,borderRadius:'var(--border-radius-md)',background:form.tipo===t?(t==='COBRAR'?'#EAF3DE':'#FCEBEB'):'var(--color-background-primary)',color:form.tipo===t?(t==='COBRAR'?'#27500A':'#791F1F'):'var(--color-text-secondary)',cursor:'pointer',fontSize:12,fontWeight:form.tipo===t?500:400,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  <i className={`ti ${t==='COBRAR'?'ti-arrow-down-circle':'ti-arrow-up-circle'}`} style={{fontSize:15}} aria-hidden="true" />
                  {t === 'COBRAR' ? 'Por cobrar (cliente)' : 'Por pagar (proveedor)'}
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Tercero (nombre) *" error={errors.tercero_nombre} full>
          <input value={form.tercero_nombre} onChange={e => { set('tercero_nombre', e.target.value); setErrors(p=>({...p,tercero_nombre:''})); }}
            placeholder="Nombre del cliente o proveedor" style={inputStyle(errors.tercero_nombre)} />
        </Field>

        <Field label="RTN">
          <input value={form.tercero_rtn} onChange={e => set('tercero_rtn', e.target.value)}
            placeholder="0000000" style={inputStyle()} />
        </Field>

        <Field label="Monto total (L.) *" error={errors.monto_total}>
          <input type="number" min="0" step="0.01" value={form.monto_total}
            onChange={e => { set('monto_total', e.target.value); setErrors(p=>({...p,monto_total:''})); }}
            placeholder="0.00" style={inputStyle(errors.monto_total)} />
        </Field>

        <Field label="Descripción / concepto *" error={errors.descripcion} full>
          <input value={form.descripcion} onChange={e => { set('descripcion', e.target.value); setErrors(p=>({...p,descripcion:''})); }}
            placeholder="Ej: Venta a crédito — Factura 000-001" style={inputStyle(errors.descripcion)} />
        </Field>

        <Field label="Fecha de vencimiento">
          <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)}
            style={inputStyle()} />
        </Field>

      </div>
      <ModalFoot onClose={onClose} onSave={handleSave} saving={saving} label={isEdit ? 'Actualizar' : 'Crear cuenta'} />
    </ModalWrapper>
  );
}

/* ── MODAL REGISTRAR PAGO ────────────────────────────────── */
export function PagoModal({ cuenta, onPagar, onClose, saving }) {
  const saldo = +cuenta.saldo || (+cuenta.monto_total - +cuenta.monto_pagado);
  const [monto,   setMonto]   = useState(saldo.toFixed(2));
  const [metodo,  setMetodo]  = useState('EFECTIVO');
  const [obs,     setObs]     = useState('');
  const [error,   setError]   = useState('');

  const m = +monto || 0;
  const nuevoSaldo = Math.max(0, saldo - m);
  const liquidada  = nuevoSaldo < 0.01;

  const handlePagar = () => {
    if (!m || m <= 0)      { setError('Ingresá un monto válido'); return; }
    if (m > saldo + 0.01)  { setError('El monto supera el saldo pendiente'); return; }
    onPagar({ monto: m, metodo, observaciones: obs.trim() || null });
  };

  return (
    <ModalWrapper
      title={`Registrar pago — ${cuenta.tercero_nombre}`}
      titleIcon="ti-cash"
      titleColor="#27500A"
      onClose={onClose}
    >
      <div style={{padding:18,display:'flex',flexDirection:'column',gap:12}}>

        {/* Resumen de la cuenta */}
        <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'10px 12px',fontSize:12,color:'var(--color-text-secondary)'}}>
          {[
            ['Monto total', `L. ${(+cuenta.monto_total).toFixed(2)}`],
            ['Ya pagado',   `L. ${(+cuenta.monto_pagado).toFixed(2)}`],
            ['Saldo pendiente', `L. ${saldo.toFixed(2)}`],
          ].map(([k, v], i) => (
            <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',borderBottom:i<2?'0.5px solid var(--color-border-tertiary)':'none'}}>
              <span>{k}</span>
              <span style={{fontFamily:'monospace',fontWeight:i===2?500:400,color:i===2?'#A32D2D':'var(--color-text-primary)',fontSize:i===2?14:12}}>{v}</span>
            </div>
          ))}
        </div>

        {/* Monto a pagar */}
        <div>
          <label style={{...labelStyle, display:'block', marginBottom:4}}>Monto a pagar (L.) *</label>
          <input type="number" min="0.01" step="0.01" max={saldo} value={monto}
            onChange={e => { setMonto(e.target.value); setError(''); }}
            style={{...inputStyle(error), width:'100%', fontSize:18, fontWeight:500, textAlign:'right'}} />
          {error && <div style={{fontSize:11,color:'#A32D2D',marginTop:3}}>{error}</div>}
        </div>

        {/* Método */}
        <div>
          <label style={{...labelStyle, display:'block', marginBottom:4}}>Método de pago</label>
          <select value={metodo} onChange={e => setMetodo(e.target.value)} style={{...inputStyle(), width:'100%'}}>
            {['EFECTIVO','TARJETA_DEBITO','TARJETA_CREDITO','TRANSFERENCIA','CHEQUE'].map(m =>
              <option key={m} value={m}>{m.replace('_',' ')}</option>
            )}
          </select>
        </div>

        {/* Observaciones */}
        <div>
          <label style={{...labelStyle, display:'block', marginBottom:4}}>Observaciones</label>
          <input type="text" value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Nº recibo, referencia transferencia, etc."
            style={{...inputStyle(), width:'100%'}} />
        </div>

        {/* Preview nuevo saldo */}
        {m > 0 && (
          <div style={{background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'9px 12px',fontSize:12,color:'var(--color-text-secondary)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>Nuevo saldo después del pago:</span>
            <span style={{fontFamily:'monospace',fontSize:16,fontWeight:500,color:liquidada?'#27500A':'#633806'}}>
              L. {nuevoSaldo.toFixed(2)}
              <span style={{fontSize:11,fontWeight:400,marginLeft:6}}>{liquidada ? '— Cuenta liquidada' : '— Pago parcial'}</span>
            </span>
          </div>
        )}
      </div>
      <ModalFoot onClose={onClose} onSave={handlePagar} saving={saving} label="Registrar pago" okColor="#27500A" />
    </ModalWrapper>
  );
}

/* ── Helpers ────────────────────────────────────────────── */
function ModalWrapper({ title, titleIcon = 'ti-coin', titleColor = '#185FA5', onClose, children }) {
  return (
    <div style={{minHeight:400,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--border-radius-lg)',marginTop:14}}>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',width:480,maxWidth:'100%'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
          <h3 style={{fontSize:14,fontWeight:500,display:'flex',alignItems:'center',gap:7}}>
            <i className={`ti ${titleIcon}`} style={{color:titleColor,fontSize:15}} aria-hidden="true" /> {title}
          </h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:17,color:'var(--color-text-secondary)'}} aria-label="Cerrar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFoot({ onClose, onSave, saving, label, okColor = '#1B4F9B' }) {
  return (
    <div style={{display:'flex',gap:8,justifyContent:'flex-end',padding:'13px 18px',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
      <button onClick={onClose} style={{background:'transparent',border:'0.5px solid var(--color-border-secondary)',padding:'8px 14px',borderRadius:'var(--border-radius-md)',fontSize:12,cursor:'pointer',color:'var(--color-text-primary)'}}>
        Cancelar
      </button>
      <button onClick={onSave} disabled={saving}
        style={{background:okColor,color:'#fff',border:'none',padding:'9px 18px',borderRadius:'var(--border-radius-md)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:saving?.6:1}}>
        {saving ? 'Guardando...' : <><i className="ti ti-check" aria-hidden="true" /> {label}</>}
      </button>
    </div>
  );
}

function Field({ label, error, full, children }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:3,...(full?{gridColumn:'1/-1'}:{})}}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <span style={{fontSize:11,color:'#A32D2D'}}>{error}</span>}
    </div>
  );
}

const labelStyle = { fontSize:10, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.3px' };
const inputStyle = (err) => ({
  padding:'7px 9px', border:`0.5px solid ${err?'#A32D2D':'var(--color-border-secondary)'}`,
  borderRadius:'var(--border-radius-md)', fontSize:13,
  background:'var(--color-background-primary)', color:'var(--color-text-primary)', outline:'none',
});
