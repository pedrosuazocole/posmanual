/**
 * POSManual - DevSys Honduras
 * Modal: Crear / Editar usuario
 * Archivo: client/src/pages/Usuarios/UsuarioModal.jsx
 *
 * Incluye al final: CambiarPasswordModal (para que cualquier usuario
 * cambie su propia clave desde el menú de perfil).
 */
import { useState } from 'react';
import { ROL_PERMS, MODULOS_LABEL } from './UsuariosPage';

const ROLES = [
  { id:'ADMINISTRADOR', icon:'ti-shield',  label:'Administrador', desc:'Acceso total al sistema',                  cls:'admin' },
  { id:'SUPERVISOR',    icon:'ti-eye',     label:'Supervisor',    desc:'Reportes, anulaciones e inventario',       cls:'super' },
  { id:'CAJERO',        icon:'ti-cash',    label:'Cajero',        desc:'Solo POS y propio corte de caja',          cls:'cajero' },
];

const ROL_COLORS = {
  admin:  { bg:'#EEEDFE', bd:'#AFA9EC', tx:'#3C3489' },
  super:  { bg:'#FAEEDA', bd:'#FAC775', tx:'#633806' },
  cajero: { bg:'#E6F1FB', bd:'#85B7EB', tx:'#0C447C' },
};

export default function UsuarioModal({ usuario, onSave, onClose, saving }) {
  const isEdit = Boolean(usuario?.id);

  const [form, setForm] = useState({
    id:              usuario?.id              ?? undefined,
    nombre_completo: usuario?.nombre_completo ?? '',
    username:        usuario?.username        ?? '',
    email:           usuario?.email           ?? '',
    password:        '',
    rol:             usuario?.rol             ?? '',
  });
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const perms = ROL_PERMS[form.rol] || [];

  const validar = () => {
    const e = {};
    if (!form.nombre_completo.trim()) e.nombre_completo = 'Obligatorio';
    if (!isEdit && !form.username.trim()) e.username = 'Obligatorio';
    if (!isEdit && form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    if (isEdit && form.password && form.password.length < 8) e.password = 'Mínimo 8 caracteres';
    if (!form.rol) e.rol = 'Seleccioná un rol';
    // Validar formato username
    if (form.username && !/^[a-z0-9_]+$/.test(form.username)) {
      e.username = 'Solo minúsculas, números y guión bajo';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validar()) return;
    const payload = {
      ...form,
      nombre_completo: form.nombre_completo.trim(),
      username:        form.username.trim().toLowerCase(),
      email:           form.email.trim() || null,
    };
    // Si está editando y no cambió la contraseña, no la enviamos
    if (isEdit && !payload.password) delete payload.password;
    onSave(payload);
  };

  return (
    <div style={{minHeight:540,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--border-radius-lg)',marginTop:16}}
      role="dialog" aria-modal="true" aria-label={isEdit ? 'Editar usuario' : 'Nuevo usuario'}>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',width:520,maxWidth:'100%'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'0.5px solid var(--color-border-tertiary)'}}>
          <h3 style={{fontSize:15,fontWeight:500,display:'flex',alignItems:'center',gap:8}}>
            <i className={`ti ${isEdit ? 'ti-user-edit' : 'ti-user-plus'}`} style={{color:'#185FA5',fontSize:16}} aria-hidden="true" />
            {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </h3>
          <button onClick={onClose} style={{background:'transparent',border:'none',cursor:'pointer',fontSize:18,color:'var(--color-text-secondary)'}} aria-label="Cerrar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div style={{padding:18,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>

          {/* Nombre completo */}
          <Field label="Nombre completo *" error={errors.nombre_completo} style={{gridColumn:'1/-1'}}>
            <input value={form.nombre_completo}
              onChange={e => { set('nombre_completo', e.target.value); setErrors(p=>({...p,nombre_completo:''})); }}
              placeholder="Nombre y apellidos completos"
              style={inputStyle(errors.nombre_completo)} />
          </Field>

          {/* Username */}
          <Field label={`Usuario (login)${isEdit ? '' : ' *'}`} error={errors.username}>
            <input value={form.username}
              onChange={e => { set('username', e.target.value.toLowerCase()); setErrors(p=>({...p,username:''})); }}
              placeholder="lowercase_sin_espacios"
              disabled={isEdit}
              style={{...inputStyle(errors.username), ...(isEdit?{opacity:.6,cursor:'not-allowed'}:{})}} />
          </Field>

          {/* Email */}
          <Field label="Email">
            <input type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="correo@empresa.hn"
              style={inputStyle()} />
          </Field>

          {/* Contraseña */}
          <Field label={isEdit ? 'Nueva contraseña (opcional)' : 'Contraseña *'} error={errors.password} style={{gridColumn:'1/-1'}}>
            <div style={{position:'relative'}}>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => { set('password', e.target.value); setErrors(p=>({...p,password:''})); }}
                placeholder={isEdit ? 'Dejá vacío para no cambiar' : 'Mínimo 8 caracteres'}
                style={{...inputStyle(errors.password), paddingRight:36}} />
              <button type="button" onClick={() => setShowPass(v=>!v)}
                style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--color-text-tertiary)',fontSize:15,padding:2}}
                aria-label={showPass?'Ocultar contraseña':'Ver contraseña'}>
                <i className={`ti ${showPass?'ti-eye-off':'ti-eye'}`} aria-hidden="true" />
              </button>
            </div>
          </Field>

          {/* Selector de rol */}
          <div style={{gridColumn:'1/-1'}}>
            <div style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:8}}>
              Rol del usuario {errors.rol && <span style={{color:'#A32D2D',fontWeight:400,textTransform:'none',marginLeft:4}}>{errors.rol}</span>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}>
              {ROLES.map(r => {
                const sel = form.rol === r.id;
                const c   = ROL_COLORS[r.cls];
                return (
                  <button key={r.id} type="button"
                    onClick={() => { set('rol', r.id); setErrors(p=>({...p,rol:''})); }}
                    style={{
                      padding:'10px 8px', border:`0.5px solid ${sel ? c.bd : 'var(--color-border-secondary)'}`,
                      borderRadius:'var(--border-radius-md)', textAlign:'center', cursor:'pointer',
                      background: sel ? c.bg : 'var(--color-background-primary)',
                      transition:'.15s',
                    }}>
                    <i className={`ti ${r.icon}`} style={{display:'block',fontSize:20,marginBottom:4,color:sel?c.tx:'var(--color-text-secondary)'}} aria-hidden="true" />
                    <div style={{fontSize:12,fontWeight:sel?500:400,color:sel?c.tx:'var(--color-text-primary)'}}>{r.label}</div>
                    <div style={{fontSize:10,color:sel?c.tx:'var(--color-text-secondary)',marginTop:2,lineHeight:1.4}}>{r.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview de permisos */}
          {form.rol && (
            <div style={{gridColumn:'1/-1',background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-md)',padding:'10px 12px'}}>
              <div style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',marginBottom:8,textTransform:'uppercase',letterSpacing:'.3px'}}>
                Permisos del rol {form.rol}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'4px 12px'}}>
                {Object.keys(MODULOS_LABEL).map(m => {
                  const tiene = perms.includes(m);
                  return (
                    <div key={m} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:tiene?'var(--color-text-primary)':'var(--color-text-tertiary)',fontWeight:tiene?500:400}}>
                      <i className={`ti ${tiene?'ti-check':'ti-x'}`} style={{fontSize:13,color:tiene?'#27500A':'var(--color-text-tertiary)'}} aria-hidden="true" />
                      {MODULOS_LABEL[m]}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aviso de edición */}
          {isEdit && (
            <div style={{gridColumn:'1/-1',background:'var(--color-background-info)',border:'0.5px solid var(--color-border-info)',borderRadius:'var(--border-radius-md)',padding:'9px 12px',fontSize:12,color:'var(--color-text-info)',display:'flex',gap:7}}>
              <i className="ti ti-info-circle" style={{fontSize:14,flexShrink:0,marginTop:1}} aria-hidden="true" />
              El nombre de usuario no puede cambiarse. Dejá la contraseña en blanco para no modificarla.
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',padding:'14px 18px',borderTop:'0.5px solid var(--color-border-tertiary)'}}>
          <button onClick={onClose} style={{background:'transparent',border:'0.5px solid var(--color-border-secondary)',padding:'8px 14px',borderRadius:'var(--border-radius-md)',fontSize:12,cursor:'pointer',color:'var(--color-text-primary)'}}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{background:'#1B4F9B',color:'#fff',border:'none',padding:'9px 18px',borderRadius:'var(--border-radius-md)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:saving?.6:1}}>
            {saving
              ? <><span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .6s linear infinite',display:'inline-block'}}/> Guardando...</>
              : <><i className="ti ti-device-floppy" aria-hidden="true"/> {isEdit ? 'Actualizar' : 'Crear usuario'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── CambiarPasswordModal ────────────────────────────────────
 * Para que cualquier usuario (no solo Admin) cambie su propia clave.
 * Se muestra desde el menú de perfil en el topbar.
 * Archivo: client/src/pages/Usuarios/CambiarPasswordModal.jsx
 */
export function CambiarPasswordModal({ onClose }) {
  const [form, setForm] = useState({ actual:'', nueva:'', confirmar:'' });
  const [show, setShow] = useState({ actual:false, nueva:false });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validar = () => {
    const e = {};
    if (!form.actual) e.actual = 'Ingresá tu contraseña actual';
    if (form.nueva.length < 8) e.nueva = 'Mínimo 8 caracteres';
    if (form.nueva !== form.confirmar) e.confirmar = 'Las contraseñas no coinciden';
    if (form.nueva === form.actual) e.nueva = 'La nueva contraseña debe ser diferente a la actual';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      await import('../../api/axios').then(({ default: api }) =>
        api.post('/auth/cambiar-password', {
          password_actual: form.actual,
          password_nuevo:  form.nueva,
        })
      );
      onClose();
      // toast.success se dispara desde el padre
    } catch (err) {
      setErrors({ actual: err.response?.data?.message || 'Contraseña actual incorrecta' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{minHeight:380,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--border-radius-lg)',marginTop:16}}>
      <div style={{background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:'var(--border-radius-lg)',width:400,padding:24}}>
        <div style={{fontSize:15,fontWeight:500,marginBottom:18,display:'flex',alignItems:'center',gap:8}}>
          <i className="ti ti-lock" style={{color:'#185FA5',fontSize:18}} aria-hidden="true" /> Cambiar contraseña
        </div>

        {[
          { key:'actual',    label:'Contraseña actual',       toggle:'actual' },
          { key:'nueva',     label:'Nueva contraseña',        toggle:'nueva' },
          { key:'confirmar', label:'Confirmar nueva contraseña', toggle:'nueva' },
        ].map(({ key, label, toggle }) => (
          <div key={key} style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px',marginBottom:4}}>{label}</label>
            <div style={{position:'relative'}}>
              <input
                type={show[toggle] ? 'text' : 'password'}
                value={form[key]}
                onChange={e => { set(key, e.target.value); setErrors(p=>({...p,[key]:''})); }}
                style={{...inputStyle(errors[key]),width:'100%',paddingRight:36}}
                placeholder="••••••••"
              />
              {key !== 'confirmar' && (
                <button type="button" onClick={() => setShow(p=>({...p,[toggle]:!p[toggle]}))}
                  style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--color-text-tertiary)',fontSize:15,padding:2}}>
                  <i className={`ti ${show[toggle]?'ti-eye-off':'ti-eye'}`} aria-hidden="true" />
                </button>
              )}
            </div>
            {errors[key] && <div style={{fontSize:11,color:'#A32D2D',marginTop:3}}>{errors[key]}</div>}
          </div>
        ))}

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button onClick={onClose} style={{background:'transparent',border:'0.5px solid var(--color-border-secondary)',padding:'8px 14px',borderRadius:'var(--border-radius-md)',fontSize:12,cursor:'pointer'}}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={saving}
            style={{background:'#1B4F9B',color:'#fff',border:'none',padding:'9px 18px',borderRadius:'var(--border-radius-md)',fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:saving?.6:1}}>
            {saving ? 'Guardando...' : <><i className="ti ti-check" aria-hidden="true"/> Cambiar contraseña</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Helpers */
function Field({ label, error, children, style }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, ...style }}>
      <label style={{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase',letterSpacing:'.3px'}}>
        {label}
      </label>
      {children}
      {error && <span style={{fontSize:11,color:'#A32D2D'}}>{error}</span>}
    </div>
  );
}

function inputStyle(err) {
  return {
    padding:'8px 10px',
    border:`0.5px solid ${err?'#A32D2D':'var(--color-border-secondary)'}`,
    borderRadius:'var(--border-radius-md)',
    fontSize:13,
    background:'var(--color-background-primary)',
    color:'var(--color-text-primary)',
    outline:'none',
    width:'100%',
  };
}
