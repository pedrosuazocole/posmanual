/**
 * POSManual - DevSys Honduras
 * Página: Módulo de Reportes
 * Archivo: client/src/pages/Reportes/ReportesPage.jsx
 *
 * Reportes disponibles:
 *  1. Master de Ventas       — todas las facturas con filtros de fecha/cajero/estado
 *  2. Corte de Caja          — resumen de turno, cuadre efectivo/tarjeta, distribución hora
 *  3. Ventas por Grupo       — participación porcentual por categoría
 *  4. Ventas por Artículo    — ranking de productos con margen estimado
 *
 * Exportación: Excel (xlsx) + impresión/PDF vía window.print()
 */
import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import { toast }      from 'sonner';
import * as XLSX      from 'xlsx';
import api            from '../../api/axios';
import { usePOSStore } from '../../store/posStore';
import styles         from './ReportesPage.module.css';

const hoy = () => new Date().toISOString().slice(0, 10);
const mesInicio = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const fmt  = n => `L. ${(+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtN = n => (+(n || 0)).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ─── Componente principal ──────────────────────────────────
export default function ReportesPage() {
  const [tab, setTab] = useState('master');

  const TABS = [
    { id: 'master',    label: 'Master de ventas' },
    { id: 'corte',     label: 'Corte de caja'    },
    { id: 'grupos',    label: 'Ventas por grupo'  },
    { id: 'articulos', label: 'Ventas por artículo' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.tabs} role="tablist">
        {TABS.map(t => (
          <button
            key={t.id} role="tab"
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'master'    && <MasterVentas />}
      {tab === 'corte'     && <CortesCaja   />}
      {tab === 'grupos'    && <VentasGrupos />}
      {tab === 'articulos' && <VentasArticulos />}
    </div>
  );
}

// ─── REPORTE 1: Master de Ventas ──────────────────────────
function MasterVentas() {
  const [fi,    setFi]    = useState(mesInicio());
  const [ff,    setFf]    = useState(hoy());
  const [caj,   setCaj]   = useState('');
  const [est,   setEst]   = useState('');
  const [page,  setPage]  = useState(1);
  const LIMIT = 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reporte-master', { fi, ff, caj, est, page }],
    queryFn: () => api.get('/ventas', { params: {
      fecha_ini: fi, fecha_fin: ff,
      cajero_id: caj || undefined,
      estado:    est || undefined,
      page, limit: LIMIT,
    }}).then(r => r.data),
    enabled: false,
    placeholderData: { data: [], total: 0 },
  });

  const ventas    = data?.data  ?? [];
  const totalRows = data?.total ?? 0;

  // Totales resumen
  const comp = ventas.filter(v => v.estado === 'COMPLETADA');
  const totV = comp.reduce((s, v) => s + +v.total, 0);
  const totI = comp.reduce((s, v) => s + +v.isv_15 + +v.isv_18, 0);

  const exportarExcel = async () => {
    const { data: all } = await api.get('/ventas', {
      params: { fecha_ini: fi, fecha_fin: ff, cajero_id: caj||undefined, estado: est||undefined, limit: 9999 }
    });
    const rows = all.data.map(v => ({
      'Factura #':   v.numero_factura,
      'Cajero':      v.cajero_nombre,
      'Cliente':     v.cliente_nombre,
      'RTN':         v.cliente_rtn,
      'Fecha':       v.creado_en,
      'Estado':      v.estado,
      'Subtotal':    +v.subtotal,
      'Desc.':       +v.descuento_total,
      'Exento':      +v.importe_exento,
      'Grav. 15%':   +v.importe_gravado_15,
      'ISV 15%':     +v.isv_15,
      'Total':       +v.total,
      'Forma Pago':  v.metodo_pago,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [22,14,20,12,18,12,10,8,10,10,10,10,14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Master Ventas');
    XLSX.writeFile(wb, `master_ventas_${fi}_${ff}.xlsx`);
    toast.success('Reporte exportado');
  };

  return (
    <div>
      <Filters onGenerar={refetch}>
        <FGroup label="Fecha inicio"><input type="date" value={fi} onChange={e=>setFi(e.target.value)} /></FGroup>
        <FGroup label="Fecha fin"><input type="date" value={ff} onChange={e=>setFf(e.target.value)} /></FGroup>
        <FGroup label="Cajero">
          <select value={caj} onChange={e=>setCaj(e.target.value)}>
            <option value="">Todos</option>
            {['cajero01','cajero02','cajero03','cajero04','cajero05','cajero06'].map(c=>
              <option key={c}>{c}</option>
            )}
          </select>
        </FGroup>
        <FGroup label="Estado">
          <select value={est} onChange={e=>setEst(e.target.value)}>
            <option value="">Todos</option>
            <option>COMPLETADA</option><option>ANULADA</option>
          </select>
        </FGroup>
      </Filters>

      {ventas.length > 0 && <>
        <StatsRow items={[
          { label:'Facturas emitidas', val:totalRows, color:'#185FA5' },
          { label:'Total ventas',      val:fmt(totV), color:'#27500A' },
          { label:'ISV recaudado',     val:fmt(totI), color:'#633806' },
          { label:'Anuladas',          val:ventas.filter(v=>v.estado==='ANULADA').length, color:'#A32D2D' },
        ]} />
        <ExportBar onExcel={exportarExcel} onPrint={() => window.print()} />
        <div className={styles.tableWrap}>
          <table>
            <colgroup>
              <col style={{width:155}}/><col style={{width:80}}/><col style={{width:75}}/>
              <col style={{width:65}}/><col style={{width:70}}/><col style={{width:70}}/>
              <col style={{width:70}}/><col style={{width:80}}/>
            </colgroup>
            <thead><tr>
              <th>Factura #</th><th>Cajero</th><th>Fecha</th><th>Estado</th>
              <th className={styles.r}>Subtotal</th><th className={styles.r}>ISV 15%</th>
              <th className={styles.r}>Total</th><th>Forma Pago</th>
            </tr></thead>
            <tbody>
              {ventas.map(v => (
                <tr key={v.id}>
                  <td className={styles.mono}>{v.numero_factura}</td>
                  <td className={styles.sm}>{v.cajero_nombre}</td>
                  <td className={styles.sm}>{new Date(v.creado_en).toLocaleString('es-HN')}</td>
                  <td><Badge type={v.estado==='COMPLETADA'?'ok':'er'}>{v.estado==='COMPLETADA'?'OK':'ANULADA'}</Badge></td>
                  <td className={styles.r}>{fmtN(v.subtotal)}</td>
                  <td className={styles.r}>{fmtN(v.isv_15)}</td>
                  <td className={`${styles.r} ${styles.bold}`}>{fmtN(v.total)}</td>
                  <td><Badge type="in" sm>{v.metodo_pago.replace('_',' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className={styles.tfoot}>
              <td colSpan={4}>TOTALES ({comp.length} completadas)</td>
              <td className={styles.r}>{fmtN(totV)}</td>
              <td className={styles.r}>{fmtN(totI)}</td>
              <td className={styles.r}>{fmtN(totV)}</td>
              <td />
            </tr></tfoot>
          </table>
        </div>
      </>}
    </div>
  );
}

// ─── REPORTE 2: Corte de Caja ─────────────────────────────
function CortesCaja() {
  const { turno: turnoActivo } = usePOSStore();
  const [turnoId, setTurnoId] = useState(turnoActivo?.id || '');

  const { data, refetch } = useQuery({
    queryKey: ['reporte-corte', turnoId],
    queryFn: () => api.get(`/turnos/${turnoId}`).then(r => r.data),
    enabled: false,
  });

  const exportarExcel = () => {
    if (!data) return;
    const d = data;
    const filas = [
      ['Corte de Caja — POSManual DevSys Honduras'],
      ['Turno #', d.id], ['Cajero', d.cajero_nombre],
      ['Apertura', d.abierto_en], ['Cierre', d.cerrado_en || 'Abierto'],
      [], ['RESUMEN'],
      ['Fondo inicial',    `L. ${(+d.monto_inicial).toFixed(2)}`],
      ['Total ventas',     `L. ${(+d.total_ventas  || 0).toFixed(2)}`],
      ['Declarado cajero', `L. ${(+d.monto_final_declarado || 0).toFixed(2)}`],
      ['Sistema calcula',  `L. ${(+d.monto_final_sistema   || 0).toFixed(2)}`],
      ['Diferencia',       `L. ${(+d.diferencia || 0).toFixed(2)}`],
    ];
    const ws = XLSX.utils.aoa_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Corte de Caja');
    XLSX.writeFile(wb, `corte_caja_turno_${d.id}.xlsx`);
    toast.success('Corte exportado');
  };

  return (
    <div>
      <Filters onGenerar={refetch}>
        <FGroup label="Turno">
          <select value={turnoId} onChange={e => setTurnoId(e.target.value)}>
            <option value="">Seleccionar turno...</option>
            {/* Se popula desde /api/v1/turnos */}
          </select>
        </FGroup>
      </Filters>
      {data && <>
        <ExportBar onExcel={exportarExcel} onPrint={() => window.print()} />
        <div className={styles.corteGrid}>
          <CorteCard title="Resumen del turno">
            <CorteRow label="Turno #"   val={data.id} />
            <CorteRow label="Cajero"    val={data.cajero_nombre} />
            <CorteRow label="Apertura"  val={new Date(data.abierto_en).toLocaleString('es-HN')} />
            <CorteRow label="Cierre"    val={data.cerrado_en ? new Date(data.cerrado_en).toLocaleString('es-HN') : '— Abierto —'} />
            <CorteRow label="Fondo inicial" val={fmt(data.monto_inicial)} />
            <CorteRow label="Total ventas" val={fmt(data.total_ventas)} main />
          </CorteCard>
          <CorteCard title="Cuadre de caja">
            <CorteRow label="Sistema calcula"  val={fmt(data.monto_final_sistema)} />
            <CorteRow label="Cajero declara"   val={fmt(data.monto_final_declarado)} />
            <CorteRow
              label="Diferencia"
              val={fmt(data.diferencia)}
              color={+data.diferencia >= 0 ? '#27500A' : '#A32D2D'}
              main
            />
          </CorteCard>
        </div>
      </>}
    </div>
  );
}

// ─── REPORTE 3: Ventas por Grupo ──────────────────────────
function VentasGrupos() {
  const [fi, setFi] = useState(mesInicio());
  const [ff, setFf] = useState(hoy());

  const { data: rows = [], refetch } = useQuery({
    queryKey: ['reporte-grupos', { fi, ff }],
    queryFn: () => api.get('/reportes/grupos', { params: { fecha_ini: fi, fecha_fin: ff } }).then(r => r.data),
    enabled: false,
  });

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Grupo: r.grupo, Facturas: r.num_facturas, Unidades: r.unidades_vendidas,
      'Total Ventas': +r.total_ventas, 'ISV Generado': +r.isv_generado, '% Part.': r['%_participacion'],
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas por Grupo');
    XLSX.writeFile(wb, `ventas_grupo_${fi}_${ff}.xlsx`);
    toast.success('Reporte exportado');
  };

  const tot = rows.reduce((s, r) => s + +r.total_ventas, 0);

  return (
    <div>
      <Filters onGenerar={refetch}>
        <FGroup label="Fecha inicio"><input type="date" value={fi} onChange={e=>setFi(e.target.value)} /></FGroup>
        <FGroup label="Fecha fin"><input type="date" value={ff} onChange={e=>setFf(e.target.value)} /></FGroup>
      </Filters>
      {rows.length > 0 && <>
        <ExportBar onExcel={exportarExcel} onPrint={() => window.print()} />
        <div className={styles.tableWrap}>
          <table>
            <thead><tr>
              <th>Grupo</th><th className={styles.r}># Facturas</th>
              <th className={styles.r}>Unidades</th><th className={styles.r}>Total ventas</th>
              <th className={styles.r}>ISV</th><th className={styles.r}>% Part.</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className={styles.bold}>{r.grupo || 'Sin grupo'}</td>
                  <td className={styles.r}>{r.num_facturas}</td>
                  <td className={styles.r}>{(+r.unidades_vendidas).toLocaleString()}</td>
                  <td className={styles.r}>{fmtN(r.total_ventas)}</td>
                  <td className={styles.r}>{fmtN(r.isv_generado)}</td>
                  <td className={styles.r}><Badge type="in">{r['%_participacion']}%</Badge></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className={styles.tfoot}>
              <td>TOTALES</td>
              <td className={styles.r}>{rows.reduce((s,r)=>s+ +r.num_facturas,0)}</td>
              <td className={styles.r}>{rows.reduce((s,r)=>s+ +r.unidades_vendidas,0).toLocaleString()}</td>
              <td className={styles.r}>{fmtN(tot)}</td>
              <td className={styles.r}>{fmtN(rows.reduce((s,r)=>s+ +r.isv_generado,0))}</td>
              <td className={styles.r}>100%</td>
            </tr></tfoot>
          </table>
        </div>
      </>}
    </div>
  );
}

// ─── REPORTE 4: Ventas por Artículo ──────────────────────
function VentasArticulos() {
  const [fi, setFi] = useState(mesInicio());
  const [ff, setFf] = useState(hoy());
  const [grupoId, setGrupoId] = useState('');

  const { data: grupos = [] } = useQuery({ queryKey:['grupos'], queryFn:()=>api.get('/grupos').then(r=>r.data), staleTime:600000 });
  const { data: rows = [], refetch } = useQuery({
    queryKey: ['reporte-articulos', { fi, ff, grupoId }],
    queryFn: () => api.get('/reportes/articulos', { params: { fecha_ini: fi, fecha_fin: ff, grupo_id: grupoId||undefined }}).then(r=>r.data),
    enabled: false,
  });

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r=>({'Código':r.codigo,'Artículo':r.nombre,'Grupo':r.grupo,'Ventas':r.veces_facturado,'Cantidad':+r.cantidad_total,'P. Promedio':+r.precio_promedio,'Total':+r.total_ventas,'% Margen':+r['%_margen']})));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas por Artículo');
    XLSX.writeFile(wb, `ventas_articulo_${fi}_${ff}.xlsx`);
    toast.success('Reporte exportado');
  };

  return (
    <div>
      <Filters onGenerar={refetch}>
        <FGroup label="Fecha inicio"><input type="date" value={fi} onChange={e=>setFi(e.target.value)} /></FGroup>
        <FGroup label="Fecha fin"><input type="date" value={ff} onChange={e=>setFf(e.target.value)} /></FGroup>
        <FGroup label="Grupo">
          <select value={grupoId} onChange={e=>setGrupoId(e.target.value)}>
            <option value="">Todos</option>
            {grupos.map(g=><option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
        </FGroup>
      </Filters>
      {rows.length > 0 && <>
        <ExportBar onExcel={exportarExcel} onPrint={() => window.print()} />
        <div className={styles.tableWrap}>
          <table>
            <thead><tr>
              <th>Código</th><th>Artículo</th><th>Grupo</th>
              <th className={styles.r}># Ventas</th><th className={styles.r}>Cantidad</th>
              <th className={styles.r}>P. Prom.</th><th className={styles.r}>Total</th>
              <th className={styles.r}>% Margen</th>
            </tr></thead>
            <tbody>
              {rows.map((r,i) => (
                <tr key={i}>
                  <td className={styles.mono}>{r.codigo}</td>
                  <td className={styles.bold}>{r.nombre}</td>
                  <td className={styles.sm}>{r.grupo}</td>
                  <td className={styles.r}>{r.veces_facturado}</td>
                  <td className={styles.r}>{(+r.cantidad_total).toLocaleString()}</td>
                  <td className={styles.r}>L.{fmtN(r.precio_promedio)}</td>
                  <td className={`${styles.r} ${styles.bold}`}>{fmtN(r.total_ventas)}</td>
                  <td className={styles.r}>
                    {+r['%_margen'] > 0
                      ? <Badge type={+r['%_margen']>30?'ok':'wa'}>{fmtN(r['%_margen'])}%</Badge>
                      : <Badge type="gray">N/A</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────
function Filters({ children, onGenerar }) {
  return (
    <div className={styles.filters}>
      {children}
      <div style={{ flex: 1 }} />
      <button onClick={onGenerar} className={styles.btnPrim}>
        <i className="ti ti-refresh" aria-hidden="true" /> Generar
      </button>
    </div>
  );
}

function FGroup({ label, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <label style={{ fontSize:11, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'.3px' }}>{label}</label>
      {children}
    </div>
  );
}

function StatsRow({ items }) {
  return (
    <div className={styles.statsRow}>
      {items.map(s => (
        <div key={s.label} className={styles.stat}>
          <div className={styles.statLbl}>{s.label}</div>
          <div className={styles.statVal} style={{ color: s.color }}>{s.val}</div>
        </div>
      ))}
    </div>
  );
}

function ExportBar({ onExcel, onPrint }) {
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginBottom:10 }}>
      <button onClick={onExcel} className={styles.btnSec}>
        <i className="ti ti-file-spreadsheet" aria-hidden="true" /> Exportar Excel
      </button>
      <button onClick={onPrint} className={styles.btnGreen}>
        <i className="ti ti-printer" aria-hidden="true" /> Imprimir / PDF
      </button>
    </div>
  );
}

function CorteCard({ title, children }) {
  return (
    <div className={styles.corteCard}>
      <h4 className={styles.corteCardTitle}>{title}</h4>
      {children}
    </div>
  );
}

function CorteRow({ label, val, main, color }) {
  return (
    <div className={`${styles.corteRow} ${main ? styles.corteRowMain : ''}`}>
      <span>{label}</span>
      <span style={color ? { color, fontWeight:500 } : {}}>{val}</span>
    </div>
  );
}

function Badge({ type, children, sm }) {
  const map = {
    ok:'#EAF3DE,#27500A', er:'#FCEBEB,#791F1F',
    wa:'#FAEEDA,#633806', in:'#E6F1FB,#0C447C',
    pu:'#EEEDFE,#3C3489', gray:'var(--color-background-secondary),var(--color-text-secondary)',
  };
  const [bg, txt] = (map[type] || map.gray).split(',');
  return (
    <span style={{
      background:bg, color:txt,
      borderRadius:10, padding: sm ? '1px 6px' : '2px 7px',
      fontSize: sm ? 9 : 10, fontWeight:500, whiteSpace:'nowrap',
    }}>
      {children}
    </span>
  );
}
