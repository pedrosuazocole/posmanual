/**
 * POSManual - DevSys Honduras
 * Modal: Registrar movimiento de inventario
 * Archivo: client/src/pages/Inventario/MovimientoModal.jsx
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';

const TIPOS = [
  { id:'ENTRADA',          icon:'ti-package-import',   label:'Entrada',       cls:'ok' },
  { id:'SALIDA',           icon:'ti-package-export',   label:'Salida',        cls:'er' },
  { id:'AJUSTE_POSITIVO',  icon:'ti-adjustments-plus', label:'Ajuste +',      cls:'wa' },
  { id:'AJUSTE_NEGATIVO',  icon:'ti-adjustments-minus',label:'Ajuste −',      cls:'wa' },
  { id:'MERMA',            icon:'ti-trash',            label:'Merma',         cls:'pu' },
  { id:'TRANSFERENCIA',    icon:'ti-transfer',         label:'Transferencia', cls:'in' },
];

const TIPO_COLORS = { ok:'#EAF3DE,#27500A,#C0DD97', er:'#FCEBEB,#791F1F,#F7C1C1', wa:'#FAEEDA,#633806,#FAC775', pu:'#EEEDFE,#3C3489,#CECBF6', in:'#E6F1FB,#0C447C,#B5D4F4' };

export default function MovimientoModal({ articuloId, onSave, onClose }) {
  const [tipo,       setTipo]       = useState('');
  const [artSearch,  setArtSearch]  = useState('');
  const [artSel,     setArtSel]     = useState(null);
  const [showList,   setShowList]   = useState(false);
  const [cantidad,   setCantidad]   = useState('');
  const [costo,      setCosto]      = useState('');
  const [referencia, setReferencia] = useState('');
  const [obs,        setObs]        = useState('');
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState({});

  // Si se abre desde "Reponer" ya viene con articuloId
  const { data: artPreload } = useQuery({
    queryKey: ['art-preload', articuloId],
    queryFn: () => api.get(`/articulos/${articuloId}`).then(r => r.data),
    enabled: Boolean(articuloId),
  });
  useEffect(() => {
    if (artPreload) { setArtSel(artPreload); setArtSearch(artPreload.nombre); setCosto(artPreload.precio_costo); }
  }, [artPreload]);

  // Búsqueda de artículos en tiempo real
  const { data: sugeridos = [] } = useQuery({
    queryKey: ['mov-art-search', artSearch],
    queryFn: () => api.get(`/articulos?q=${artSearch}&limit=8&activo=true`).then(r => r.data.data.filter(a => !a.no_usar_existencia)),
    enabled: artSearch.length >= 2 && !artSel,
  });

  // Calcular nuevo stock en tiempo real
  const esPositivo = ['ENTRADA', 'AJUSTE_POSITIVO'].includes(tipo);
  const esNegativo = ['SALIDA', 'AJUSTE_NEGATIVO', 'MERMA'].includes(tipo);
  const cant = +cantidad || 0;
  const nuevoStock = artSel
    ? esPositivo ? artSel.stock_actual + cant
    : esNegativo ? Math.max(0, artSel.stock_actual - cant)
    : artSel.stock_actual
    : null;

  const validar = () => {
    const e = {};
    if (!tipo)      e.tipo     = 'Seleccioná el tipo';
    if (!artSel)    e.art      = 'Seleccioná un artículo';
    if (!cant || cant <= 0) e.cant = 'Ingresá una cantidad válida';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      await api.post('/inventario/movimientos', {
        articulo_id:    artSel.id,
        tipo,
        cantidad:       +cantidad,
        costo_unitario: +costo || artSel.precio_costo,
        referencia_tipo:'AJUSTE_MANUAL',
        observaciones:  obs.trim() || null,
        proveedor_ref:  referencia.trim() || null,
      });
      onSave();
    } catch (err) {
      setErrors({ general: err.response?.data?.message || 'Error al registrar movimiento' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{minHeight:520,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--border-radius-lg)',marginTop:16}}
      role="dialog" aria-modal="true" aria-label="Nuevo movimiento de inventario">
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',width:500,maxWidth:'100%'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
          <h3 style={{fontSize:15,fontWeight:500,display:'flex',alignItems:'center',gap:8}}>
            <i className="ti ti-package" style={{fontSize:16,color:'#185FA5'}} aria-hidden="true" /> Nuevo movimiento de inventario
          </h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,color:'var(--color-text-secondary)'}} aria-label="Cerrar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div style={{padding:18,display:'flex',flexDirection:'column',gap:12}}>

          {errors.general && (
            <div style={{background:'var(--color-background-danger)',border:'0.5px solid var(--color-border-danger)',borderRadius:'var(--border-radius-md)',padding:'8px 12px',fontSize:12,color:'var(--color-text-danger)',display:'flex',gap:6}}>
              <i className="ti ti-alert-circle" style={{fontSize:14,flexShrink:0}} aria-hidden="true" />{errors.general}
            </div>
          )}

          {/* Tipo de movimiento */}
          <div>
            <label style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',display:'block',marginBottom:8}}>
              Tipo de movimiento {errors.tipo && <span style={{color:'#A32D2D',fontWeight:400,textTransform:'none'}}>— {errors.tipo}</span>}
            </label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
              {TIPOS.map(t => {
                const [bg, txt, bdr] = (TIPO_COLORS[t.cls] || TIPO_COLORS.in).split(',');
                const sel = tipo === t.id;
                return (
                  <button key={t.id} onClick={() => setTipo(t.id)}
                    style={{padding:'9px 6px',border:`0.5px solid ${sel?bdr:'var(--color-border-secondary)'}`,borderRadius:'var(--border-radius-md)',textAlign:'center',cursor:'pointer',background:sel?bg:'var(--color-background-primary)',color:sel?txt:'var(--color-text-secondary)',fontSize:11,fontWeight:sel?500:400,transition:'.15s'}}>
                    <i className={`ti ${t.icon}`} style={{display:'block',fontSize:18,marginBottom:3}} aria-hidden="true" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Artículo */}
          <div style={{position:'relative'}}>
            <label style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',display:'block',marginBottom:4}}>
              Artículo * {errors.art && <span style={{color:'#A32D2D',fontWeight:400,textTransform:'none'}}>— {errors.art}</span>}
            </label>
            <input type="text" value={artSearch}
              onChange={e => { setArtSearch(e.target.value); setArtSel(null); setShowList(true); setErrors(p=>({...p,art:''})); }}
              placeholder="Buscar por nombre o código..."
              style={{width:'100%',padding:'8px 10px',border:`0.5px solid ${errors.art?'#A32D2D':'var(--color-border-secondary)'}`,borderRadius:'var(--border-radius-md)',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}} />
            {showList && sugeridos.length > 0 && !artSel && (
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',zIndex:10,maxHeight:160,overflowY:'auto',marginTop:2}}>
                {sugeridos.map(a => (
                  <div key={a.id} onClick={() => { setArtSel(a); setArtSearch(a.nombre); setCosto(a.precio_costo); setShowList(false); }}
                    style={{padding:'7px 12px',cursor:'pointer',fontSize:12,borderBottom:'0.5px solid var(--color-border-tertiary)'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--color-background-secondary)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <strong>{a.nombre}</strong>
                    <span style={{fontFamily:'monospace',fontSize:10,color:'var(--color-text-secondary)',marginLeft:8}}>{a.codigo}</span>
                    <span style={{float:'right',fontSize:10,color:a.stock_actual<=a.stock_minimo?'#A32D2D':'#27500A'}}>Stock: {a.stock_actual}</span>
                  </div>
                ))}
              </div>
            )}
            {artSel && (
              <div style={{marginTop:6,background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'8px 12px',display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                <i className="ti ti-package" style={{fontSize:16,color:'#185FA5'}} aria-hidden="true" />
                <div style={{flex:1}}>
                  <strong style={{fontSize:13}}>{artSel.nombre}</strong>
                  <span style={{fontSize:10,color:'var(--color-text-secondary)',marginLeft:6}}>{artSel.codigo}</span>
                </div>
                <span style={{background:artSel.stock_actual<=artSel.stock_minimo?'#FCEBEB':'#EAF3DE',color:artSel.stock_actual<=artSel.stock_minimo?'#791F1F':'#27500A',borderRadius:10,padding:'2px 8px',fontSize:11,fontWeight:500}}>
                  Stock: {artSel.stock_actual}
                </span>
              </div>
            )}
          </div>

          {/* Cantidad y costo */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div>
              <label style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',display:'block',marginBottom:4}}>
                Cantidad * {errors.cant && <span style={{color:'#A32D2D',fontWeight:400,textTransform:'none'}}>— {errors.cant}</span>}
              </label>
              <input type="number" min="0.001" step="0.001" value={cantidad}
                onChange={e => { setCantidad(e.target.value); setErrors(p=>({...p,cant:''})); }}
                placeholder="0"
                style={{width:'100%',padding:'8px 10px',border:`0.5px solid ${errors.cant?'#A32D2D':'var(--color-border-secondary)'}`,borderRadius:'var(--border-radius-md)',fontSize:14,fontWeight:500,textAlign:'right',background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}} />
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',display:'block',marginBottom:4}}>Costo unitario (L.)</label>
              <input type="number" min="0" step="0.01" value={costo} onChange={e=>setCosto(e.target.value)}
                placeholder="0.00"
                style={{width:'100%',padding:'8px 10px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:13,textAlign:'right',background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}} />
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',display:'block',marginBottom:4}}>Proveedor / Referencia</label>
            <input type="text" value={referencia} onChange={e=>setReferencia(e.target.value)} placeholder="Ej: Factura compra #1234"
              style={{width:'100%',padding:'8px 10px',border:'0.5px solid var(--color-border-secondary)',borderRadius:'var(--border-radius-md)',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',outline:'none'}} />
          </div>

          {/* Nuevo stock preview */}
          {artSel && tipo && cant > 0 && nuevoStock !== null && (
            <div style={{background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'10px 14px',fontSize:12,color:'var(--color-text-secondary)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Nuevo stock después del movimiento:</span>
              <span style={{fontSize:16,fontWeight:500,color:nuevoStock<=artSel.stock_minimo?'#A32D2D':'#27500A',fontFamily:'monospace'}}>
                {artSel.stock_actual} → <strong>{nuevoStock}</strong>
                <span style={{fontSize:11,fontWeight:400,marginLeft:4}}>({esPositivo?'+':esNegativo?'−':''}{cant})</span>
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',padding:'14px 18px',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
          <button onClick={onClose} style={{background:'transparent',border:'0.5px solid var(--color-border-secondary)',padding:'8px 14px',borderRadius:'var(--border-radius-md)',fontSize:12,cursor:'pointer',color:'var(--color-text-primary)'}}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            style={{background:'#27500A',color:'#fff',border:'none',padding:'9px 18px',borderRadius:'var(--border-radius-md)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:saving?.6:1}}>
            {saving
              ? <><span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .6s linear infinite',display:'inline-block'}}/> Registrando...</>
              : <><i className="ti ti-check" aria-hidden="true"/> Registrar movimiento</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
