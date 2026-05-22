/**
 * POSManual - DevSys Honduras
 * Página: Turnos / Corte de Caja
 * Archivo: client/src/pages/Turnos/TurnosPage.jsx
 *
 * Vistas:
 *  - "Mi turno activo"  → dashboard en tiempo real (ventas, ISV, gráficas por hora/pago)
 *  - "Cerrar turno"     → arqueo de caja con detección de diferencia
 *  - "Historial"        → listado de todos los turnos con acceso al corte
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast }       from 'sonner';
import * as XLSX       from 'xlsx';
import { usePOSStore } from '../../store/posStore';
import api             from '../../api/axios';
import ModalApertura   from './ModalApertura';
import ArqueoForm      from './ArqueoForm';
import styles          from './TurnosPage.module.css';

const fmt  = n => `L. ${(+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtN = n => (+(n || 0)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function TurnosPage() {
  const [tab, setTab]   = useState('activo');
  const [modalAp, setModalAp] = useState(false);
  const [corteDone, setCorteDone] = useState(null);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { turno, setTurno } = usePOSStore();

  // ── Turno activo del usuario en sesión ────────────────────
  const { data: turnoActivo, isLoading: loadingTurno } = useQuery({
    queryKey: ['turno-activo'],
    queryFn: () => api.get('/turnos/activo').then(r => r.data).catch(() => null),
    refetchInterval: 30_000,   // refresca cada 30 s
    retry: false,
  });

  // Sincronizar con el store global del POS
  useEffect(() => { if (turnoActivo) setTurno(turnoActivo); }, [turnoActivo, setTurno]);

  // ── Ventas del turno activo ───────────────────────────────
  const { data: ventasTurno = [] } = useQuery({
    queryKey: ['ventas-turno', turnoActivo?.id],
    queryFn: () => api.get('/ventas', {
      params: { turno_id: turnoActivo.id, limit: 200 }
    }).then(r => r.data.data),
    enabled: Boolean(turnoActivo?.id),
    refetchInterval: 20_000,
  });

  // ── Historial de turnos ───────────────────────────────────
  const { data: historial = [] } = useQuery({
    queryKey: ['turnos-historial'],
    queryFn: () => api.get('/turnos?limit=50').then(r => r.data),
    enabled: tab === 'historial',
  });

  // ── Abrir turno ───────────────────────────────────────────
  const abrirMut = useMutation({
    mutationFn: ({ fondo, cajeroId }) =>
      api.post('/turnos/abrir', { monto_inicial: fondo, cajero_id: cajeroId }).then(r => r.data),
    onSuccess: (data) => {
      setTurno(data);
      qc.invalidateQueries(['turno-activo']);
      toast.success(`Turno #${data.id} abierto — fondo L. ${data.monto_inicial.toFixed(2)}`);
      setModalAp(false);
      setTab('activo');
    },
    onError: err => toast.error(err.response?.data?.message || 'Error al abrir turno'),
  });

  // ── Cerrar turno ──────────────────────────────────────────
  const cerrarMut = useMutation({
    mutationFn: (arqueo) =>
      api.post(`/turnos/${turnoActivo.id}/cerrar`, arqueo).then(r => r.data),
    onSuccess: (data) => {
      setTurno(null);
      qc.invalidateQueries(['turno-activo', 'turnos-historial']);
      setCorteDone(data);
      toast.success('Turno cerrado correctamente');
    },
    onError: err => toast.error(err.response?.data?.message || 'Error al cerrar turno'),
  });

  // ── Métricas del turno activo ─────────────────────────────
  const comp  = ventasTurno.filter(v => v.estado === 'COMPLETADA');
  const anu   = ventasTurno.filter(v => v.estado === 'ANULADA');
  const totV  = comp.reduce((s, v) => s + +v.total, 0);
  const totI  = comp.reduce((s, v) => s + +v.isv_15 + +v.isv_18, 0);

  // Distribución por hora
  const horas = Array.from({ length: 12 }, (_, i) => String(i + 7).padStart(2, '0'));
  const porHora = horas.map(h => ({
    hora: h,
    total: comp.filter(v => new Date(v.creado_en).getHours() === +h)
                .reduce((s, v) => s + +v.total, 0),
  }));
  const maxHora = Math.max(...porHora.map(x => x.total), 1);

  // Distribución por forma de pago
  const porPago = ['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA'].map(p => ({
    pago: p,
    total: comp.filter(v => v.metodo_pago === p).reduce((s, v) => s + +v.total, 0),
  }));
  const maxPago = Math.max(...porPago.map(x => x.total), 1);

  // ── Exportar corte Excel ──────────────────────────────────
  const exportarCorte = (corte) => {
    const datos = [
      ['Corte de Caja — POSManual DevSys Honduras'],
      ['Turno #', corte.id], ['Cajero', corte.cajero_nombre],
      ['Apertura', new Date(corte.abierto_en).toLocaleString('es-HN')],
      ['Cierre',   new Date(corte.cerrado_en).toLocaleString('es-HN')],
      [],
      ['Ventas realizadas', corte.total_ventas_count],
      ['Total ventas', corte.total_ventas],
      ['ISV recaudado', corte.isv_total],
      ['Sistema calcula', corte.monto_final_sistema],
      ['Cajero declara', corte.monto_final_declarado],
      ['Diferencia', corte.diferencia],
      [], ['Observaciones', corte.observaciones || ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Corte');
    XLSX.writeFile(wb, `corte_turno_${corte.id}.xlsx`);
    toast.success('Corte exportado');
  };

  const TABS = [
    { id: 'activo',    label: 'Mi turno activo' },
    { id: 'cerrar',    label: 'Cerrar turno' },
    { id: 'historial', label: 'Historial' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)} aria-selected={tab === t.id}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TURNO ACTIVO ─────────────────────────────────── */}
      {tab === 'activo' && (
        turnoActivo ? (
          <div>
            {/* Banner turno en curso */}
            <div className={styles.turnoBanner}>
              <div className={styles.turnoDot} />
              <div>
                <div className={styles.turnoNombre}>Turno #{turnoActivo.id} en curso</div>
                <div className={styles.turnoSub}>
                  {turnoActivo.cajero_nombre} · Apertura: {new Date(turnoActivo.abierto_en).toLocaleString('es-HN')}
                </div>
              </div>
              <TurnoClock />
            </div>

            {/* Métricas */}
            <div className={styles.statsRow}>
              {[
                { label: 'Ventas hoy',       val: comp.length,   color: '#185FA5' },
                { label: 'Total facturado',   val: fmt(totV),     color: '#27500A' },
                { label: 'ISV recaudado',     val: fmt(totI),     color: '#633806' },
                { label: 'Anuladas',          val: anu.length,    color: '#A32D2D' },
              ].map(s => (
                <div key={s.label} className={styles.stat}>
                  <div className={styles.statLbl}>{s.label}</div>
                  <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Gráficas de barras */}
            <div className={styles.chartGrid}>
              <ChartCard title="Ventas por hora">
                {porHora.map(({ hora, total }) => (
                  <BarRow key={hora} label={`${hora}:00`} val={total} max={maxHora} fmt={fmt} />
                ))}
              </ChartCard>
              <ChartCard title="Por forma de pago">
                {porPago.map(({ pago, total }) => (
                  <BarRow key={pago} label={pago.replace('_', ' ')} val={total} max={maxPago} fmt={fmt}
                    color={pago === 'EFECTIVO' ? '#27500A' : pago.startsWith('TARJETA') ? '#185FA5' : '#633806'} />
                ))}
              </ChartCard>
            </div>

            {/* Tabla de ventas del turno */}
            <div className={styles.tableWrap}>
              <table>
                <colgroup>
                  <col style={{ width: 155 }} /><col style={{ width: 70 }} />
                  <col style={{ width: 120 }} /><col style={{ width: 70 }} />
                  <col style={{ width: 90 }} /><col style={{ width: 80 }} />
                </colgroup>
                <thead><tr>
                  <th>Factura #</th><th>Hora</th><th>Cliente</th>
                  <th>Estado</th><th style={{ textAlign:'right' }}>Total</th><th>Pago</th>
                </tr></thead>
                <tbody>
                  {ventasTurno.map(v => (
                    <tr key={v.id}>
                      <td className={styles.mono}>{v.numero_factura}</td>
                      <td className={styles.sm}>{new Date(v.creado_en).toLocaleTimeString('es-HN',{hour:'2-digit',minute:'2-digit'})}</td>
                      <td>{v.cliente_nombre}</td>
                      <td><Badge type={v.estado==='COMPLETADA'?'ok':'er'}>{v.estado==='COMPLETADA'?'OK':'ANULADA'}</Badge></td>
                      <td style={{ textAlign:'right', fontFamily:'monospace', fontSize:12 }}>{fmtN(v.total)}</td>
                      <td><span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>{v.metodo_pago?.replace('_',' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.btnRow}>
              <button onClick={() => setTab('cerrar')} className={styles.btnDanger}>
                <i className="ti ti-lock" aria-hidden="true" /> Cerrar turno
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.sinTurno}>
            <i className="ti ti-clock-pause" aria-hidden="true" />
            <h3>No hay turno activo</h3>
            <p>Abrí un turno para comenzar a facturar</p>
            <button onClick={() => setModalAp(true)} className={styles.btnPrim}>
              <i className="ti ti-lock-open" aria-hidden="true" /> Abrir turno de caja
            </button>
          </div>
        )
      )}

      {/* ── CERRAR TURNO ─────────────────────────────────── */}
      {tab === 'cerrar' && (
        corteDone ? (
          <CorteExito corte={corteDone} onExportar={exportarCorte} onNuevo={() => { setCorteDone(null); setModalAp(true); }} />
        ) : (
          turnoActivo ? (
            <ArqueoForm
              turno={turnoActivo}
              ventas={ventasTurno}
              onCerrar={(arqueo) => cerrarMut.mutate(arqueo)}
              cerrando={cerrarMut.isPending}
              onVolver={() => setTab('activo')}
            />
          ) : (
            <div className={styles.sinTurno}>
              <i className="ti ti-clock-pause" aria-hidden="true" />
              <p>No hay turno activo para cerrar</p>
              <button onClick={() => setTab('activo')} className={styles.btnSec}>
                <i className="ti ti-arrow-left" aria-hidden="true" /> Volver
              </button>
            </div>
          )
        )
      )}

      {/* ── HISTORIAL ────────────────────────────────────── */}
      {tab === 'historial' && (
        <div>
          <div className={styles.tableWrap}>
            <table>
              <colgroup>
                <col style={{width:70}}/><col style={{width:100}}/><col style={{width:110}}/>
                <col style={{width:110}}/><col style={{width:70}}/><col style={{width:90}}/>
                <col style={{width:75}}/><col style={{width:80}}/>
              </colgroup>
              <thead><tr>
                <th>Turno #</th><th>Cajero</th><th>Apertura</th><th>Cierre</th>
                <th style={{textAlign:'right'}}>Ventas</th><th style={{textAlign:'right'}}>Total</th>
                <th>Estado</th><th style={{textAlign:'center'}}>Acciones</th>
              </tr></thead>
              <tbody>
                {historial.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight:500 }}>#{t.id}</td>
                    <td>{t.cajero_nombre}</td>
                    <td className={styles.sm}>{new Date(t.abierto_en).toLocaleString('es-HN')}</td>
                    <td className={styles.sm}>{t.cerrado_en ? new Date(t.cerrado_en).toLocaleString('es-HN') : '— Abierto'}</td>
                    <td style={{ textAlign:'right' }}>{t.total_ventas_count ?? 0}</td>
                    <td style={{ textAlign:'right', fontFamily:'monospace', fontSize:12, fontWeight:500 }}>{fmtN(t.total_ventas ?? 0)}</td>
                    <td><Badge type={t.estado==='ABIERTO'?'ok':'in'}>{t.estado}</Badge></td>
                    <td style={{ textAlign:'center' }}>
                      <button onClick={() => navigate(`/reportes?turno=${t.id}`)} className={styles.btnIco} aria-label="Ver corte">
                        <i className="ti ti-eye" aria-hidden="true" />
                      </button>
                      <button onClick={() => exportarCorte(t)} className={styles.btnIco} aria-label="Exportar Excel">
                        <i className="ti ti-file-spreadsheet" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAp && (
        <ModalApertura
          onAbrir={(data) => abrirMut.mutate(data)}
          abriendo={abrirMut.isPending}
          onClose={() => setModalAp(false)}
        />
      )}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────
function TurnoClock() {
  const [hora, setHora] = useState(new Date().toLocaleTimeString('es-HN'));
  useEffect(() => {
    const t = setInterval(() => setHora(new Date().toLocaleTimeString('es-HN')), 1000);
    return () => clearInterval(t);
  }, []);
  return <div style={{ fontFamily:'monospace', fontSize:18, fontWeight:500, color:'#27500A', marginLeft:'auto' }}>{hora}</div>;
}

function ChartCard({ title, children }) {
  return (
    <div style={{ border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:14 }}>
      <div style={{ fontSize:12, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BarRow({ label, val, max, fmt, color = '#1B4F9B' }) {
  const pct = Math.round((val / max) * 100);
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--color-text-secondary)', marginBottom:3 }}>
        <span>{label}</span><span style={{ fontFamily:'monospace' }}>{fmt(val)}</span>
      </div>
      <div style={{ height:10, background:'var(--color-background-secondary)', borderRadius:3, overflow:'hidden', border:'0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width .4s' }} />
      </div>
    </div>
  );
}

function Badge({ type, children }) {
  const map = { ok:'#EAF3DE,#27500A', er:'#FCEBEB,#791F1F', in:'#E6F1FB,#0C447C', wa:'#FAEEDA,#633806' };
  const [bg, txt] = (map[type] || map.in).split(',');
  return (
    <span style={{ background:bg, color:txt, borderRadius:10, padding:'2px 7px', fontSize:10, fontWeight:500, whiteSpace:'nowrap' }}>
      {children}
    </span>
  );
}

function CorteExito({ corte, onExportar, onNuevo }) {
  return (
    <div style={{ background:'var(--color-background-success)', border:'0.5px solid var(--color-border-success)', borderRadius:'var(--border-radius-lg)', padding:24, textAlign:'center' }}>
      <i className="ti ti-circle-check" style={{ fontSize:40, color:'var(--color-text-success)', display:'block', marginBottom:10 }} aria-hidden="true" />
      <h3 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-success)', marginBottom:6 }}>Turno cerrado correctamente</h3>
      <p style={{ fontSize:13, color:'var(--color-text-success)', marginBottom:18 }}>
        Turno #{corte.id} · {corte.cajero_nombre} · {new Date(corte.cerrado_en).toLocaleString('es-HN')}
      </p>
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        <button onClick={() => window.print()} style={{ background:'transparent', border:'0.5px solid var(--color-border-success)', color:'var(--color-text-success)', padding:'8px 14px', borderRadius:'var(--border-radius-md)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          <i className="ti ti-printer" aria-hidden="true" /> Imprimir corte
        </button>
        <button onClick={() => onExportar(corte)} style={{ background:'transparent', border:'0.5px solid var(--color-border-success)', color:'var(--color-text-success)', padding:'8px 14px', borderRadius:'var(--border-radius-md)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
          <i className="ti ti-file-spreadsheet" aria-hidden="true" /> Exportar Excel
        </button>
        <button onClick={onNuevo} style={{ background:'#1B4F9B', color:'#fff', border:'none', padding:'8px 16px', borderRadius:'var(--border-radius-md)', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-lock-open" aria-hidden="true" /> Abrir nuevo turno
        </button>
      </div>
    </div>
  );
}
