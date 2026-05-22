/**
 * POSManual - DevSys Honduras
 * Página: Módulo de Inventario
 * Archivo: client/src/pages/Inventario/InventarioPage.jsx
 *
 * Pestañas:
 *  1. Stock actual     — listado con filtros, valor total, estado por artículo
 *  2. Movimientos      — historial con filtros por tipo/referencia + exportar Excel
 *  3. Kardex           — tarjeta de movimientos de un artículo específico
 *  4. Alertas de stock — artículos bajo mínimo con botón "Reponer"
 *
 * Acciones disponibles:
 *  - Nuevo movimiento (Entrada / Salida / Ajuste+ / Ajuste− / Merma / Transferencia)
 *  - Modal con preview del artículo y cálculo inmediato del nuevo stock
 *  - Exportar movimientos y Kardex a Excel
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import api  from '../../api/axios';
import MovimientoModal from './MovimientoModal';
import styles from './InventarioPage.module.css';

const fmt  = n => `L. ${(+n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
const fmtN = n => (+(n || 0)).toFixed(2);

export default function InventarioPage() {
  const [tab, setTab] = useState('stock');
  const [modal, setModal] = useState(null); // null | { articuloId? }
  const qc = useQueryClient();

  const TABS = [
    { id:'stock',     label:'Stock actual' },
    { id:'movimientos', label:'Movimientos' },
    { id:'kardex',    label:'Kardex' },
    { id:'alertas',   label:'Alertas de stock' },
  ];

  const handleModalClose = () => setModal(null);
  const handleModalSuccess = () => {
    qc.invalidateQueries(['inventario-stock']);
    qc.invalidateQueries(['inventario-movimientos']);
    qc.invalidateQueries(['inventario-alertas']);
    toast.success('Movimiento registrado correctamente');
    setModal(null);
  };

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

      {tab === 'stock'       && <StockTab      onNuevoMov={() => setModal({})} />}
      {tab === 'movimientos' && <MovimientosTab onNuevoMov={() => setModal({})} />}
      {tab === 'kardex'      && <KardexTab />}
      {tab === 'alertas'     && <AlertasTab    onReponer={(id) => setModal({ articuloId: id })} />}

      {modal !== null && (
        <MovimientoModal
          articuloId={modal.articuloId}
          onSave={handleModalSuccess}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

/* ── PESTAÑA 1: STOCK ACTUAL ──────────────────────────────── */
function StockTab({ onNuevoMov }) {
  const [search,   setSearch]   = useState('');
  const [grupoFil, setGrupoFil] = useState('');
  const [estadoFil,setEstadoFil]= useState('');
  const [page,     setPage]     = useState(1);
  const LIMIT = 30;

  const { data: grupos = [] } = useQuery({
    queryKey:['grupos'], queryFn:()=>api.get('/grupos').then(r=>r.data), staleTime:600000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventario-stock', { search, grupoFil, estadoFil, page }],
    queryFn: () => api.get('/inventario/stock', {
      params: { q:search, grupo_id:grupoFil, estado:estadoFil, page, limit:LIMIT }
    }).then(r => r.data),
    placeholderData: { data:[], total:0, resumen:{} },
    keepPreviousData: true,
  });

  const articulos = data?.data  ?? [];
  const resumen   = data?.resumen ?? {};
  const total     = data?.total ?? 0;

  return (
    <div>
      <div className={styles.statsRow}>
        {[
          { label:'Artículos en stock', val:resumen.total_articulos ?? 0,       color:'#185FA5' },
          { label:'Valor total',        val:fmt(resumen.valor_total ?? 0),       color:'#27500A' },
          { label:'Stock bajo mínimo',  val:resumen.bajo_minimo ?? 0,            color:'#A32D2D' },
          { label:'Servicios (sin stock)', val:resumen.servicios ?? 0,           color:'#3C3489' },
        ].map(s => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statLbl}>{s.label}</div>
            <div className={styles.statVal} style={{ color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Buscar artículo..." />
        <select value={grupoFil} onChange={e => { setGrupoFil(e.target.value); setPage(1); }}>
          <option value="">Todos los grupos</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
        <select value={estadoFil} onChange={e => { setEstadoFil(e.target.value); setPage(1); }}>
          <option value="">Todo el stock</option>
          <option value="bajo">Bajo mínimo</option>
          <option value="ok">Normal</option>
          <option value="srv">Servicios</option>
        </select>
        <button onClick={onNuevoMov} className={styles.btnOk}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuevo movimiento
        </button>
      </div>

      <TableWrap>
        <colgroup>
          <col style={{width:90}}/><col style={{width:190}}/><col style={{width:85}}/>
          <col style={{width:70}}/><col style={{width:65}}/><col style={{width:65}}/>
          <col style={{width:80}}/><col style={{width:80}}/>
        </colgroup>
        <thead><tr>
          <th>Código</th><th>Artículo</th><th>Grupo</th>
          <th className={styles.r}>Stock</th><th className={styles.r}>Mín.</th><th className={styles.r}>Máx.</th>
          <th className={styles.r}>Costo unit.</th><th style={{textAlign:'center'}}>Estado</th>
        </tr></thead>
        <tbody>
          {isLoading ? (
            Array.from({length:8}).map((_,i) => <tr key={i}><td colSpan={8} className={styles.skeleton} /></tr>)
          ) : articulos.map(a => (
            <tr key={a.id}>
              <td className={styles.mono}>{a.codigo}</td>
              <td style={{fontWeight:500}}>{a.nombre}</td>
              <td className={styles.muted}>{a.grupo_nombre}</td>
              <td className={`${styles.r} ${!a.no_usar_existencia && a.stock_actual <= a.stock_minimo ? styles.stockBajo : ''}`}>
                {a.no_usar_existencia ? <span className={styles.muted}>—</span> : a.stock_actual}
              </td>
              <td className={`${styles.r} ${styles.muted}`}>{a.no_usar_existencia ? '—' : a.stock_minimo}</td>
              <td className={`${styles.r} ${styles.muted}`}>{a.no_usar_existencia ? '—' : a.stock_maximo}</td>
              <td className={styles.r}>{fmt(a.precio_costo)}</td>
              <td style={{textAlign:'center'}}>
                {a.no_usar_existencia
                  ? <Badge type="pu">Servicio</Badge>
                  : a.stock_actual <= a.stock_minimo
                    ? <Badge type="er"><i className="ti ti-alert-triangle" style={{fontSize:10}} aria-hidden="true" /> Bajo</Badge>
                    : <Badge type="ok">Normal</Badge>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
    </div>
  );
}

/* ── PESTAÑA 2: MOVIMIENTOS ──────────────────────────────── */
function MovimientosTab({ onNuevoMov }) {
  const [search,  setSearch]  = useState('');
  const [tipoFil, setTipoFil] = useState('');
  const [refFil,  setRefFil]  = useState('');
  const [fi, setFi] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [ff, setFf] = useState(() => new Date().toISOString().slice(0,10));

  const { data: movs = [], isLoading } = useQuery({
    queryKey: ['inventario-movimientos', { search, tipoFil, refFil, fi, ff }],
    queryFn: () => api.get('/inventario/movimientos', {
      params: { q:search, tipo:tipoFil, referencia_tipo:refFil, fecha_ini:fi, fecha_fin:ff, limit:200 }
    }).then(r => r.data),
    placeholderData: [],
  });

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(movs.map(m => ({
      Fecha:         m.fecha, Artículo:      m.articulo_nombre, Código: m.articulo_codigo,
      Tipo:          m.tipo,  Referencia:    m.referencia_tipo, Cantidad: +m.cantidad,
      'Costo Unit.': +m.costo_unitario, 'Stock Anterior': +m.stock_anterior,
      'Stock Nuevo': +m.stock_nuevo,    Usuario: m.usuario_nombre,
    })));
    ws['!cols'] = [14,28,12,16,14,8,10,10,10,14].map(w => ({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, `movimientos_${fi}_${ff}.xlsx`);
    toast.success('Movimientos exportados');
  };

  const tipoBadge = { ENTRADA:'ok', SALIDA:'er', AJUSTE_POSITIVO:'wa', AJUSTE_NEGATIVO:'wa', TRANSFERENCIA:'in', MERMA:'pu' };

  return (
    <div>
      <div className={styles.toolbar} style={{flexWrap:'wrap'}}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar artículo..." />
        <select value={tipoFil} onChange={e => setTipoFil(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="ENTRADA">Entrada</option><option value="SALIDA">Salida</option>
          <option value="AJUSTE_POSITIVO">Ajuste +</option><option value="AJUSTE_NEGATIVO">Ajuste −</option>
          <option value="MERMA">Merma</option>
        </select>
        <select value={refFil} onChange={e => setRefFil(e.target.value)}>
          <option value="">Todas las referencias</option>
          <option value="COMPRA">Compras</option><option value="VENTA">Ventas</option>
          <option value="AJUSTE_MANUAL">Ajustes manuales</option>
        </select>
        <input type="date" value={fi} onChange={e=>setFi(e.target.value)} style={{padding:'7px 10px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:12,background:'var(--color-background-primary)',color:'var(--color-text-primary)'}} />
        <input type="date" value={ff} onChange={e=>setFf(e.target.value)} style={{padding:'7px 10px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:12,background:'var(--color-background-primary)',color:'var(--color-text-primary)'}} />
        <button onClick={exportar} className={styles.btnSec}><i className="ti ti-download" aria-hidden="true" /> Exportar</button>
        <button onClick={onNuevoMov} className={styles.btnOk}><i className="ti ti-plus" aria-hidden="true" /> Nuevo movimiento</button>
      </div>

      <TableWrap>
        <colgroup>
          <col style={{width:100}}/><col style={{width:155}}/><col style={{width:80}}/><col style={{width:80}}/>
          <col style={{width:65}}/><col style={{width:65}}/><col style={{width:65}}/><col style={{width:100}}/>
        </colgroup>
        <thead><tr>
          <th>Fecha</th><th>Artículo</th><th>Tipo</th><th>Referencia</th>
          <th className={styles.r}>Cantidad</th><th className={styles.r}>Anterior</th>
          <th className={styles.r}>Nuevo</th><th>Usuario</th>
        </tr></thead>
        <tbody>
          {isLoading ? (
            Array.from({length:8}).map((_,i) => <tr key={i}><td colSpan={8} className={styles.skeleton}/></tr>)
          ) : movs.map(m => (
            <tr key={m.id}>
              <td className={styles.mono} style={{fontSize:10}}>{new Date(m.creado_en).toLocaleString('es-HN')}</td>
              <td style={{fontWeight:500}}>{m.articulo_nombre}</td>
              <td><Badge type={tipoBadge[m.tipo] || 'in'} sm>{m.tipo.replace('_POSITIVO','+').replace('_NEGATIVO','−')}</Badge></td>
              <td className={styles.muted} style={{fontSize:11}}>{m.referencia_tipo}</td>
              <td className={styles.r} style={{color:['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipo)?'#27500A':'#A32D2D',fontWeight:500}}>
                {['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipo)?'+':'−'}{fmtN(m.cantidad)}
              </td>
              <td className={styles.r}>{fmtN(m.stock_anterior)}</td>
              <td className={`${styles.r} ${styles.bold}`}>{fmtN(m.stock_nuevo)}</td>
              <td className={styles.muted} style={{fontSize:11}}>{m.usuario_nombre}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

/* ── PESTAÑA 3: KARDEX ───────────────────────────────────── */
function KardexTab() {
  const [search, setSearch] = useState('');
  const [artId,  setArtId]  = useState(null);

  const { data: sugeridos = [] } = useQuery({
    queryKey: ['kardex-search', search],
    queryFn: () => api.get(`/articulos?q=${search}&limit=8`).then(r => r.data.data),
    enabled: search.length >= 2,
  });

  const { data: kardex = [] } = useQuery({
    queryKey: ['kardex-movs', artId],
    queryFn: () => api.get(`/inventario/kardex/${artId}`).then(r => r.data),
    enabled: Boolean(artId),
  });

  const artInfo = sugeridos.find(a => a.id === artId);

  const exportar = () => {
    if (!kardex.length) return;
    const ws = XLSX.utils.json_to_sheet(kardex.map(m => ({
      Fecha: m.fecha, Tipo: m.tipo,
      Entrada: ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipo) ? m.cantidad : '',
      Salida:  !['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipo) ? m.cantidad : '',
      'Costo Unit.': m.costo_unitario, Saldo: m.stock_nuevo, Referencia: m.referencia_tipo,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kardex');
    XLSX.writeFile(wb, `kardex_${artId}.xlsx`);
    toast.success('Kardex exportado');
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <div style={{flex:1,position:'relative'}}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar artículo para ver su Kardex..." />
          {sugeridos.length > 0 && search.length >= 2 && !artId && (
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',zIndex:10,maxHeight:200,overflowY:'auto'}}>
              {sugeridos.map(a => (
                <div key={a.id} onClick={() => { setArtId(a.id); setSearch(a.nombre); }}
                  style={{padding:'8px 12px',cursor:'pointer',fontSize:12,borderBottom:'0.5px solid var(--color-border-tertiary)'}}
                  onMouseEnter={e => e.currentTarget.style.background='var(--color-background-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <strong>{a.nombre}</strong>
                  <span style={{fontFamily:'monospace',fontSize:10,color:'var(--color-text-secondary)',marginLeft:8}}>{a.codigo}</span>
                  <span style={{float:'right',fontSize:10,color:a.stock_actual<=a.stock_minimo?'#A32D2D':'#27500A'}}>Stock: {a.stock_actual}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {artId && <button onClick={exportar} className={styles.btnSec}><i className="ti ti-download" aria-hidden="true" /> Exportar Kardex</button>}
        {artId && <button onClick={() => { setArtId(null); setSearch(''); }} className={styles.btnSec}><i className="ti ti-x" aria-hidden="true" /> Cambiar artículo</button>}
      </div>

      {artInfo && (
        <div style={{background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,fontSize:13}}>
          <div>
            <div style={{fontWeight:500}}>{artInfo.nombre}</div>
            <div style={{fontSize:11,color:'var(--color-text-secondary)'}}>Código: {artInfo.codigo} · Grupo: {artInfo.grupo_nombre}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'var(--color-text-secondary)'}}>Stock actual</div>
            <div style={{fontSize:20,fontWeight:500,color:'#1B4F9B'}}>{artInfo.stock_actual}</div>
          </div>
        </div>
      )}

      {artId && kardex.length > 0 ? (
        <TableWrap>
          <colgroup>
            <col style={{width:100}}/><col style={{width:160}}/><col style={{width:75}}/><col style={{width:75}}/>
            <col style={{width:75}}/><col style={{width:80}}/><col style={{width:80}}/>
          </colgroup>
          <thead><tr>
            <th>Fecha</th><th>Referencia</th>
            <th className={styles.r}>Entrada</th><th className={styles.r}>Salida</th>
            <th className={styles.r}>Costo unit.</th><th className={styles.r}>Saldo</th><th>Usuario</th>
          </tr></thead>
          <tbody>
            {kardex.map((m, i) => {
              const esPos = ['ENTRADA','AJUSTE_POSITIVO'].includes(m.tipo);
              return (
                <tr key={i}>
                  <td className={styles.mono} style={{fontSize:10}}>{new Date(m.creado_en).toLocaleDateString('es-HN')}</td>
                  <td style={{fontSize:11}}>{m.referencia_tipo} — {m.usuario_nombre}</td>
                  <td className={styles.r} style={{color:esPos?'#27500A':'var(--color-text-tertiary)',fontFamily:'monospace'}}>{esPos ? fmtN(m.cantidad) : '—'}</td>
                  <td className={styles.r} style={{color:!esPos?'#A32D2D':'var(--color-text-tertiary)',fontFamily:'monospace'}}>{!esPos ? fmtN(m.cantidad) : '—'}</td>
                  <td className={styles.r}>{fmt(m.costo_unitario)}</td>
                  <td className={`${styles.r} ${styles.bold}`}>{fmtN(m.stock_nuevo)}</td>
                  <td className={styles.muted} style={{fontSize:11}}>{m.usuario_nombre}</td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      ) : artId ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--color-text-tertiary)'}}>Sin movimientos registrados para este artículo</div>
      ) : (
        <div style={{textAlign:'center',padding:'48px',color:'var(--color-text-tertiary)'}}>
          <i className="ti ti-clipboard-list" style={{fontSize:40,display:'block',marginBottom:10,opacity:.4}} aria-hidden="true" />
          <p>Buscá un artículo para ver su historial de movimientos</p>
        </div>
      )}
    </div>
  );
}

/* ── PESTAÑA 4: ALERTAS DE STOCK ─────────────────────────── */
function AlertasTab({ onReponer }) {
  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['inventario-alertas'],
    queryFn: () => api.get('/inventario/alertas').then(r => r.data),
    refetchInterval: 60_000,
  });

  const critico    = alertas.filter(a => a.stock_actual === 0);
  const muyBajo    = alertas.filter(a => a.stock_actual > 0 && a.stock_actual <= a.stock_minimo * 0.5);
  const bajo       = alertas.filter(a => a.stock_actual > a.stock_minimo * 0.5);

  return (
    <div>
      <div className={styles.statsRow}>
        {[
          { label:'Alertas activas',    val:alertas.length, color:'#A32D2D' },
          { label:'Stock cero',         val:critico.length, color:'#791F1F' },
          { label:'Crítico (<50% mín.)',val:muyBajo.length, color:'#633806' },
          { label:'Bajo mínimo',        val:bajo.length,    color:'#854F0B' },
        ].map(s => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statLbl}>{s.label}</div>
            <div className={styles.statVal} style={{color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      {alertas.length === 0 && !isLoading ? (
        <div style={{textAlign:'center',padding:48,color:'var(--color-text-tertiary)'}}>
          <i className="ti ti-circle-check" style={{fontSize:40,color:'var(--color-text-success)',display:'block',marginBottom:10}} aria-hidden="true" />
          <p>Todos los artículos están sobre el mínimo de stock.</p>
        </div>
      ) : (
        <TableWrap>
          <colgroup>
            <col style={{width:90}}/><col style={{width:175}}/><col style={{width:85}}/><col style={{width:60}}/>
            <col style={{width:60}}/><col style={{width:130}}/><col style={{width:85}}/>
          </colgroup>
          <thead><tr>
            <th>Código</th><th>Artículo</th><th>Grupo</th>
            <th className={styles.r}>Stock</th><th className={styles.r}>Mínimo</th>
            <th>Nivel</th><th style={{textAlign:'center'}}>Acción</th>
          </tr></thead>
          <tbody>
            {alertas.map(a => {
              const pct = Math.round(a.stock_actual / a.stock_minimo * 100);
              const color = a.stock_actual === 0 ? '#A32D2D' : pct < 50 ? '#854F0B' : '#633806';
              return (
                <tr key={a.id}>
                  <td className={styles.mono}>{a.codigo}</td>
                  <td style={{fontWeight:500}}>{a.nombre}</td>
                  <td className={styles.muted}>{a.grupo_nombre}</td>
                  <td className={styles.r} style={{color,fontWeight:500}}>{a.stock_actual}</td>
                  <td className={`${styles.r} ${styles.muted}`}>{a.stock_minimo}</td>
                  <td>
                    <div style={{height:6,background:'var(--color-background-secondary)',borderRadius:3,overflow:'hidden',marginBottom:3}}>
                      <div style={{height:'100%',width:`${Math.min(pct,100)}%`,background:color,borderRadius:3}} />
                    </div>
                    <div style={{fontSize:10,color}}>{a.stock_actual===0?'Sin stock':`${pct}% del mínimo`}</div>
                  </td>
                  <td style={{textAlign:'center'}}>
                    <button onClick={() => onReponer(a.id)} className={styles.btnOk} style={{fontSize:10,padding:'4px 8px'}}>
                      <i className="ti ti-package-import" style={{fontSize:12}} aria-hidden="true" /> Reponer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}

/* ── Helpers UI ───────────────────────────────────────────── */
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{position:'relative',flex:1,minWidth:160}}>
      <i className="ti ti-search" style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',fontSize:15,color:'var(--color-text-tertiary)',pointerEvents:'none'}} aria-hidden="true" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',padding:'7px 10px 7px 32px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}} />
    </div>
  );
}

function TableWrap({ children }) {
  return (
    <div style={{border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',overflow:'hidden',marginBottom:8}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,tableLayout:'fixed'}}>{children}</table>
    </div>
  );
}

function Pager({ page, total, limit, onPage }) {
  const pages = Math.ceil(total / limit) || 1;
  if (pages <= 1) return null;
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,color:'var(--color-text-secondary)',padding:'8px 4px'}}>
      <span>{Math.min((page-1)*limit+1,total)}–{Math.min(page*limit,total)} de {total}</span>
      <div style={{display:'flex',gap:4}}>
        <button onClick={() => onPage(p=>p-1)} disabled={page<=1} style={{padding:'4px 8px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',background:'var(--color-background-primary)',cursor:'pointer',color:'var(--color-text-secondary)'}}>‹</button>
        <button onClick={() => onPage(p=>p+1)} disabled={page>=pages} style={{padding:'4px 8px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',background:'var(--color-background-primary)',cursor:'pointer',color:'var(--color-text-secondary)'}}>›</button>
      </div>
    </div>
  );
}

function Badge({ type, children, sm }) {
  const map = { ok:'#EAF3DE,#27500A', er:'#FCEBEB,#791F1F', wa:'#FAEEDA,#633806', in:'#E6F1FB,#0C447C', pu:'#EEEDFE,#3C3489' };
  const [bg, txt] = (map[type] || map.in).split(',');
  return <span style={{background:bg,color:txt,borderRadius:10,padding:sm?'1px 6px':'2px 7px',fontSize:sm?9:10,fontWeight:500,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:3}}>{children}</span>;
}
