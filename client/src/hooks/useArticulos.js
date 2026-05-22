/**
 * POSManual - DevSys Honduras
 * Hooks de React Query: artículos y grupos del catálogo
 * Archivo: client/src/hooks/useArticulos.js
 */
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

/** Busca artículos con filtro de texto y/o grupo */
export function useArticulos({ search = '', grupoId = null } = {}) {
  return useQuery({
    queryKey: ['articulos', { search, grupoId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search)  params.set('q',        search.trim());
      if (grupoId) params.set('grupo_id', grupoId);
      const { data } = await api.get(`/articulos?${params}`);
      return data; // [{ id, codigo, nombre, precio_venta, impuesto_pct, ... }]
    },
    staleTime:        5 * 60 * 1000,  // catálogo estable 5 min
    placeholderData:  [],
  });
}

/** Carga todos los grupos activos (chips de filtro) */
export function useGrupos() {
  return useQuery({
    queryKey: ['grupos'],
    queryFn: async () => {
      const { data } = await api.get('/grupos?activo=true');
      return data; // [{ id, nombre, codigo_origen }]
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Busca artículo por código de barras exacto */
export function useBuscarPorCodigo(codigo) {
  return useQuery({
    queryKey: ['articulo-barcode', codigo],
    queryFn: async () => {
      const { data } = await api.get(`/articulos/codigo/${encodeURIComponent(codigo)}`);
      return data;
    },
    enabled: Boolean(codigo && codigo.length >= 3),
    retry:   false,
  });
}
