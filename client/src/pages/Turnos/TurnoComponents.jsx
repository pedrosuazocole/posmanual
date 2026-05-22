/**
 * POSManual - DevSys Honduras
 * Sub-componentes del módulo de turnos
 * Archivo: client/src/pages/Turnos/TurnoComponents.jsx
 *
 * Exporta: ArqueoForm | ModalApertura
 */
import { useState } from 'react';

const fmt  = n => `L. ${(+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

/* ── MODAL APERTURA ────────────────────────────────────────── */
export function ModalApertura({ onAbrir, abriendo, onClose }) {
  const [fondo, setFondo] = useState(2000);

  return (
    <div style={{ minHeight:340, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'var(--border-radius-lg)', marginTop:16 }}>
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', width:400, padding:24 }}
        role="dialog" aria-modal="true" aria-label="Apertura de turno">
        <div style={{ fontSize:15, fontWeight:500, marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-lock-open" style={{ color:'#185FA5', fontSize:18 }} aria-hidden="true" />
          Apertura de turno
        </div>

        <div style={{ marginBottom:12 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:5 }}>
            Fondo inicial de caja (L.)
          </label>
          <input
            type="number" min={0} step={100} value={fondo}
            onChange={e => setFondo(+e.target.value)}
            style={{ width:'100%', padding:'10px 12px', border:'0.5px solid var(--color-border-secondary)', borderRadius:'var(--border-radius-md)', fontSize:18, fontWeight:500, textAlign:'right', background:'var(--color-background-primary)', color:'var(--color-text-primary)', outline:'none' }}
            onFocus={e => e.target.select()}
          />
        </div>

        <div style={{ background:'var(--color-background-secondary)', borderRadius:'var(--border-radius-md)', padding:'10px 12px', fontSize:12, color:'var(--color-text-secondary)', marginBottom:18 }}>
          <i className="ti ti-clock" style={{ fontSize:13, verticalAlign:-2, marginRight:4 }} aria-hidden="true" />
          Apertura: <strong>{new Date().toLocaleString('es-HN')}</strong>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'transparent', border:'0.5px solid var(--color-border-secondary)', padding:'8px 14px', borderRadius:'var(--border-radius-md)', fontSize:13, cursor:'pointer', color:'var(--color-text-primary)' }}>
            Cancelar
          </button>
          <button onClick={() => onAbrir({ fondo })} disabled={abriendo || fondo < 0}
            style={{ background:'#1B4F9B', color:'#fff', border:'none', padding:'9px 18px', borderRadius:'var(--border-radius-md)', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, opacity: abriendo ? .6 : 1 }}>
            {abriendo
              ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' }} /> Abriendo...</>
              : <><i className="ti ti-lock-open" aria-hidden="true" /> Abrir turno</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ARQUEO FORM ───────────────────────────────────────────── */
export function ArqueoForm({ turno, ventas, onCerrar, cerrando, onVolver }) {
  const comp  = ventas.filter(v => v.estado === 'COMPLETADA');
  const efecS = comp.filter(v => v.metodo_pago === 'EFECTIVO').reduce((s,v) => s + +v.total, 0);
  const tarjS = comp.filter(v => v.metodo_pago?.startsWith('TARJETA')).reduce((s,v) => s + +v.total, 0);
  const transS = comp.filter(v => v.metodo_pago === 'TRANSFERENCIA').reduce((s,v) => s + +v.total, 0);
  const sistemaCalcula = (+turno.monto_inicial || 0) + efecS + tarjS + transS;

  const [declarado, setDeclarado] = useState({ efec: 0, tarj: 0, trans: 0, otros: 0 });
  const [obs, setObs] = useState('');

  const set = (k, v) => setDeclarado(p => ({ ...p, [k]: +v || 0 }));
  const totalDeclarado = Object.values(declarado).reduce((s, v) => s + v, 0);
  const diferencia = +(totalDeclarado - sistemaCalcula).toFixed(2);

  const handleCerrar = () => onCerrar({
    monto_final_declarado: totalDeclarado,
    monto_final_sistema:   sistemaCalcula,
    observaciones:         obs.trim() || null,
  });

  const diffColor = diferencia === 0 ? '#27500A' : diferencia > 0 ? '#185FA5' : '#A32D2D';

  return (
    <div>
      <div style={{ background:'var(--color-background-warning)', border:'0.5px solid var(--color-border-warning)', borderRadius:'var(--border-radius-md)', padding:'10px 14px', fontSize:12, color:'var(--color-text-warning)', display:'flex', gap:8, marginBottom:14 }}>
        <i className="ti ti-alert-triangle" style={{ fontSize:16, flexShrink:0, marginTop:1 }} aria-hidden="true" />
        Al cerrar el turno ya no podrás facturar. Contá el efectivo físico antes de continuar.
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>

        {/* Sistema */}
        <div style={{ border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:14 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>Sistema calcula</div>
          {[
            ['Fondo inicial',    fmt(turno.monto_inicial || 0)],
            ['Ventas efectivo',  fmt(efecS)],
            ['Ventas tarjeta',   fmt(tarjS)],
            ['Transferencias',   fmt(transS)],
          ].map(([k, v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:13 }}>
              <span>{k}</span><span style={{ fontFamily:'monospace' }}>{v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 0', fontSize:14, fontWeight:500, borderTop:'1px solid var(--color-border-primary)', marginTop:4 }}>
            <span>Total sistema</span><span style={{ fontFamily:'monospace', color:'#1B4F9B' }}>{fmt(sistemaCalcula)}</span>
          </div>
        </div>

        {/* Cajero declara */}
        <div style={{ border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:14 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>Cajero declara</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { key:'efec',  label:'Efectivo (L.)' },
              { key:'tarj',  label:'Tarjeta (L.)' },
              { key:'trans', label:'Transferencia (L.)' },
              { key:'otros', label:'Otros (L.)' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display:'flex', flexDirection:'column', gap:3 }}>
                <label style={{ fontSize:11, color:'var(--color-text-secondary)', fontWeight:500 }}>{label}</label>
                <input
                  type="number" min={0} step={0.01} value={declarado[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder="0.00"
                  style={{ padding:'7px 10px', border:'0.5px solid var(--color-border-secondary)', borderRadius:'var(--border-radius-md)', fontSize:13, fontFamily:'monospace', textAlign:'right', background:'var(--color-background-primary)', color:'var(--color-text-primary)', outline:'none' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 0', fontSize:14, fontWeight:500, borderTop:'1px solid var(--color-border-primary)', marginTop:10 }}>
            <span>Total declarado</span><span style={{ fontFamily:'monospace' }}>{fmt(totalDeclarado)}</span>
          </div>
        </div>
      </div>

      {/* Diferencia */}
      <div style={{ background: diferencia === 0 ? 'var(--color-background-success)' : diferencia > 0 ? 'var(--color-background-info)' : 'var(--color-background-danger)', border: `0.5px solid ${diferencia===0?'var(--color-border-success)':diferencia>0?'var(--color-border-info)':'var(--color-border-danger)'}`, borderRadius:'var(--border-radius-md)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:14, marginBottom:12 }}>
        <span style={{ fontWeight:500, color: diffColor }}>Diferencia de caja</span>
        <span style={{ fontFamily:'monospace', fontSize:18, fontWeight:500, color: diffColor }}>
          {diferencia >= 0 ? '+' : ''}{fmt(diferencia)}
        </span>
      </div>

      {/* Observaciones */}
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'block', fontSize:11, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.3px', marginBottom:5 }}>
          Observaciones del turno
        </label>
        <textarea
          value={obs} onChange={e => setObs(e.target.value)}
          placeholder="Novedad del turno, faltante de efectivo, artículo sin código, etc."
          style={{ width:'100%', padding:'8px 10px', border:'0.5px solid var(--color-border-secondary)', borderRadius:'var(--border-radius-md)', fontSize:13, background:'var(--color-background-primary)', color:'var(--color-text-primary)', outline:'none', resize:'vertical', minHeight:64 }}
        />
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onVolver} style={{ background:'transparent', border:'0.5px solid var(--color-border-secondary)', padding:'8px 14px', borderRadius:'var(--border-radius-md)', fontSize:12, cursor:'pointer', color:'var(--color-text-primary)', display:'flex', alignItems:'center', gap:5 }}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Volver
        </button>
        <button onClick={handleCerrar} disabled={cerrando}
          style={{ background:'#A32D2D', color:'#fff', border:'none', padding:'9px 18px', borderRadius:'var(--border-radius-md)', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, opacity: cerrando ? .6 : 1 }}>
          {cerrando
            ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' }} /> Cerrando...</>
            : <><i className="ti ti-lock" aria-hidden="true" /> Confirmar cierre de turno</>
          }
        </button>
      </div>
    </div>
  );
}
