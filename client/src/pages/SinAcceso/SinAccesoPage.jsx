/**
 * POSManual - DevSys Honduras
 * Página: Sin acceso (403)
 * Archivo: client/src/pages/SinAcceso/SinAccesoPage.jsx
 */
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../../auth/AuthContext';

export default function SinAccesoPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();

  return (
    <div style={{textAlign:'center', padding:'60px 20px'}}>
      <i className="ti ti-lock" style={{fontSize:48, color:'var(--color-text-tertiary)', display:'block', marginBottom:16}} aria-hidden="true" />
      <h2 style={{fontSize:20, fontWeight:500, marginBottom:8}}>Acceso denegado</h2>
      <p style={{color:'var(--color-text-secondary)', fontSize:14, marginBottom:24}}>
        Tu rol <strong>{user?.rol}</strong> no tiene permiso para acceder a esta sección.
      </p>
      <button
        onClick={() => navigate('/pos')}
        style={{background:'#1B4F9B', color:'#fff', border:'none', padding:'10px 24px', borderRadius:'var(--border-radius-md)', fontSize:13, fontWeight:500, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6}}
      >
        <i className="ti ti-arrow-left" aria-hidden="true" /> Volver al POS
      </button>
    </div>
  );
}

/**
 * ─────────────────────────────────────────────────────────────
 * Archivo: client/src/main.jsx  (entry point de React)
 */
// import React        from 'react';
// import ReactDOM     from 'react-dom/client';
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { Toaster }  from 'sonner';
// import AppRouter    from './router/AppRouter';
// import './index.css';
//
// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       retry: 1,
//       staleTime: 30_000,
//       refetchOnWindowFocus: false,  // evita refetch innecesario en HN con conectividad intermitente
//     },
//   },
// });
//
// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <QueryClientProvider client={queryClient}>
//       <AppRouter />
//       <Toaster
//         position="top-right"
//         richColors
//         closeButton
//         toastOptions={{ duration: 3000 }}
//       />
//     </QueryClientProvider>
//   </React.StrictMode>
// );
