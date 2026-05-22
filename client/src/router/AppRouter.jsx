/**
 * POSManual - DevSys Honduras
 * Router completo con todas las rutas integradas y guards de rol
 * Archivo: client/src/router/AppRouter.jsx
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }    from '../auth/AuthContext';
import { ProtectedRoute }  from '../auth/ProtectedRoute';
import MainLayout          from '../layouts/MainLayout';

// Páginas
import { LoginPage }       from '../pages/Login/LoginPage';
import POSPage             from '../pages/POS/POSPage';
import TurnosPage          from '../pages/Turnos/TurnosPage';
import ArticulosPage       from '../pages/Articulos/ArticulosPage';
import ImportacionPage     from '../pages/Importacion/ImportacionPage';
import InventarioPage      from '../pages/Inventario/InventarioPage';
import ReportesPage        from '../pages/Reportes/ReportesPage';
import CuentasPage         from '../pages/Cuentas/CuentasPage';
import BancosPage          from '../pages/Bancos/BancosPage';
import UsuariosPage        from '../pages/Usuarios/UsuariosPage';
import SinAccesoPage       from '../pages/SinAcceso/SinAccesoPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protegidas — dentro del layout con sidebar */}
          <Route path="/" element={
            <ProtectedRoute><MainLayout /></ProtectedRoute>
          }>
            <Route index element={<Navigate to="/pos" replace />} />

            {/* POS — todos los roles */}
            <Route path="pos" element={
              <ProtectedRoute modulo="pos"><POSPage /></ProtectedRoute>
            } />

            {/* Turnos — todos los roles (cajero solo ve el propio) */}
            <Route path="turnos" element={
              <ProtectedRoute modulo="turnos"><TurnosPage /></ProtectedRoute>
            } />

            {/* Artículos — cajero solo lectura */}
            <Route path="articulos" element={
              <ProtectedRoute modulo="articulos"><ArticulosPage /></ProtectedRoute>
            } />
            <Route path="articulos/importar" element={
              <ProtectedRoute modulo="articulos" accion="importar"
                roles={['ADMINISTRADOR','SUPERVISOR']}>
                <ImportacionPage />
              </ProtectedRoute>
            } />

            {/* Inventario — Admin y Supervisor */}
            <Route path="inventario" element={
              <ProtectedRoute modulo="inventario"
                roles={['ADMINISTRADOR','SUPERVISOR']}>
                <InventarioPage />
              </ProtectedRoute>
            } />

            {/* Reportes — Admin y Supervisor */}
            <Route path="reportes" element={
              <ProtectedRoute modulo="reportes"
                roles={['ADMINISTRADOR','SUPERVISOR']}>
                <ReportesPage />
              </ProtectedRoute>
            } />

            {/* Cuentas por Cobrar/Pagar — Admin y Supervisor */}
            <Route path="cuentas" element={
              <ProtectedRoute modulo="cuentas"
                roles={['ADMINISTRADOR','SUPERVISOR']}>
                <CuentasPage />
              </ProtectedRoute>
            } />

            {/* Bancos — Admin y Supervisor */}
            <Route path="bancos" element={
              <ProtectedRoute modulo="bancos"
                roles={['ADMINISTRADOR','SUPERVISOR']}>
                <BancosPage />
              </ProtectedRoute>
            } />

            {/* Usuarios — solo Admin */}
            <Route path="usuarios" element={
              <ProtectedRoute modulo="usuarios"
                roles={['ADMINISTRADOR']}>
                <UsuariosPage />
              </ProtectedRoute>
            } />

            {/* Sin acceso */}
            <Route path="sin-acceso" element={<SinAccesoPage />} />

            {/* 404 → POS */}
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
