// POSManual - DevSys Honduras
// Archivo: client/vite.config.js  (con sección test para Vitest)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react:   ['react','react-dom','react-router-dom'],
          query:   ['@tanstack/react-query'],
          xlsx:    ['xlsx'],
          zustand: ['zustand'],
        },
      },
    },
  },

  // ── Vitest (pruebas unitarias frontend) ──────────────────
  test: {
    environment: 'jsdom',
    globals:     true,
    include:     ['src/tests/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider:   'v8',
      reporter:   ['text','lcov','html'],
      include:    ['src/store/**','src/hooks/**','src/pages/**'],
      thresholds: { lines:70, functions:70 },
    },
  },
});
