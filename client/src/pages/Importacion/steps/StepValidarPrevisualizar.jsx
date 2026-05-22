/**
 * POSManual - DevSys Honduras
 * Pasos 2, 3 y 4 de la importación
 * Archivo: client/src/pages/Importacion/steps/StepValidarPrevisualizar.jsx
 */
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

/* ────────────────────────────────────────────────────────────
   PASO 2 — Validar datos
   ──────────────────────────────────────────────────────────── */
export function StepValidar({ stats, onBack, onNext }) {
  const { total, validos, errores, grupos, isv15, isv18, exentos,
          servicios, listaErrores } = stats;

  const puedeImportar = validos > 0;

  return (
    <div style={{ padding: '0' }}>

      {/* Métricas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Total filas',    val: total.toLocaleString(),   color:'#185FA5' },
          { label:'Válidos',        val: validos.toLocaleString(), color:'#27500A' },
          { label:'Con errores',    val: errores,                  color: errores>0?'#A32D2D':'#27500A' },
          { label:'Grupos nuevos',  val: grupos,                   color:'#633806' },
        ].map(s => (
          <div key={s.label} style={{
            background:'var(--color-background-secondary)',
            borderRadius:'var(--border-radius-md)',padding:'14px 16px',
          }}>
            <div style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:500, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Breakdown ISV */}
      <div style={{
        background:'var(--color-background-primary)',
        border:'0.5px solid var(--color-border-tertiary)',
        borderRadius:'var(--border-radius-lg)',padding:'1rem 1.25rem',marginBottom:12,
      }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:12, color:'var(--color-text-primary)' }}>
          <i className="ti ti-chart-bar" style={{ marginRight:6, color:'#185FA5', fontSize:16 }} aria-hidden="true" />
          Distribución fiscal del catálogo
        </div>
        <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
          {[
            { label:'ISV 15%',  val:isv15,   bg:'#FAEEDA', txt:'#633806' },
            { label:'ISV 18%',  val:isv18,   bg:'#FCEBEB', txt:'#791F1F' },
            { label:'Exentos',  val:exentos, bg:'#EAF3DE', txt:'#27500A' },
            { label:'Servicios (sin stock)', val:servicios, bg:'#EEEDFE', txt:'#3C3489' },
          ].map(b => (
            <div key={b.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                background:b.bg, color:b.txt, borderRadius:20,
                padding:'3px 12px', fontSize:11, fontWeight:500,
              }}>
                {b.val.toLocaleString()} artículos
              </div>
              <span style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Advertencia si hay errores */}
      {errores > 0 && (
        <div style={{
          background:'var(--color-background-warning)',
          border:'0.5px solid var(--color-border-warning)',
          borderRadius:'var(--border-radius-md)',
          padding:'10px 14px', fontSize:12, color:'var(--color-text-warning)',
          display:'flex', gap:8, marginBottom:12,
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize:16, flexShrink:0, marginTop:1 }} aria-hidden="true" />
          <span>
            Se encontraron <strong>{errores}</strong> fila(s) con errores. Podés importar las{' '}
            <strong>{validos}</strong> filas válidas o corregir el archivo y volver a subirlo.
          </span>
        </div>
      )}

      {/* Lista de errores */}
      {listaErrores.length > 0 && (
        <div style={{
          background:'var(--color-background-primary)',
          border:'0.5px solid var(--color-border-tertiary)',
          borderRadius:'var(--border-radius-lg)',padding:'1rem 1.25rem',marginBottom:12,
        }}>
          <div style={{
            fontSize:13, fontWeight:500, marginBottom:12,
            color:'var(--color-text-danger)', display:'flex', alignItems:'center', gap:8,
          }}>
            <i className="ti ti-bug" style={{ fontSize:16 }} aria-hidden="true" />
            Errores detectados ({listaErrores.length})
          </div>
          <div style={{
            maxHeight:160, overflowY:'auto',
            border:'0.5px solid var(--color-border-danger)',
            borderRadius:'var(--border-radius-md)',
            background:'var(--color-background-danger)',
          }}>
            {listaErrores.slice(0, 50).map((e, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'flex-start', gap:8,
                padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-danger)',
                fontSize:12,
              }}>
                <span style={{
                  background:'#F09595', color:'#501313',
                  borderRadius:3, padding:'1px 6px', fontSize:10, fontWeight:500,
                  flexShrink:0, marginTop:1,
                }}>Fila {e.fila}</span>
                <div style={{ color:'var(--color-text-danger)' }}>
                  <strong>{e.codigo || 'sin código'}</strong> — {e.errores.join(' · ')}
                </div>
              </div>
            ))}
            {listaErrores.length > 50 && (
              <div style={{ padding:'8px 12px', fontSize:12, color:'var(--color-text-secondary)' }}>
                ... y {listaErrores.length - 50} errores más
              </div>
            )}
          </div>
          <div style={{ marginTop:10 }}>
            <button
              onClick={() => exportarErrores(listaErrores)}
              style={{
                background:'transparent', color:'#185FA5',
                border:'0.5px solid #85B7EB', borderRadius:'var(--border-radius-md)',
                padding:'6px 14px', fontSize:12, cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:6,
              }}
            >
              <i className="ti ti-download" aria-hidden="true" /> Exportar errores (.xlsx)
            </button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
        <button onClick={onBack} style={btnSecStyle}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Atrás
        </button>
        <button onClick={onNext} disabled={!puedeImportar} style={btnPrimStyle(puedeImportar)}>
          <i className="ti ti-table" aria-hidden="true" /> Previsualizar
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASO 3 — Previsualizar primeras 10 filas válidas
   ──────────────────────────────────────────────────────────── */
export function StepPrevisualizar({ rows, stats, onBack, onNext }) {
  const muestra = rows.filter(r => r.codigo && r.nombre).slice(0, 10);

  return (
    <div>
      <div style={{
        background:'var(--color-background-primary)',
        border:'0.5px solid var(--color-border-tertiary)',
        borderRadius:'var(--border-radius-lg)',padding:'1rem 1.25rem',marginBottom:12,
      }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-table" style={{ fontSize:16, color:'#185FA5' }} aria-hidden="true" />
          Vista previa — primeras 10 filas válidas
        </div>
        <div style={{ overflowX:'auto', borderRadius:'var(--border-radius-md)', border:'0.5px solid var(--color-border-tertiary)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:90 }} /><col style={{ width:200 }} />
              <col style={{ width:55 }} /><col style={{ width:90 }} />
              <col style={{ width:60 }} /><col style={{ width:70 }} /><col style={{ width:60 }} />
            </colgroup>
            <thead>
              <tr>
                {['Código','Nombre','Grupo','Precio venta','ISV %','Tipo','Stock'].map(h => (
                  <th key={h} style={{
                    background:'var(--color-background-secondary)',
                    padding:'8px 10px', textAlign:'left',
                    fontSize:11, fontWeight:500, color:'var(--color-text-secondary)',
                    borderBottom:'0.5px solid var(--color-border-tertiary)',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {muestra.map((row, i) => (
                <tr key={i} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                  <td style={{ padding:'7px 10px', fontSize:11, fontFamily:'monospace', color:'var(--color-text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {row.codigo}
                  </td>
                  <td style={{ padding:'7px 10px', color:'var(--color-text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={row.nombre}>
                    {row.nombre}
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'center', color:'var(--color-text-secondary)' }}>
                    {row.grupo || '—'}
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontFamily:'monospace', color:'var(--color-text-primary)' }}>
                    L. {(+row.precio1 || 0).toFixed(2)}
                  </td>
                  <td style={{ padding:'7px 10px' }}>
                    <IsvBadge val={row.impuesto1} />
                  </td>
                  <td style={{ padding:'7px 10px' }}>
                    <TipoBadge val={row.usaexist} />
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'var(--color-text-secondary)' }}>
                    {row.existencia || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:8 }}>
          Mostrando 10 de {stats.validos.toLocaleString()} filas válidas
        </div>
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onBack} style={btnSecStyle}>
          <i className="ti ti-arrow-left" aria-hidden="true" /> Atrás
        </button>
        <button onClick={onNext} style={btnPrimStyle(true)}>
          <i className="ti ti-database-import" aria-hidden="true" /> Iniciar importación ({stats.validos.toLocaleString()} artículos)
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PASO 4 — Importar con barra de progreso animada
   ──────────────────────────────────────────────────────────── */
const FASES = [
  { id:'f1', label:'Creando grupos', hasta:8  },
  { id:'f2', label:'Validando duplicados', hasta:15 },
  { id:'f3', label:'Insertando artículos', hasta:92 },
  { id:'f4', label:'Actualizando índices', hasta:100 },
];

export function StepImportar({ stats, resultado, isPending }) {
  const [pct,    setPct]    = useState(0);
  const [faseAct,setFaseAct]= useState(0);
  const [logs,   setLogs]   = useState(['Iniciando importación...']);
  const logRef  = useRef(null);
  const timerRef = useRef(null);

  const addLog = (msg) => setLogs(p => [...p, `[${new Date().toLocaleTimeString('es-HN')}] ${msg}`]);

  // Animación simulada mientras la petición está en curso
  useEffect(() => {
    if (!isPending && resultado) return;
    const total = stats.validos;
    addLog(`Total artículos a importar: ${total.toLocaleString()}`);
    addLog(`Grupos a crear: ${stats.grupos}`);

    let p = 0, fi = 0;
    timerRef.current = setInterval(() => {
      const fase = FASES[Math.min(fi, FASES.length - 1)];
      if (p < fase.hasta) {
        p = Math.min(p + (fi === 2 ? 0.6 : 0.3), fase.hasta);
        setPct(p);
        if (fi === 2) {
          const proc = Math.round(((p - 15) / (92 - 15)) * total);
          if (proc > 0 && proc % 400 < 2) addLog(`→ ${proc.toLocaleString()} artículos procesados`);
        }
      } else {
        if (fi === 0) addLog(`✓ ${stats.grupos} grupos creados/verificados`);
        if (fi === 1) addLog(`✓ Sin duplicados críticos`);
        fi++;
        setFaseAct(fi);
        if (fi >= FASES.length) clearInterval(timerRef.current);
      }
    }, 35);
    return () => clearInterval(timerRef.current);
  }, []);

  // Cuando llega la respuesta real del servidor
  useEffect(() => {
    if (resultado) {
      clearInterval(timerRef.current);
      setPct(100);
      setFaseAct(4);
      addLog(`✅ Importación completada: ${resultado.insertados} nuevos, ${resultado.actualizados} actualizados`);
    }
  }, [resultado]);

  // Auto-scroll del log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const fase = FASES[Math.min(faseAct, FASES.length - 1)];
  const listo = pct >= 100 && resultado;

  return (
    <div>
      <div style={{
        background:'var(--color-background-primary)',
        border:'0.5px solid var(--color-border-tertiary)',
        borderRadius:'var(--border-radius-lg)', padding:'1.25rem', marginBottom:12,
      }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <i className={listo ? 'ti ti-circle-check' : 'ti ti-loader-2'}
            style={{ fontSize:18, color: listo ? '#3B6D11' : '#185FA5' }} aria-hidden="true" />
          {listo ? 'Importación completada' : 'Importando artículos...'}
        </div>

        {/* Barra de progreso */}
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
            <span style={{ color:'var(--color-text-secondary)' }}>
              {listo ? '¡Completado exitosamente!' : fase?.label || 'Procesando...'}
            </span>
            <span style={{ fontWeight:500 }}>{Math.round(pct)}%</span>
          </div>
          <div style={{
            height:8, background:'var(--color-background-secondary)',
            borderRadius:4, border:'0.5px solid var(--color-border-tertiary)', overflow:'hidden',
          }}>
            <div style={{
              height:'100%', width:`${pct}%`,
              background: listo ? '#3B6D11' : '#1B4F9B',
              borderRadius:4, transition:'width .15s linear',
            }} />
          </div>
          {/* Indicadores de fase */}
          <div style={{ display:'flex', gap:16, marginTop:8, fontSize:11, flexWrap:'wrap' }}>
            {FASES.map((f, i) => (
              <div key={f.id} style={{
                display:'flex', alignItems:'center', gap:4,
                color: i < faseAct ? '#3B6D11' : i === faseAct ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                fontWeight: i === faseAct ? 500 : 400,
              }}>
                <i className={i < faseAct ? 'ti ti-check' : 'ti ti-circle'}
                  style={{ fontSize:12 }} aria-hidden="true" />
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* Log en vivo */}
        <div ref={logRef} style={{
          background:'var(--color-background-secondary)',
          border:'0.5px solid var(--color-border-tertiary)',
          borderRadius:'var(--border-radius-md)',
          padding:'10px 12px', fontSize:11,
          color:'var(--color-text-secondary)',
          maxHeight:140, overflowY:'auto',
          fontFamily:'var(--font-mono, monospace)',
          lineHeight:1.7,
        }}>
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      {/* Resultado final */}
      {resultado && (
        <div style={{
          background:'var(--color-background-success)',
          border:'0.5px solid var(--color-border-success)',
          borderRadius:'var(--border-radius-lg)',
          padding:'1.5rem', textAlign:'center', marginBottom:12,
        }}>
          <i className="ti ti-circle-check"
            style={{ fontSize:40, color:'var(--color-text-success)', display:'block', marginBottom:8 }} aria-hidden="true" />
          <h3 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-success)', marginBottom:4 }}>
            ¡{(resultado.insertados + resultado.actualizados).toLocaleString()} artículos procesados!
          </h3>
          <p style={{ fontSize:13, color:'var(--color-text-success)' }}>
            Grupos creados: {stats.grupos} · Servicios: {stats.servicios} · Errores omitidos: {stats.errores}
          </p>
          <div style={{ display:'flex', justifyContent:'center', gap:32, marginTop:16 }}>
            {[
              { label:'Nuevos',      val: resultado.insertados },
              { label:'Actualizados',val: resultado.actualizados },
              { label:'ISV 15%',     val: stats.isv15 },
              { label:'ISV 18%',     val: stats.isv18 },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <strong style={{ display:'block', fontSize:24, fontWeight:500, color:'var(--color-text-success)' }}>
                  {s.val.toLocaleString()}
                </strong>
                <span style={{ fontSize:11, color:'var(--color-text-success)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultado && (
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={() => exportarReporte(stats, resultado)} style={btnSecStyle}>
            <i className="ti ti-download" aria-hidden="true" /> Exportar reporte
          </button>
          <button onClick={() => window.location.href = '/articulos'} style={btnPrimStyle(true)}>
            <i className="ti ti-arrow-right" aria-hidden="true" /> Ir al catálogo
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Helpers de UI ─────────────────────────────────────────── */
function IsvBadge({ val }) {
  const n = Number(val);
  if (n === 0)  return <Badge bg="#EAF3DE" txt="#27500A">Exento</Badge>;
  if (n === 15) return <Badge bg="#FAEEDA" txt="#633806">15%</Badge>;
  if (n === 18) return <Badge bg="#FCEBEB" txt="#791F1F">18%</Badge>;
  return <Badge bg="#F1EFE8" txt="#5F5E5A">{val}</Badge>;
}

function TipoBadge({ val }) {
  return Number(val) === 2
    ? <Badge bg="#EEEDFE" txt="#3C3489">Servicio</Badge>
    : <Badge bg="#E6F1FB" txt="#0C447C">Inventario</Badge>;
}

function Badge({ bg, txt, children }) {
  return (
    <span style={{
      background: bg, color: txt,
      borderRadius: 10, padding: '2px 7px',
      fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function exportarErrores(lista) {
  const ws = XLSX.utils.json_to_sheet(lista.map(e => ({
    Fila: e.fila, Codigo: e.codigo || '', Nombre: e.nombre || '',
    Errores: e.errores.join('; '),
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errores');
  XLSX.writeFile(wb, 'errores_importacion.xlsx');
}

function exportarReporte(stats, resultado) {
  const datos = [
    ['Reporte de importación — POSManual DevSys Honduras'],
    ['Fecha', new Date().toLocaleDateString('es-HN')],
    [],
    ['Artículos nuevos',      resultado.insertados],
    ['Artículos actualizados',resultado.actualizados],
    ['Errores omitidos',      stats.errores],
    ['Grupos creados',        stats.grupos],
    ['ISV 15%',               stats.isv15],
    ['ISV 18%',               stats.isv18],
    ['Exentos',               stats.exentos],
    ['Servicios (sin stock)', stats.servicios],
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, 'reporte_importacion.xlsx');
}

/* ── Estilos de botones (inline para evitar dependencia de CSS module) ── */
const btnPrimStyle = (enabled) => ({
  background: enabled ? '#1B4F9B' : '#1B4F9B',
  color: '#fff', border: 'none',
  padding: '9px 20px', borderRadius: 'var(--border-radius-md)',
  fontSize: 13, fontWeight: 500, cursor: enabled ? 'pointer' : 'not-allowed',
  opacity: enabled ? 1 : 0.4,
  display: 'inline-flex', alignItems: 'center', gap: 6,
});

const btnSecStyle = {
  background: 'transparent', color: 'var(--color-text-primary)',
  border: '0.5px solid var(--color-border-secondary)',
  padding: '9px 16px', borderRadius: 'var(--border-radius-md)',
  fontSize: 13, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
