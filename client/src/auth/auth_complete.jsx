/**
 * POSManual - DevSys Honduras
 * Autenticación completa: LoginPage + AuthContext + useAuth + ProtectedRoute
 * Archivo: client/src/auth/ (varios archivos combinados con separadores)
 *
 * ─── 1. LoginPage.jsx ────────────────────────────────────────
 * Archivo: client/src/pages/Login/LoginPage.jsx
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const { login }   = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const from        = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setError('Ingresá tu usuario y contraseña');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim().toLowerCase(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoMark}>PM</div>
          <div className={styles.logoName}>POSManual</div>
          <div className={styles.logoSub}>DevSys Honduras · Inversiones Buenos Aires S.A.</div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBox} role="alert">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="login-user">Usuario</label>
            <div className={styles.inputWrap}>
              <i className="ti ti-user" aria-hidden="true" />
              <input
                id="login-user" type="text"
                value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="admin / cajero01..."
                autoComplete="username" autoFocus
                className={error ? styles.inputErr : ''}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="login-pass">Contraseña</label>
            <div className={styles.inputWrap}>
              <i className="ti ti-lock" aria-hidden="true" />
              <input
                id="login-pass"
                type={showPass ? 'text' : 'password'}
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                className={error ? styles.inputErr : ''}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button type="submit" className={styles.btnLogin} disabled={loading}>
            {loading
              ? <><span className={styles.spinner} /> Verificando...</>
              : <><i className="ti ti-login" aria-hidden="true" /> Iniciar sesión</>
            }
          </button>
        </form>

        <div className={styles.version}>v1.0.0 · POSManual</div>
      </div>
    </div>
  );
}

/*
 * ─── 2. AuthContext.jsx + useAuth.js ────────────────────────
 * Archivo: client/src/auth/AuthContext.jsx
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api/axios';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);   // { id, username, rol, nombre_completo, permisos }
  const [ready,   setReady]   = useState(false);  // se hidrata desde localStorage al montar

  // Rehidratar sesión al recargar la página
  useEffect(() => {
    const token = localStorage.getItem('posmanual_token');
    const saved = localStorage.getItem('posmanual_user');
    if (token && saved) {
      try { setUser(JSON.parse(saved)); } catch { /* token corrupto */ }
    }
    setReady(true);
  }, []);

  /** Login → obtiene JWT → guarda en localStorage → actualiza estado */
  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('posmanual_token', data.token);
    localStorage.setItem('posmanual_user',  JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  /** Logout → limpia localStorage y estado */
  const logout = useCallback(() => {
    localStorage.removeItem('posmanual_token');
    localStorage.removeItem('posmanual_user');
    setUser(null);
  }, []);

  /** Verifica si el usuario tiene un permiso concreto sobre un módulo */
  const puede = useCallback((modulo, accion = 'leer') => {
    if (!user?.permisos) return false;
    const acciones = user.permisos[modulo];
    if (!Array.isArray(acciones)) return false;
    return acciones.includes(accion) || acciones.includes('*');
  }, [user]);

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout, puede }}>
      {children}
    </AuthCtx.Provider>
  );
}

/** Hook de acceso al contexto */
export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

/*
 * ─── 3. ProtectedRoute.jsx ──────────────────────────────────
 * Archivo: client/src/auth/ProtectedRoute.jsx
 *
 * Uso:
 *   <ProtectedRoute>            → cualquier usuario autenticado
 *   <ProtectedRoute roles={['ADMINISTRADOR','SUPERVISOR']}>
 *   <ProtectedRoute modulo="reportes" accion="exportar">
 */
import { Navigate, useLocation } from 'react-router-dom';

export function ProtectedRoute({ children, roles, modulo, accion = 'leer' }) {
  const { user, ready, puede } = useAuth();
  const location = useLocation();

  // Esperar hidratación del token
  if (!ready) return null;

  // No autenticado → redirigir a /login guardando el destino original
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar rol requerido
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/sin-acceso" replace />;
  }

  // Verificar permiso granular
  if (modulo && !puede(modulo, accion)) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return children;
}

/*
 * ─── 4. AppRouter.jsx (rutas completas con guards) ──────────
 * Archivo: client/src/router/AppRouter.jsx
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }     from '../auth/AuthContext';
import { ProtectedRoute }   from '../auth/ProtectedRoute';
import MainLayout           from '../layouts/MainLayout';

import { LoginPage }        from '../pages/Login/LoginPage';
import POSPage              from '../pages/POS/POSPage';
import TurnosPage           from '../pages/Turnos/TurnosPage';
import ArticulosPage        from '../pages/Articulos/ArticulosPage';
import ImportacionPage      from '../pages/Importacion/ImportacionPage';
import ReportesPage         from '../pages/Reportes/ReportesPage';
import SinAccesoPage        from '../pages/SinAcceso/SinAccesoPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas protegidas dentro del layout principal */}
          <Route path="/" element={
            <ProtectedRoute><MainLayout /></ProtectedRoute>
          }>
            {/* POS — todos los roles autenticados */}
            <Route index element={<Navigate to="/pos" replace />} />
            <Route path="pos" element={
              <ProtectedRoute modulo="pos"><POSPage /></ProtectedRoute>
            } />

            {/* Turnos — todos los roles */}
            <Route path="turnos" element={
              <ProtectedRoute modulo="turnos"><TurnosPage /></ProtectedRoute>
            } />

            {/* Artículos — cajero solo lectura */}
            <Route path="articulos" element={
              <ProtectedRoute modulo="articulos"><ArticulosPage /></ProtectedRoute>
            } />
            <Route path="articulos/importar" element={
              <ProtectedRoute modulo="articulos" accion="importar" roles={['ADMINISTRADOR','SUPERVISOR']}>
                <ImportacionPage />
              </ProtectedRoute>
            } />

            {/* Reportes — Admin y Supervisor */}
            <Route path="reportes" element={
              <ProtectedRoute modulo="reportes" roles={['ADMINISTRADOR','SUPERVISOR']}>
                <ReportesPage />
              </ProtectedRoute>
            } />

            {/* Sin acceso */}
            <Route path="sin-acceso" element={<SinAccesoPage />} />

            {/* 404 → redirige al POS */}
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

/*
 * ─── 5. Backend: auth.controller.js ─────────────────────────
 * Archivo: server/src/controllers/auth.controller.js
 */
const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
// const { pool } = require('../db');  -- importar en producción

/** POST /api/v1/auth/login */
exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
  }
  try {
    // 1. Buscar usuario activo
    const { rows: [usuario] } = await pool.query(
      `SELECT u.*, r.nombre AS rol, r.permisos
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       WHERE u.username = $1 AND u.activo = TRUE`,
      [username.trim().toLowerCase()]
    );
    if (!usuario) {
      // Delay para mitigar timing attacks
      await bcrypt.hash('dummy', 10);
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    // 2. Verificar contraseña
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) return res.status(401).json({ message: 'Contraseña incorrecta' });

    // 3. Generar JWT con payload mínimo
    const payload = {
      id:       usuario.id,
      username: usuario.username,
      rol:      usuario.rol,
      permisos: usuario.permisos,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    // 4. Responder (no enviar password_hash)
    return res.json({
      token,
      user: {
        id:              usuario.id,
        username:        usuario.username,
        nombre_completo: usuario.nombre_completo,
        rol:             usuario.rol,
        permisos:        usuario.permisos,
      },
    });

  } catch (err) {
    console.error('[auth.login]', err.message);
    return res.status(500).json({ message: 'Error interno al autenticar' });
  }
};

/** GET /api/v1/auth/me — valida token y devuelve perfil actualizado */
exports.me = async (req, res) => {
  try {
    const { rows: [u] } = await pool.query(
      `SELECT u.id, u.username, u.nombre_completo, r.nombre AS rol, r.permisos
       FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=$1 AND u.activo=TRUE`,
      [req.user.id]
    );
    if (!u) return res.status(401).json({ message: 'Usuario no encontrado' });
    return res.json(u);
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

/** POST /api/v1/auth/cambiar-password */
exports.cambiarPassword = async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ message: 'Ambas contraseñas son obligatorias' });
  }
  if (password_nuevo.length < 8) {
    return res.status(400).json({ message: 'La contraseña nueva debe tener al menos 8 caracteres' });
  }
  try {
    const { rows: [u] } = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]
    );
    const ok = await bcrypt.compare(password_actual, u.password_hash);
    if (!ok) return res.status(401).json({ message: 'La contraseña actual es incorrecta' });

    const nuevoHash = await bcrypt.hash(password_nuevo, 12);
    await pool.query(
      'UPDATE usuarios SET password_hash=$1, actualizado_en=NOW() WHERE id=$2',
      [nuevoHash, req.user.id]
    );
    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
};
