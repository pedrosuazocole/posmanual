/**
 * POSManual - DevSys Honduras
 * Página: Gestión de Usuarios (solo ADMINISTRADOR)
 * Archivo: client/src/pages/Usuarios/UsuariosPage.jsx
 *
 * Funciones:
 *  - Listado con búsqueda, filtro por rol y estado
 *  - Crear usuario con selector visual de rol y preview de permisos
 *  - Editar datos (sin poder cambiar username)
 *  - Activar / desactivar (soft delete con confirmación)
 *  - Reset rápido de contraseña a valor temporal
 *  - Cambio de contraseña propio desde cualquier rol
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../../auth/AuthContext';
import api          from '../../api/axios';
import UsuarioModal from './UsuarioModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import styles       from './UsuariosPage.module.css';

// Mapa de permisos por rol (espeja los permisos del seed SQL)
export const ROL_PERMS = {
  ADMINISTRADOR: ['pos','articulos','grupos','inventario','reportes','turnos','usuarios','proveedores','cuentas','bancos'],
  SUPERVISOR:    ['pos','articulos','grupos','inventario','reportes','turnos'],
  CAJERO:        ['pos','turnos'],
};

export const MODULOS_LABEL = {
  pos:'POS', articulos:'Artículos', grupos:'Grupos', inventario:'Inventario',
  reportes:'Reportes', turnos:'Turnos', usuarios:'Usuarios',
  proveedores:'Proveedores', cuentas:'Cuentas', bancos:'Bancos',
};

// Colores de avatar deterministas por ID
const AVATAR_PALETTES = [
  ['#E6F1FB','#0C447C'], ['#EEEDFE','#3C3489'], ['#EAF3DE','#27500A'],
  ['#FAEEDA','#633806'], ['#E1F5EE','#085041'], ['#FAECE7','#712B13'],
];
export const avatarColors = (id) => AVATAR_PALETTES[(id - 1) % AVATAR_PALETTES.length];
export const initials = (name) => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

export default function UsuariosPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const [search,   setSearch]   = useState('');
  const [rolFil,   setRolFil]   = useState('');
  const [estadoFil,setEstadoFil]= useState('true');
  const [modal,    setModal]    = useState(null);  // null | {} | usuario
  const [confirm,  setConfirm]  = useState(null);  // null | { tipo, usuario }

  // ── Cargar usuarios ───────────────────────────────────────
  const { data = [], isLoading } = useQuery({
    queryKey: ['usuarios', { search, rolFil, estadoFil }],
    queryFn: () => api.get('/usuarios', {
      params: { q: search, rol: rolFil, activo: estadoFil }
    }).then(r => r.data),
    placeholderData: [],
  });

  const usuarios = data;

  // ── Crear / editar ────────────────────────────────────────
  const guardarMut = useMutation({
    mutationFn: (payload) =>
      payload.id
        ? api.put(`/usuarios/${payload.id}`, payload).then(r => r.data)
        : api.post('/usuarios', payload).then(r => r.data),
    onSuccess: (_, payload) => {
      qc.invalidateQueries(['usuarios']);
      toast.success(payload.id ? 'Usuario actualizado' : 'Usuario creado correctamente');
      setModal(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar usuario'),
  });

  // ── Activar / Desactivar ──────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: (u) => api.put(`/usuarios/${u.id}`, { activo: !u.activo }).then(r => r.data),
    onSuccess: (_, u) => {
      qc.invalidateQueries(['usuarios']);
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario reactivado');
      setConfirm(null);
    },
    onError: () => toast.error('No se pudo cambiar el estado'),
  });

  // ── Reset de contraseña ───────────────────────────────────
  const resetPassMut = useMutation({
    mutationFn: (u) => api.post(`/usuarios/${u.id}/reset-password`).then(r => r.data),
    onSuccess: (data, u) => {
      qc.invalidateQueries(['usuarios']);
      toast.success(`Contraseña de "${u.username}" reseteada → ${data.password_temporal}`);
      setConfirm(null);
    },
    onError: () => toast.error('No se pudo resetear la contraseña'),
  });

  // ── Resumen stats ─────────────────────────────────────────
  const resumen = {
    total:       usuarios.length,
    activos:     usuarios.filter(u => u.activo).length,
    cajeros:     usuarios.filter(u => u.rol === 'CAJERO').length,
    supervisores:usuarios.filter(u => u.rol === 'SUPERVISOR').length,
  };

  const ROL_BADGE = {
    ADMINISTRADOR: { bg:'#EEEDFE', txt:'#3C3489', label:'Admin' },
    SUPERVISOR:    { bg:'#FAEEDA', txt:'#633806', label:'Supervisor' },
    CAJERO:        { bg:'#E6F1FB', txt:'#0C447C', label:'Cajero' },
  };

  return (
    <div className={styles.page}>

      {/* Stats */}
      <div className={styles.statsRow}>
        {[
          { label:'Total usuarios',  val:resumen.total,        color:'#185FA5' },
          { label:'Activos',         val:resumen.activos,      color:'#27500A' },
          { label:'Cajeros',         val:resumen.cajeros,      color:'#0C447C' },
          { label:'Supervisores',    val:resumen.supervisores, color:'#633806' },
        ].map(s => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statLbl}>{s.label}</div>
            <div className={styles.statVal} style={{ color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o usuario..."
          />
        </div>
        <select value={rolFil} onChange={e => setRolFil(e.target.value)}>
          <option value="">Todos los roles</option>
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="CAJERO">Cajero</option>
        </select>
        <select value={estadoFil} onChange={e => setEstadoFil(e.target.value)}>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
          <option value="">Todos</option>
        </select>
        <button className={styles.btnPrim} onClick={() => setModal({})}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuevo usuario
        </button>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        <table>
          <colgroup>
            <col style={{width:36}} /><col style={{width:175}} /><col style={{width:100}} />
            <col style={{width:90}} /><col style={{width:130}} /><col style={{width:80}} />
            <col style={{width:100}} /><col style={{width:95}} />
          </colgroup>
          <thead>
            <tr>
              <th />
              <th>Nombre completo</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Email</th>
              <th style={{textAlign:'center'}}>Estado</th>
              <th style={{textAlign:'center'}}>Último acceso</th>
              <th style={{textAlign:'center'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({length:5}).map((_,i)=>(
                <tr key={i}><td colSpan={8} className={styles.skeleton} /></tr>
              ))
            ) : usuarios.map(u => {
              const [avBg, avTx] = avatarColors(u.id);
              const badge = ROL_BADGE[u.rol];
              const esYo  = u.id === me?.id;
              return (
                <tr key={u.id} style={!u.activo?{opacity:.55}:{}}>
                  {/* Avatar */}
                  <td>
                    <div style={{width:32,height:32,borderRadius:'50%',background:avBg,color:avTx,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500}}>
                      {initials(u.nombre_completo)}
                    </div>
                  </td>
                  <td style={{fontWeight:500}}>
                    {u.nombre_completo}
                    {esYo && <span style={{background:'var(--color-background-secondary)',color:'var(--color-text-tertiary)',borderRadius:8,padding:'1px 6px',fontSize:9,fontWeight:500,marginLeft:6}}>Vos</span>}
                  </td>
                  <td style={{fontFamily:'monospace',fontSize:11}}>{u.username}</td>
                  <td>
                    <span style={{background:badge?.bg,color:badge?.txt,borderRadius:10,padding:'2px 8px',fontSize:10,fontWeight:500}}>
                      {badge?.label || u.rol}
                    </span>
                  </td>
                  <td style={{fontSize:11,color:'var(--color-text-secondary)'}}>{u.email || '—'}</td>
                  <td style={{textAlign:'center'}}>
                    <span style={{background:u.activo?'#EAF3DE':'#FCEBEB',color:u.activo?'#27500A':'#791F1F',borderRadius:10,padding:'2px 8px',fontSize:10,fontWeight:500}}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{textAlign:'center',fontSize:11,color:'var(--color-text-secondary)'}}>
                    {u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleDateString('es-HN') : '—'}
                  </td>
                  <td style={{textAlign:'center'}}>
                    {/* Editar */}
                    <button onClick={() => setModal(u)} className={styles.btnIco} aria-label="Editar usuario">
                      <i className="ti ti-edit" aria-hidden="true" />
                    </button>
                    {/* Reset contraseña (no al propio admin) */}
                    {!esYo && (
                      <button onClick={() => setConfirm({ tipo:'reset', usuario:u })} className={styles.btnIcoWarn} aria-label="Resetear contraseña">
                        <i className="ti ti-key" aria-hidden="true" />
                      </button>
                    )}
                    {/* Activar / desactivar (no a uno mismo) */}
                    {!esYo && (
                      <button
                        onClick={() => setConfirm({ tipo:'toggle', usuario:u })}
                        className={u.activo ? styles.btnIcoDel : styles.btnIco}
                        aria-label={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
                      >
                        <i className={`ti ti-${u.activo ? 'user-off' : 'user-check'}`} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal crear/editar */}
      {modal !== null && (
        <UsuarioModal
          usuario={modal.id ? modal : null}
          onSave={(data) => guardarMut.mutate(data)}
          onClose={() => setModal(null)}
          saving={guardarMut.isPending}
        />
      )}

      {/* Confirmación toggle / reset */}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.tipo === 'toggle'
              ? `${confirm.usuario.activo ? 'Desactivar' : 'Activar'} usuario`
              : 'Resetear contraseña'
          }
          message={
            confirm.tipo === 'toggle'
              ? `¿${confirm.usuario.activo ? 'Desactivar' : 'Activar'} a "${confirm.usuario.username}"?`
              : `¿Resetear la contraseña de "${confirm.usuario.username}" a una temporal?`
          }
          confirmLabel={confirm.tipo === 'toggle' ? (confirm.usuario.activo ? 'Desactivar' : 'Activar') : 'Resetear'}
          danger={confirm.tipo === 'toggle' && confirm.usuario.activo}
          onConfirm={() =>
            confirm.tipo === 'toggle'
              ? toggleMut.mutate(confirm.usuario)
              : resetPassMut.mutate(confirm.usuario)
          }
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
