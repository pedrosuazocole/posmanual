/**
 * POSManual - DevSys Honduras
 * Componente: Panel izquierdo del POS — Catálogo de artículos
 * Archivo: client/src/components/pos/CatalogoPanel.jsx
 *
 * Props:
 *   articulos[]     - lista del hook useArticulos
 *   grupos[]        - lista del hook useGrupos
 *   grupoActivo     - ID del grupo seleccionado (null = todos)
 *   onGrupo(id)     - cambia filtro de grupo
 *   onSearch(str)   - cambia texto de búsqueda
 *   onAgregarItem   - callback al hacer clic en una tarjeta
 *   onManual()      - abre modal de ingreso manual
 *   loading         - muestra skeleton si es true
 */
import { useRef, useEffect } from 'react';
import styles from './CatalogoPanel.module.css';

export default function CatalogoPanel({
  articulos = [], grupos = [], grupoActivo, onGrupo,
  onSearch, onAgregarItem, onManual, loading,
}) {
  const searchRef = useRef(null);

  // Atajos de teclado: F2 enfoca búsqueda
  useEffect(() => {
    const handler = (e) => { if (e.key === 'F2') searchRef.current?.focus(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <section className={styles.catalogo} aria-label="Catálogo de artículos">

      {/* Barra de búsqueda */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <i className="ti ti-search" aria-hidden="true" />
          <input
            ref={searchRef}
            className={styles.searchInput}
            type="text"
            placeholder="Buscar por nombre o código... (F2)"
            onChange={e => onSearch(e.target.value)}
            autoComplete="off"
            aria-label="Buscar artículos"
          />
        </div>
        <button className={styles.btnManual} onClick={onManual} aria-label="Ingreso manual">
          <i className="ti ti-edit" aria-hidden="true" /> Manual
        </button>
      </div>

      {/* Chips de grupos */}
      <nav className={styles.gruposBar} aria-label="Filtrar por grupo">
        <button
          className={`${styles.chip} ${!grupoActivo ? styles.chipActive : ''}`}
          onClick={() => onGrupo(null)}
        >
          Todos
        </button>
        {grupos.map(g => (
          <button
            key={g.id}
            className={`${styles.chip} ${grupoActivo === g.id ? styles.chipActive : ''}`}
            onClick={() => onGrupo(g.id)}
          >
            {g.nombre}
          </button>
        ))}
      </nav>

      {/* Grid de artículos */}
      <div className={styles.artGrid} role="list">
        {loading ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`${styles.artCard} ${styles.skeleton}`} />
          ))
        ) : articulos.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="ti ti-mood-empty" aria-hidden="true" />
            <p>No se encontraron artículos</p>
          </div>
        ) : (
          articulos.map(art => (
            <ArticuloCard
              key={art.id}
              art={art}
              onClick={() => onAgregarItem(art)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function ArticuloCard({ art, onClick }) {
  const sinPrecio  = !art.precio_venta || art.precio_venta === 0;
  const sinStock   = !art.no_usar_existencia && art.stock_actual <= 0;
  const esServicio = art.no_usar_existencia;

  return (
    <article
      className={`${styles.artCard} ${sinStock ? styles.sinStock : ''}`}
      onClick={onClick}
      role="listitem"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`${art.nombre}, precio L. ${art.precio_venta?.toFixed(2) ?? 'consultar'}`}
    >
      <div className={styles.artNombre}>{art.nombre}</div>
      <div className={styles.artCodigo}>{art.codigo}</div>
      <div className={styles.artPrecio}>
        {sinPrecio ? '— consultar —' : `L. ${art.precio_venta.toFixed(2)}`}
      </div>
      <div className={styles.artBadges}>
        {art.impuesto_pct > 0
          ? <span className={`${styles.badge} ${styles.badgeIsv}`}>ISV {art.impuesto_pct}%</span>
          : <span className={`${styles.badge} ${styles.badgeExento}`}>Exento</span>
        }
        {esServicio && (
          <span className={`${styles.badge} ${styles.badgeServ}`}>Servicio</span>
        )}
        {!esServicio && art.stock_actual > 0 && (
          <span className={`${styles.badge} ${styles.badgeStock}`}>
            Stock: {art.stock_actual}
          </span>
        )}
        {sinStock && !esServicio && (
          <span className={`${styles.badge} ${styles.badgeNoStock}`}>Sin stock</span>
        )}
      </div>
    </article>
  );
}
