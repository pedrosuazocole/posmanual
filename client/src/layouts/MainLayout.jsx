/**
 * POSManual - DevSys Honduras
 * Layout principal — versión final integrada con todos los módulos
 * Archivo: client/src/layouts/MainLayout.jsx
 */
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect }  from 'react';
import { useAuth }   from '../auth/AuthContext';
import { usePOSStore } from '../store/posStore';

const NAV_ITEMS = [
  { to:'/pos',               icon:'ti-shopping-cart',  label:'Punto de venta',    modulo:'pos' },
  { to:'/turnos',            icon:'ti-clock',           label:'Turnos / Caja',     modulo:'turnos' },
  { to:'/articulos',         icon:'ti-package',         label:'Artículos',         modulo:'articulos' },
  { to:'/articulos/importar',icon:'ti-upload',          label:'Importar catálogo', modulo:'articulos', accion:'importar' },
  { to:'/inventario',        icon:'ti-clipboard-list',  label:'Inventario',        modulo:'inventario' },
  { to:'/reportes',          icon:'ti-chart-bar',       label:'Reportes',          modulo:'reportes' },
  { to:'/cuentas',           icon:'ti-coin',            label:'Cuentas C×C / C×P', modulo:'cuentas' },
  { to:'/bancos',            icon:'ti-building-bank',   label:'Bancos',            modulo:'bancos' },
  { to:'/usuarios',          icon:'ti-users',           label:'Usuarios',          modulo:'usuarios' },
];

const ROL_BADGE = {
  ADMINISTRADOR: { bg:'#EEEDFE', color:'#3C3489' },
  SUPERVISOR:    { bg:'#FAEEDA', color:'#633806' },
  CAJERO:        { bg:'#E6F1FB', color:'#0C447C' },
};

export default function MainLayout() {
  const { user, logout, puede } = useAuth();
  const { turno }   = usePOSStore();
  const navigate    = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [hora, setHora] = useState('');

  useEffect(() => {
    setHora(new Date().toLocaleString('es-HN'));
    const t = setInterval(() => setHora(new Date().toLocaleString('es-HN')), 1000);
    return () => clearInterval(t);
  }, []);

  const navVisible = NAV_ITEMS.filter(item =>
    puede(item.modulo, item.accion || 'leer')
  );

  const badge = ROL_BADGE[user?.rol] || { bg:'#F1EFE8', color:'#5F5E5A' };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div style={{display:'grid', gridTemplateColumns: collapsed ? '52px 1fr' : '200px 1fr', height:'100vh', transition:'grid-template-columns .2s'}}>

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside style={{background:'#0D3262', display:'flex', flexDirection:'column', overflow:'hidden', borderRight:'1px solid rgba(255,255,255,.08)'}}>

        {/* Logo */}
        <div style={{padding: collapsed ? '16px 12px' : '16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid rgba(255,255,255,.08)', minHeight:52}}>
          <div style={{width:28, height:28, background:'#1B4F9B', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700, flexShrink:0}}>PM</div>
          {!collapsed && <span style={{color:'#fff', fontWeight:500, fontSize:14, whiteSpace:'nowrap'}}>POS<span style={{color:'#93C5FD', fontWeight:400}}>Manual</span></span>}
        </div>

        {/* Navegación */}
        <nav style={{flex:1, overflowY:'auto', padding:'8px 0'}} aria-label="Menú principal">
          {navVisible.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/pos'}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:10,
                padding: collapsed ? '9px 12px' : '9px 14px',
                margin:'1px 6px', borderRadius:6,
                textDecoration:'none',
                background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                color: isActive ? '#fff' : '#93C5FD',
                fontSize:13, whiteSpace:'nowrap', overflow:'hidden',
                transition:'background .15s',
              })}
            >
              <i className={`ti ${item.icon}`} style={{fontSize:16, flexShrink:0}} aria-hidden="true" />
              {!collapsed && <span style={{overflow:'hidden', textOverflow:'ellipsis'}}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{background:'transparent', border:'none', cursor:'pointer', padding:'12px', color:'#93C5FD', display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'flex-start', gap:8, borderTop:'1px solid rgba(255,255,255,.08)', fontSize:13}}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <i className={`ti ${collapsed ? 'ti-layout-sidebar-right' : 'ti-layout-sidebar-left'}`} style={{fontSize:16}} aria-hidden="true" />
          {!collapsed && <span>Colapsar</span>}
        </button>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ─────────────────────────── */}
      <div style={{display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden'}}>

        {/* Topbar */}
        <header style={{background:'var(--color-background-primary)', borderBottom:'0.5px solid var(--color-border-tertiary)', padding:'0 20px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0}}>
          <span style={{fontSize:13, color:'var(--color-text-secondary)'}}>Inversiones Buenos Aires S.A.</span>

          {/* Turno activo */}
          {turno && (
            <span style={{background:'#EAF3DE', color:'#27500A', borderRadius:'var(--border-radius-md)', padding:'3px 10px', fontSize:11, fontWeight:500, display:'flex', alignItems:'center', gap:4}}>
              <span style={{width:6, height:6, borderRadius:'50%', background:'#3B6D11'}} />
              Turno #{turno.id} activo
            </span>
          )}

          <div style={{flex:1}} />

          {/* Reloj */}
          <span style={{fontSize:12, fontFamily:'monospace', color:'var(--color-text-secondary)'}}>{hora}</span>

          {/* Usuario */}
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13, fontWeight:500}}>{user?.nombre_completo || user?.username}</div>
              <div style={{fontSize:10, color:'var(--color-text-secondary)'}}>{user?.username}</div>
            </div>
            <span style={{background:badge.bg, color:badge.color, borderRadius:'var(--border-radius-md)', padding:'2px 8px', fontSize:10, fontWeight:500}}>
              {user?.rol}
            </span>
            <button
              onClick={handleLogout}
              style={{background:'transparent', border:'0.5px solid var(--color-border-secondary)', padding:'6px 10px', borderRadius:'var(--border-radius-md)', fontSize:12, cursor:'pointer', color:'var(--color-text-secondary)', display:'flex', alignItems:'center', gap:4}}
              aria-label="Cerrar sesión"
            >
              <i className="ti ti-logout" aria-hidden="true" /> Salir
            </button>
          </div>
        </header>

        {/* Página activa */}
        <main style={{flex:1, overflowY:'auto', padding:'20px 24px'}}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
