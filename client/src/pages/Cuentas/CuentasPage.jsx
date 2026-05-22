/**
 * POSManual - DevSys Honduras
 * Página: Cuentas por Cobrar / Cuentas por Pagar
 * Archivo: client/src/pages/Cuentas/CuentasPage.jsx
 *
 * Pestañas:
 *  1. Por cobrar  — facturas de clientes a crédito, estado y saldo
 *  2. Por pagar   — obligaciones con proveedores
 *  3. Historial   — todos los pagos registrados (cobros + pagos)
 *
 * Acciones:
 *  - Crear / editar cuenta (cobrar o pagar)
 *  - Registrar pago parcial o total con método de pago
 *  - Exportar Excel por tipo
 *  - Alertas automáticas de vencimiento
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import api  from '../../api/axios';
import CuentaModal from './CuentaModal';
import PagoModal   from './PagoModal';
import styles      from './CuentasPage.module.css';

const fmt  = n => `L. ${(+n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}`;
const fmtN = n => (+(n||0)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');

const ESTADO_BADGE = {
  PENDIENTE: { bg:'#E6F1FB', txt:'#0C447C', label:'Pendiente' },
  PARCIAL:   { bg:'#FAEEDA', txt:'#633806', label:'Parcial'   },
  PAGADO:    { bg:'#EAF3DE', txt:'#27500A', label:'Pagado'    },
  VENCIDO:   { bg:'#FCEBEB', txt:'#791F1F', label:'Vencido'   },
};

export default function CuentasPage() {
  const [tab,    setTab]    = useState('cobrar');
  const [modal,  setModal]  = useState(null);   // null | { tipo } | cuenta
  const [pago,   setPago]   = useState(null);   // null | cuenta
  const [search, setSearch] = useState('');
  const [estFil, setEstFil] = useState('');
  const qc = useQueryClient();

  const tipo = tab === 'cobrar' ? 'COBRAR' : 'PAGAR';

  // ── Cuentas ───────────────────────────────────────────────
  const { data: cuentas = [] } = useQuery({
    queryKey: ['cuentas', tipo, search, estFil],
    queryFn: () => api.get('/cuentas', { params: { tipo, q: search, estado: estFil } }).then(r => r.data),
    enabled: tab !== 'historial',
    placeholderData: [],
  });

  // ── Historial de pagos ────────────────────────────────────
  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos-historial'],
    queryFn: () => api.get('/cuentas/pagos').then(r => r.data),
    enabled: tab === 'historial',
    placeholderData: [],
  });

  // ── Mutations ─────────────────────────────────────────────
  const guardarMut = useMutation({
    mutationFn: (data) =>
      data.id
        ? api.put(`/cuentas/${data.id}`, data).then(r => r.data)
        : api.post('/cuentas', data).then(r => r.data),
    onSuccess: (_, data) => {
      qc.invalidateQueries(['cuentas']);
      toast.success(data.id ? 'Cuenta actualizada' : 'Cuenta creada');
      setModal(null);
    },
    onError: err => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const pagarMut = useMutation({
    mutationFn: ({ cuentaId, monto, metodo, observaciones }) =>
      api.post(`/cuentas/${cuentaId}/pagar`, { monto, metodo_pago: metodo, observaciones }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries(['cuentas', 'pagos-historial']);
      toast.success(`Pago de ${fmt(data.monto)} registrado`);
      setPago(null);
    },
    onError: err => toast.error(err.response?.data?.message || 'Error al registrar pago'),
  });

  // ── Exportar ──────────────────────────────────────────────
  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(cuentas.map(c => ({
      Tercero: c.tercero_nombre, RTN: c.tercero_rtn,
      Descripción: c.descripcion, Total: +c.monto_total,
      Pagado: +c.monto_pagado, Saldo: +c.saldo,
      Vencimiento: c.fecha_vencimiento
        ? new Date(c.fecha_vencimiento).toLocaleDateString('es-HN') : '',
      Estado: c.estado,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Cuentas ${tipo}`);
    XLSX.writeFile(wb, `cuentas_${tipo.toLowerCase()}.xlsx`);
    toast.success('Exportado');
  };

  // ── Stats ─────────────────────────────────────────────────
  const stats = {
    total:     cuentas.length,
    pendiente: cuentas.reduce((s, c) => s + +c.saldo, 0),
    vencidas:  cuentas.filter(c => c.estado === 'VENCIDO').length,
    pagadas:   cuentas.filter(c => c.estado === 'PAGADO').length,
  };

  const TABS = [
    { id:'cobrar',   label:'Por cobrar',      icon:'ti-arrow-down-circle' },
    { id:'pagar',    label:'Por pagar',        icon:'ti-arrow-up-circle'   },
    { id:'historial',label:'Historial pagos',  icon:'ti-history'           },
  ];

  return (
    <div className={styles.page}>
      {/* Pestañas */}
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)} aria-selected={tab === t.id}>
            <i className={`ti ${t.icon}`} style={{fontSize:14,verticalAlign:-2,marginRight:4}} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats (solo en cobrar/pagar) */}
      {tab !== 'historial' && (
        <div className={styles.statsRow}>
          {[
            { label:`Total ${tab === 'cobrar' ? 'cuentas' : 'obligaciones'}`, val:stats.total,              color:'#185FA5' },
            { label:tab === 'cobrar' ? 'Por cobrar' : 'Por pagar',            val:fmt(stats.pendiente),     color:tab === 'cobrar' ? '#27500A' : '#A32D2D' },
            { label:'Vencidas',                                                val:stats.vencidas,           color:'#A32D2D' },
            { label:'Liquidadas',                                              val:stats.pagadas,            color:'#27500A' },
          ].map(s => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statLbl}>{s.label}</div>
              <div className={styles.statVal} style={{color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      {tab !== 'historial' && (
        <div className={styles.toolbar}>
          <SearchInput value={search} onChange={v => { setSearch(v); }} placeholder="Buscar tercero o descripción..." />
          <select value={estFil} onChange={e => setEstFil(e.target.value)}>
            <option value="">Todos los estados</option>
            {['PENDIENTE','PARCIAL','PAGADO','VENCIDO'].map(e => <option key={e}>{e}</option>)}
          </select>
          <button onClick={exportar} className={styles.btnSec}><i className="ti ti-download" aria-hidden="true" /> Exportar</button>
          <button onClick={() => setModal({ tipo })} className={styles.btnPrim}>
            <i className="ti ti-plus" aria-hidden="true" /> Nueva cuenta
          </button>
        </div>
      )}

      {/* Tabla de cuentas */}
      {tab !== 'historial' && (
        <div className={styles.tableWrap}>
          <table>
            <colgroup>
              <col style={{width:150}}/><col style={{width:80}}/><col style={{width:170}}/>
              <col style={{width:80}}/><col style={{width:80}}/><col style={{width:70}}/>
              <col style={{width:90}}/><col style={{width:85}}/>
            </colgroup>
            <thead><tr>
              <th>Tercero</th><th>RTN</th><th>Descripción</th>
              <th style={{textAlign:'right'}}>Total</th><th style={{textAlign:'right'}}>Saldo</th>
              <th>Vence</th><th style={{textAlign:'center'}}>Estado</th><th style={{textAlign:'center'}}>Acciones</th>
            </tr></thead>
            <tbody>
              {cuentas.map(c => {
                const saldo   = +c.saldo;
                const pct     = Math.round(+c.monto_pagado / +c.monto_total * 100);
                const badge   = ESTADO_BADGE[c.estado] || ESTADO_BADGE.PENDIENTE;
                return (
                  <tr key={c.id}>
                    <td style={{fontWeight:500}}>{c.tercero_nombre}</td>
                    <td style={{fontFamily:'monospace',fontSize:10}}>{c.tercero_rtn || '—'}</td>
                    <td style={{color:'var(--color-text-secondary)',fontSize:11}}>{c.descripcion}</td>
                    <td style={{textAlign:'right',fontFamily:'monospace',fontSize:11}}>{fmtN(c.monto_total)}</td>
                    <td style={{textAlign:'right'}}>
                      <div style={{fontFamily:'monospace',fontSize:11,fontWeight:500,color:saldo>0?'#A32D2D':'#27500A'}}>{fmtN(saldo)}</div>
                      <div style={{height:5,background:'var(--color-background-secondary)',borderRadius:3,overflow:'hidden',marginTop:2}}>
                        <div style={{height:'100%',width:`${pct}%`,background:pct===100?'#27500A':pct>50?'#633806':'#A32D2D',borderRadius:3}} />
                      </div>
                    </td>
                    <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>
                      {c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-HN') : '—'}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <span style={{background:badge.bg,color:badge.txt,borderRadius:10,padding:'2px 7px',fontSize:10,fontWeight:500}}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{textAlign:'center'}}>
                      {c.estado !== 'PAGADO' && (
                        <button onClick={() => setPago(c)} className={styles.btnIco} aria-label="Registrar pago">
                          <i className="ti ti-cash" style={{color:'#27500A'}} aria-hidden="true" />
                        </button>
                      )}
                      <button onClick={() => setModal(c)} className={styles.btnIco} aria-label="Editar">
                        <i className="ti ti-edit" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Historial de pagos */}
      {tab === 'historial' && (
        <div className={styles.tableWrap}>
          <table>
            <colgroup>
              <col style={{width:90}}/><col style={{width:150}}/><col style={{width:65}}/><col style={{width:200}}/>
              <col style={{width:80}}/><col style={{width:90}}/><col style={{width:80}}/>
            </colgroup>
            <thead><tr>
              <th>Fecha</th><th>Tercero</th><th>Tipo</th><th>Concepto</th>
              <th style={{textAlign:'right'}}>Monto</th><th>Método</th><th>Usuario</th>
            </tr></thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id}>
                  <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>{new Date(p.pagado_en).toLocaleDateString('es-HN')}</td>
                  <td style={{fontWeight:500}}>{p.tercero_nombre}</td>
                  <td>
                    <span style={{background:p.cuenta_tipo==='COBRAR'?'#EAF3DE':'#FCEBEB',color:p.cuenta_tipo==='COBRAR'?'#27500A':'#791F1F',borderRadius:10,padding:'2px 7px',fontSize:10,fontWeight:500}}>
                      {p.cuenta_tipo === 'COBRAR' ? 'Cobro' : 'Pago'}
                    </span>
                  </td>
                  <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>{p.observaciones || '—'}</td>
                  <td style={{textAlign:'right',fontFamily:'monospace',fontSize:11,fontWeight:500,color:p.cuenta_tipo==='COBRAR'?'#27500A':'#A32D2D'}}>
                    {fmtN(p.monto)}
                  </td>
                  <td style={{fontSize:11}}>{p.metodo_pago?.replace('_',' ')}</td>
                  <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>{p.usuario_nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modales */}
      {modal !== null && (
        <CuentaModal
          cuenta={modal.id ? modal : null}
          tipoDefault={modal.tipo || tipo}
          onSave={(data) => guardarMut.mutate(data)}
          onClose={() => setModal(null)}
          saving={guardarMut.isPending}
        />
      )}

      {pago !== null && (
        <PagoModal
          cuenta={pago}
          onPagar={(data) => pagarMut.mutate({ cuentaId: pago.id, ...data })}
          onClose={() => setPago(null)}
          saving={pagarMut.isPending}
        />
      )}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{position:'relative',flex:1,minWidth:160}}>
      <i className="ti ti-search" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:15,color:'var(--color-text-tertiary)',pointerEvents:'none'}} aria-hidden="true" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'7px 10px 7px 32px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}} />
    </div>
  );
}
