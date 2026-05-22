/**
 * POSManual - DevSys Honduras
 * Instancia Axios con interceptores de JWT y manejo de errores
 * Archivo: client/src/api/axios.js
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  timeout: 10000,
});

// Inyectar JWT en cada petición
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('posmanual_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Redirigir a login si token expiró
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('posmanual_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
