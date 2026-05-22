/**
 * POSManual - DevSys Honduras
 * Entry point de React
 * Archivo: client/src/main.jsx
 */
import React        from 'react';
import ReactDOM     from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster }  from 'sonner';
import AppRouter    from './router/AppRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ duration: 3000 }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
