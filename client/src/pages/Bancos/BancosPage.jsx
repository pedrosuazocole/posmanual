/**
 * POSManual - DevSys Honduras
 * Página: Módulo de Bancos
 * Archivo: client/src/pages/Bancos/BancosPage.jsx
 *
 * Funciones:
 *  - Tarjetas de cuentas bancarias con saldo en tiempo real
 *  - Historial de movimientos por cuenta con filtros
 *  - Nuevo movimiento (Depósito / Retiro / Transferencia / Pago proveedor / Cobro cliente)
 *  - Preview del nuevo saldo antes de confirmar
 *  - Crear nueva cuenta bancaria
 *  - Exportar estado de cuenta a Excel
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import api from '../../api/axios';
import styles from './BancosPage.module.css';

const fmt  = n => `L. ${(+n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`;
const fmtN = n => (+(n||0)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');

const TIPOS = {
  DEPOSITO:       { label:'Depósito',         positivo:true,  badge:'b-ok', color:'#27500A' },
  COBRO_CLIENTE:  { label:'Cobro cliente',    positivo:true,  badge:'b-ok', color:'#27500A' },
  RETIRO:         { label:'Retiro',           positivo:false, badge:'b-er', color:'#A32D2D' },
  PAGO_PROVEEDOR: { label:'Pago proveedor',   positivo:false, badge:'b-wa', color:'#633806' },
  TRANSFERENCIA:  { label:'Transferencia',    positivo:false, badge:'b-in', color:'#0C447C' },
};

const BANCO_COLORS = ['#1B4F9B','#27500A','#633806','#3C3489','#0F6E56','#A32D2D'];

export default function BancosPage() {
  const [bancoActivo, setBancoActivo] = useState(null);
  const [search,   setSearch]   = useState('');
  const [tipoFil,  setTipoFil]  = useState('');
  const [fi, setFi] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [ff, setFf] = useState(() => new Date().toISOString().slice(0,10));
  const [modalBanco, setModalBanco] = useState(false);
  const [modalMov,   setModalMov]   = useState(false);
  const qc = useQueryClient();

  // ── Bancos ────────────────────────────────────────────────
  const { data: bancos = [] } = useQuery({
    queryKey: ['bancos'],
    queryFn: () => api.get('/bancos').then(r => r.data),
    placeholderData: [],
    onSuccess: (data) => { if (!bancoActivo && data.length) setBancoActivo(data[0].id); },
  });

  // Seleccionar el primero al cargar
  const bancoSel = bancos.find(b => b.id === bancoActivo) || bancos[0];
  if (!bancoActivo && bancos.length) setBancoActivo(bancos[0].id);

  // ── Movimientos ───────────────────────────────────────────
  const { data: movimientos = [] } = useQuery({
    queryKey: ['movimientos-banco', bancoActivo, search, tipoFil, fi, ff],
    queryFn: () => api.get('/bancos/movimientos', {
      params: { banco_id: bancoActivo, q: search, tipo: tipoFil, fecha_ini: fi, fecha_fin: ff }
    }).then(r => r.data),
    enabled: Boolean(bancoActivo),
    placeholderData: [],
  });

  // ── Mutations ─────────────────────────────────────────────
  const crearBancoMut = useMutation({
    mutationFn: (data) => api.post('/bancos', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries(['bancos']);
      toast.success('Cuenta bancaria creada');
      setBancoActivo(data.id);
      setModalBanco(false);
    },
    onError: err => toast.error(err.response?.data?.message || 'Error al crear cuenta'),
  });

  const movMut = useMutation({
    mutationFn: (data) => api.post('/bancos/movimientos', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['bancos', 'movimientos-banco']);
      toast.success('Movimiento registrado');
      setModalMov(false);
    },
    onError: err => toast.error(err.response?.data?.message || 'Error al registrar movimiento'),
  });

  // ── Exportar ──────────────────────────────────────────────
  const exportar = () => {
    const banco = bancos.find(b => b.id === bancoActivo);
    const ws = XLSX.utils.json_to_sheet(movimientos.map(m => ({
      Fecha:       new Date(m.creado_en).toLocaleDateString('es-HN'),
      Tipo:        TIPOS[m.tipo]?.label || m.tipo,
      Descripción: m.descripcion,
      Referencia:  m.referencia || '',
      Monto:       +m.monto,
      'Nuevo saldo': +m.saldo_nuevo,
      Usuario:     m.usuario_nombre,
    })));
    ws['!cols'] = [12,16,30,14,10,12,14].map(w => ({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, banco?.nombre?.slice(0,25) || 'Banco');
    XLSX.writeFile(wb, `estado_cuenta_${banco?.numero || bancoActivo}.xlsx`);
    toast.success('Estado de cuenta exportado');
  };

  // ── Stats globales ────────────────────────────────────────
  const saldoTotal = bancos.filter(b => b.activo).reduce((s, b) => s + +b.saldo_actual, 0);

  return (
    <div className={styles.page}>
      {/* Stats globales */}
      <div className={styles.statsRow}>
        {[
          { label:'Saldo total consolidado', val:fmt(saldoTotal),                   color:'#27500A' },
          { label:'Cuentas activas',         val:bancos.filter(b=>b.activo).length, color:'#185FA5' },
          { label:'Entradas del mes',        val:fmt(movimientos.filter(m=>TIPOS[m.tipo]?.positivo).reduce((s,m)=>s+ +m.monto,0)), color:'#0C447C' },
        ].map(s => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statLbl}>{s.label}</div>
            <div className={styles.statVal} style={{color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tarjetas de cuentas */}
      <div className={styles.bancoCards}>
        {bancos.filter(b => b.activo).map((b, i) => (
          <div key={b.id}
            className={`${styles.bancoCard} ${b.id === bancoActivo ? styles.bancoCardActive : ''}`}
            onClick={() => setBancoActivo(b.id)}
            role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setBancoActivo(b.id)}
            aria-pressed={b.id === bancoActivo}
          >
            <div className={styles.bancoIcon} style={{background:`${BANCO_COLORS[i % BANCO_COLORS.length]}20`, color:BANCO_COLORS[i % BANCO_COLORS.length]}}>
              <i className="ti ti-building-bank" aria-hidden="true" />
            </div>
            <div className={styles.bancoNombre}>{b.nombre}</div>
            <div className={styles.bancoNum}>{b.numero_cuenta}</div>
            <div className={styles.bancoSaldo} style={{color:+b.saldo_actual >= 0 ? '#27500A' : '#A32D2D'}}>
              {fmt(b.saldo_actual)}
            </div>
          </div>
        ))}
      </div>

      {/* Cabecera de la sección de movimientos */}
      <div className={styles.movHeader}>
        <div className={styles.movTitulo}>
          Movimientos — {bancoSel?.nombre || '…'}
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={exportar} className={styles.btnSec}><i className="ti ti-download" aria-hidden="true" /> Exportar</button>
          <button onClick={() => setModalBanco(true)} className={styles.btnSec}><i className="ti ti-building-bank" aria-hidden="true" /> Nueva cuenta</button>
          <button onClick={() => setModalMov(true)} className={styles.btnOk}><i className="ti ti-plus" aria-hidden="true" /> Nuevo movimiento</button>
        </div>
      </div>

      {/* Filtros de movimientos */}
      <div className={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar descripción o referencia..." />
        <select value={tipoFil} onChange={e => setTipoFil(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input type="date" value={fi} onChange={e=>setFi(e.target.value)} style={dateInputStyle} />
        <input type="date" value={ff} onChange={e=>setFf(e.target.value)} style={dateInputStyle} />
      </div>

      {/* Tabla de movimientos */}
      <div className={styles.tableWrap}>
        <table>
          <colgroup>
            <col style={{width:95}}/><col style={{width:110}}/><col style={{width:210}}/>
            <col style={{width:85}}/><col style={{width:90}}/><col style={{width:85}}/>
          </colgroup>
          <thead><tr>
            <th>Fecha</th><th>Tipo</th><th>Descripción</th>
            <th style={{textAlign:'right'}}>Monto</th><th style={{textAlign:'right'}}>Saldo</th><th>Usuario</th>
          </tr></thead>
          <tbody>
            {movimientos.length === 0 ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:32,color:'var(--color-text-tertiary)'}}>Sin movimientos en este período</td></tr>
            ) : movimientos.map(m => {
              const t = TIPOS[m.tipo] || { label:m.tipo, positivo:true, color:'#185FA5' };
              return (
                <tr key={m.id}>
                  <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>{new Date(m.creado_en).toLocaleDateString('es-HN')}</td>
                  <td><span style={{background:`${t.color}18`,color:t.color,borderRadius:10,padding:'2px 8px',fontSize:10,fontWeight:500}}>{t.label}</span></td>
                  <td style={{color:'var(--color-text-secondary)',fontSize:11}}>
                    {m.descripcion}
                    {m.referencia && <span style={{fontFamily:'monospace',fontSize:9,color:'var(--color-text-tertiary)',marginLeft:5}}>{m.referencia}</span>}
                  </td>
                  <td style={{textAlign:'right',fontFamily:'monospace',fontSize:11,fontWeight:500,color:t.positivo?'#27500A':'#A32D2D'}}>
                    {t.positivo ? '+' : '-'}{fmtN(m.monto)}
                  </td>
                  <td style={{textAlign:'right',fontFamily:'monospace',fontSize:11,fontWeight:500}}>{fmtN(m.saldo_nuevo)}</td>
                  <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>{m.usuario_nombre}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nueva cuenta */}
      {modalBanco && <NuevaBancoModal onSave={d => crearBancoMut.mutate(d)} onClose={() => setModalBanco(false)} saving={crearBancoMut.isPending} />}

      {/* Modal nuevo movimiento */}
      {modalMov && (
        <NuevoMovModal
          bancos={bancos.filter(b => b.activo)}
          bancoDefault={bancoActivo}
          onSave={d => movMut.mutate(d)}
          onClose={() => setModalMov(false)}
          saving={movMut.isPending}
        />
      )}
    </div>
  );
}

/* ── NuevaBancoModal ─────────────────────────────────────── */
function NuevaBancoModal({ onSave, onClose, saving }) {
  const [form, setForm] = useState({ nombre:'', numero_cuenta:'', saldo_inicial:0 });
  const set = (k, v) => setForm(p => ({...p,[k]:v}));
  return (
    <ModalWrap title="Nueva cuenta bancaria" icon="ti-building-bank" onClose={onClose}>
      <div style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
        <div><label style={labelSt}>Nombre del banco / cuenta *</label>
          <input value={form.nombre} onChange={e=>set('nombre',e.target.value)} placeholder="Ej: Banco Atlántida — Cta Corriente" style={{...inpSt(),width:'100%',marginTop:4}} /></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <div><label style={labelSt}>Número de cuenta</label>
            <input value={form.numero_cuenta} onChange={e=>set('numero_cuenta',e.target.value)} placeholder="XXXX-XXXX-XXXX" style={{...inpSt(),width:'100%',marginTop:4}} /></div>
          <div><label style={labelSt}>Saldo inicial (L.)</label>
            <input type="number" min="0" step="0.01" value={form.saldo_inicial} onChange={e=>set('saldo_inicial',+e.target.value)} style={{...inpSt(),width:'100%',marginTop:4,textAlign:'right'}} /></div>
        </div>
      </div>
      <ModalFooter onClose={onClose} onSave={() => { if(!form.nombre.trim()){return;} onSave(form); }} saving={saving} label="Crear cuenta" />
    </ModalWrap>
  );
}

/* ── NuevoMovModal ───────────────────────────────────────── */
function NuevoMovModal({ bancos, bancoDefault, onSave, onClose, saving }) {
  const [form, setForm] = useState({ banco_id:bancoDefault||bancos[0]?.id||'', tipo:'', monto:'', referencia:'', descripcion:'' });
  const set = (k, v) => setForm(p => ({...p,[k]:v}));
  const banco = bancos.find(b => b.id === +form.banco_id);
  const t     = TIPOS[form.tipo];
  const m     = +form.monto || 0;
  const nuevo = banco && t ? (t.positivo ? +banco.saldo_actual + m : +banco.saldo_actual - m) : null;

  return (
    <ModalWrap title="Nuevo movimiento bancario" icon="ti-transfer" onClose={onClose}>
      <div style={{padding:16,display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        <div style={{gridColumn:'1/-1'}}><label style={labelSt}>Cuenta bancaria *</label>
          <select value={form.banco_id} onChange={e=>set('banco_id',+e.target.value)} style={{...inpSt(),width:'100%',marginTop:4}}>
            {bancos.map(b=><option key={b.id} value={b.id}>{b.nombre} ({fmt(b.saldo_actual)})</option>)}
          </select></div>
        <div style={{gridColumn:'1/-1'}}><label style={labelSt}>Tipo de movimiento *</label>
          <select value={form.tipo} onChange={e=>set('tipo',e.target.value)} style={{...inpSt(),width:'100%',marginTop:4}}>
            <option value="">Seleccionar...</option>
            {Object.entries(TIPOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div><label style={labelSt}>Monto (L.) *</label>
          <input type="number" min="0.01" step="0.01" value={form.monto} onChange={e=>set('monto',e.target.value)} placeholder="0.00" style={{...inpSt(),width:'100%',marginTop:4,textAlign:'right'}} /></div>
        <div><label style={labelSt}>Referencia</label>
          <input value={form.referencia} onChange={e=>set('referencia',e.target.value)} placeholder="Nº cheque, transferencia..." style={{...inpSt(),width:'100%',marginTop:4}} /></div>
        <div style={{gridColumn:'1/-1'}}><label style={labelSt}>Descripción</label>
          <input value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} placeholder="Concepto del movimiento" style={{...inpSt(),width:'100%',marginTop:4}} /></div>
        {nuevo !== null && m > 0 && (
          <div style={{gridColumn:'1/-1',background:'var(--color-background-secondary)',borderRadius:'var(--border-radius-md)',padding:'9px 12px',fontSize:12,color:'var(--color-text-secondary)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>Nuevo saldo:</span>
            <span style={{fontFamily:'monospace',fontSize:15,fontWeight:500,color:nuevo>=0?'#27500A':'#A32D2D'}}>
              {fmt(banco.saldo_actual)} → <strong>{fmt(nuevo)}</strong>
            </span>
          </div>
        )}
      </div>
      <ModalFooter onClose={onClose} onSave={() => { if(!form.banco_id||!form.tipo||!+form.monto){toast.error('Completá los campos obligatorios');return;} onSave(form); }} saving={saving} label="Registrar" okColor="#27500A" />
    </ModalWrap>
  );
}

/* ── Helpers compartidos ─────────────────────────────────── */
function ModalWrap({ title, icon = 'ti-coin', color = '#185FA5', onClose, children }) {
  return (
    <div style={{minHeight:380,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--border-radius-lg)',marginTop:14}}>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',width:460,maxWidth:'100%'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
          <h3 style={{fontSize:14,fontWeight:500,display:'flex',alignItems:'center',gap:7}}>
            <i className={`ti ${icon}`} style={{color,fontSize:15}} aria-hidden="true" /> {title}
          </h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:17,color:'var(--color-text-secondary)'}} aria-label="Cerrar"><i className="ti ti-x" aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModalFooter({ onClose, onSave, saving, label, okColor='#1B4F9B' }) {
  return (
    <div style={{display:'flex',gap:8,justifyContent:'flex-end',padding:'13px 18px',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
      <button onClick={onClose} style={{background:'transparent',border:'0.5px solid var(--color-border-secondary)',padding:'8px 14px',borderRadius:'var(--border-radius-md)',fontSize:12,cursor:'pointer',color:'var(--color-text-primary)'}}>Cancelar</button>
      <button onClick={onSave} disabled={saving} style={{background:okColor,color:'#fff',border:'none',padding:'9px 18px',borderRadius:'var(--border-radius-md)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:saving?.6:1}}>
        {saving?'Guardando...':<><i className="ti ti-check" aria-hidden="true"/> {label}</>}
      </button>
    </div>
  );
}
function SearchInput({value,onChange,placeholder}){
  return(
    <div style={{position:'relative',flex:1,minWidth:140}}>
      <i className="ti ti-search" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:15,color:'var(--color-text-tertiary)',pointerEvents:'none'}} aria-hidden="true"/>
      <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'7px 10px 7px 32px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}}/>
    </div>
  );
}
const labelSt={fontSize:10,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px'};
const inpSt=(err)=>({padding:'7px 9px',border:`0.5px solid ${err?'#A32D2D':'var(--color-border-secondary)'}`,borderRadius:'var(--border-radius-md)',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'});
const dateInputStyle={padding:'7px 10px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:12,background:'var(--color-background-primary)',color:'var(--color-text-primary)'};
