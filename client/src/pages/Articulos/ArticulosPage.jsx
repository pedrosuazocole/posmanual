/**
 * POSManual - DevSys Honduras
 * Página: Gestión de Artículos — CRUD completo
 * Archivo: client/src/pages/Articulos/ArticulosPage.jsx
 *
 * Funciones:
 *  - Listado paginado con búsqueda, filtros por grupo/ISV/tipo/estado
 *  - Ordenamiento por columna
 *  - Modal de crear / editar con toggle "No usar existencia"
 *  - Desactivar (soft delete) con confirmación
 *  - Exportar Excel del listado filtrado
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast }   from 'sonner';
import * as XLSX   from 'xlsx';
import api         from '../../api/axios';
import ArticuloModal from './ArticuloModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import styles      from './ArticulosPage.module.css';

const PAGE_SIZE = 25;

export default function ArticulosPage() {
  const qc = useQueryClient();

  // Filtros
  const [search,    setSearch]    = useState('');
  const [grupoId,   setGrupoId]   = useState('');
  const [isvFil,    setIsvFil]    = useState('');
  const [tipoFil,   setTipoFil]   = useState('');
  const [estadoFil, setEstadoFil] = useState('true');
  const [sortCol,   setSortCol]   = useState('nombre');
  const [sortAsc,   setSortAsc]   = useState(true);
  const [page,      setPage]      = useState(1);

  // UI state
  const [modalArt,   setModalArt]   = useState(null); // null | {} | artículo existente
  const [confirmArt, setConfirmArt] = useState(null);

  // ── Datos ─────────────────────────────────────────────────
  const { data: grupos = [] } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => api.get('/grupos?activo=true').then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['articulos', { search, grupoId, isvFil, tipoFil, estadoFil, sortCol, sortAsc, page }],
    queryFn: () => {
      const p = new URLSearchParams({
        q:        search,
        grupo_id: grupoId,
        isv:      isvFil,
        tipo:     tipoFil,
        activo:   estadoFil,
        sort:     sortCol,
        dir:      sortAsc ? 'asc' : 'desc',
        page,
        limit:    PAGE_SIZE,
      });
      return api.get(`/articulos?${p}`).then(r => r.data);
    },
    placeholderData: { data: [], total: 0 },
    keepPreviousData: true,
  });

  const articulos = data?.data  ?? [];
  const totalRows = data?.total ?? 0;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;

  // ── Mutaciones ────────────────────────────────────────────
  const guardarMut = useMutation({
    mutationFn: (art) =>
      art.id
        ? api.put(`/articulos/${art.id}`, art).then(r => r.data)
        : api.post('/articulos', art).then(r => r.data),
    onSuccess: (_, art) => {
      qc.invalidateQueries(['articulos']);
      toast.success(art.id ? 'Artículo actualizado' : 'Artículo creado');
      setModalArt(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const toggleActivoMut = useMutation({
    mutationFn: (art) =>
      api.put(`/articulos/${art.id}`, { activo: !art.activo }).then(r => r.data),
    onSuccess: (_, art) => {
      qc.invalidateQueries(['articulos']);
      toast.success(art.activo ? 'Artículo desactivado' : 'Artículo reactivado');
      setConfirmArt(null);
    },
    onError: () => toast.error('Error al cambiar estado'),
  });

  // ── Exportar ──────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    const { data: all } = await api.get(
      `/articulos?q=${search}&grupo_id=${grupoId}&activo=${estadoFil}&limit=9999`
    );
    const rows = all.data.map(a => ({
      Código:            a.codigo,
      Nombre:            a.nombre,
      Grupo:             a.grupo_nombre || '',
      'P. Venta':        a.precio_venta,
      'P. Costo':        a.precio_costo,
      'ISV %':           a.impuesto_pct,
      Tipo:              a.no_usar_existencia ? 'Servicio' : 'Inventario',
      Stock:             a.no_usar_existencia ? '' : a.stock_actual,
      'Stock mín.':      a.stock_minimo,
      Estado:            a.activo ? 'Activo' : 'Inactivo',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [14,30,22,10,10,6,12,8,8,8].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Artículos');
    XLSX.writeFile(wb, 'catalogo_posmanual.xlsx');
    toast.success('Catálogo exportado');
  }, [search, grupoId, estadoFil]);

  // ── Cambio de orden ───────────────────────────────────────
  const handleSort = (col) => {
    setSortAsc(prev => sortCol === col ? !prev : true);
    setSortCol(col);
    setPage(1);
  };

  return (
    <div className={styles.page}>
      {/* Barra de herramientas */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            type="text" placeholder="Buscar por nombre o código..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select value={grupoId} onChange={e => { setGrupoId(e.target.value); setPage(1); }}>
          <option value="">Todos los grupos</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
        <select value={isvFil} onChange={e => { setIsvFil(e.target.value); setPage(1); }}>
          <option value="">Todos ISV</option>
          <option value="0">Exento</option>
          <option value="15">ISV 15%</option>
          <option value="18">ISV 18%</option>
        </select>
        <select value={tipoFil} onChange={e => { setTipoFil(e.target.value); setPage(1); }}>
          <option value="">Todos los tipos</option>
          <option value="inv">Inventario</option>
          <option value="srv">Servicio (sin stock)</option>
        </select>
        <select value={estadoFil} onChange={e => { setEstadoFil(e.target.value); setPage(1); }}>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
          <option value="">Todos</option>
        </select>
        <button onClick={exportarExcel} className={styles.btnSec}>
          <i className="ti ti-download" aria-hidden="true" /> Exportar
        </button>
        <button onClick={() => setModalArt({})} className={styles.btnPrim}>
          <i className="ti ti-plus" aria-hidden="true" /> Nuevo artículo
        </button>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrap}>
        <table>
          <colgroup>
            <col style={{ width: 100 }} /><col style={{ width: 220 }} />
            <col style={{ width: 100 }} /><col style={{ width: 90 }} />
            <col style={{ width: 90 }} /><col style={{ width: 60 }} />
            <col style={{ width: 80 }} /><col style={{ width: 70 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              {[
                ['codigo','Código'],['nombre','Nombre'],['grupo_nombre','Grupo'],
                ['precio_venta','P. Venta'],['precio_costo','P. Costo'],
              ].map(([col, label]) => (
                <th key={col} onClick={() => handleSort(col)}
                  className={sortCol === col ? (sortAsc ? styles.sortAsc : styles.sortDesc) : ''}>
                  {label}
                </th>
              ))}
              <th>ISV</th><th>Tipo</th>
              <th onClick={() => handleSort('stock_actual')}
                className={sortCol === 'stock_actual' ? (sortAsc ? styles.sortAsc : styles.sortDesc) : ''}>
                Stock
              </th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={9} className={styles.skeleton} /></tr>
              ))
            ) : articulos.length === 0 ? (
              <tr><td colSpan={9} className={styles.empty}>
                <i className="ti ti-mood-empty" aria-hidden="true" />
                No se encontraron artículos
              </td></tr>
            ) : articulos.map(art => (
              <tr key={art.id} className={!art.activo ? styles.rowInactivo : ''}>
                <td className={styles.mono}>{art.codigo}</td>
                <td className={styles.nombre}>
                  {art.nombre}
                  {!art.activo && <span className={`${styles.badge} ${styles.bGray}`}>inactivo</span>}
                </td>
                <td className={styles.muted}>{art.grupo_nombre || '—'}</td>
                <td className={styles.precio}>L.{art.precio_venta.toFixed(2)}</td>
                <td className={`${styles.precio} ${styles.muted}`}>L.{art.precio_costo.toFixed(2)}</td>
                <td>
                  {art.impuesto_pct === 0 && <span className={`${styles.badge} ${styles.bOk}`}>Exento</span>}
                  {art.impuesto_pct === 15 && <span className={`${styles.badge} ${styles.bWa}`}>15%</span>}
                  {art.impuesto_pct === 18 && <span className={`${styles.badge} ${styles.bEr}`}>18%</span>}
                </td>
                <td>
                  {art.no_usar_existencia
                    ? <span className={`${styles.badge} ${styles.bPu}`}>Servicio</span>
                    : <span className={`${styles.badge} ${styles.bIn}`}>Inventario</span>
                  }
                </td>
                <td className={styles.stock}>
                  {art.no_usar_existencia ? <span className={styles.muted}>—</span>
                    : art.stock_actual <= art.stock_minimo
                      ? <span className={styles.stockBajo}>{art.stock_actual}</span>
                      : art.stock_actual
                  }
                </td>
                <td className={styles.acciones}>
                  <button onClick={() => setModalArt(art)} className={styles.btnIco} aria-label="Editar">
                    <i className="ti ti-edit" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setConfirmArt(art)}
                    className={`${styles.btnIco} ${art.activo ? styles.btnDel : ''}`}
                    aria-label={art.activo ? 'Desactivar' : 'Reactivar'}
                  >
                    <i className={`ti ti-${art.activo ? 'trash' : 'refresh'}`} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginación */}
        <div className={styles.pager}>
          <span>
            {Math.min((page-1)*PAGE_SIZE+1, totalRows)}–{Math.min(page*PAGE_SIZE, totalRows)} de {totalRows}
          </span>
          <div className={styles.pagerBtns}>
            <button onClick={() => setPage(p => p-1)} disabled={page <= 1}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <button key={n} onClick={() => setPage(n)} className={n === page ? styles.pageActive : ''}>
                  {n}
                </button>
              );
            })}
            <button onClick={() => setPage(p => p+1)} disabled={page >= totalPages}>›</button>
          </div>
        </div>
      </div>

      {/* Modal crear/editar */}
      {modalArt !== null && (
        <ArticuloModal
          articulo={modalArt}
          grupos={grupos}
          onSave={(data) => guardarMut.mutate(data)}
          onClose={() => setModalArt(null)}
          saving={guardarMut.isPending}
        />
      )}

      {/* Confirmación de desactivar */}
      {confirmArt && (
        <ConfirmDialog
          title={confirmArt.activo ? 'Desactivar artículo' : 'Reactivar artículo'}
          message={`¿${confirmArt.activo ? 'Desactivar' : 'Reactivar'} "${confirmArt.nombre}"?`}
          confirmLabel={confirmArt.activo ? 'Desactivar' : 'Reactivar'}
          danger={confirmArt.activo}
          onConfirm={() => toggleActivoMut.mutate(confirmArt)}
          onCancel={() => setConfirmArt(null)}
        />
      )}
    </div>
  );
}
