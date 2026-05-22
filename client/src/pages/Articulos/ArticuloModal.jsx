/**
 * POSManual - DevSys Honduras
 * Modal: Crear / Editar artículo
 * Archivo: client/src/pages/Articulos/ArticuloModal.jsx
 *
 * Campo crítico: toggle "No usar existencia"
 *   - Activo  → campos de stock deshabilitados (servicio, combustible, combo)
 *   - Inactivo → campos de stock habilitados (producto físico con inventario)
 */
import { useState } from 'react';
import styles from './ArticuloModal.module.css';

const ISV_OPTIONS = [
  { value: 0,  label: '0% — Exento' },
  { value: 15, label: '15% — ISV estándar' },
  { value: 18, label: '18% — Bebidas alcohólicas' },
];

export default function ArticuloModal({ articulo, grupos, onSave, onClose, saving }) {
  const isEdit = Boolean(articulo?.id);

  const [form, setForm] = useState({
    id:                 articulo?.id             ?? undefined,
    codigo:             articulo?.codigo          ?? '',
    nombre:             articulo?.nombre          ?? '',
    nombre_corto:       articulo?.nombre_corto    ?? '',
    grupo_id:           articulo?.grupo_id        ?? '',
    unidad_medida:      articulo?.unidad_medida   ?? 'UNIDAD',
    referencia:         articulo?.referencia      ?? '',
    marca:              articulo?.marca           ?? '',
    precio_costo:       articulo?.precio_costo    ?? 0,
    precio_venta:       articulo?.precio_venta    ?? 0,
    precio_especial:    articulo?.precio_especial ?? 0,
    impuesto_pct:       articulo?.impuesto_pct    ?? 15,
    stock_actual:       articulo?.stock_actual    ?? 0,
    stock_minimo:       articulo?.stock_minimo    ?? 0,
    stock_maximo:       articulo?.stock_maximo    ?? 0,
    no_usar_existencia: articulo?.no_usar_existencia ?? false,
    activo:             articulo?.activo          ?? true,
  });

  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Cuando se activa el toggle, limpia los valores de stock
  const handleToggleServicio = (checked) => {
    set('no_usar_existencia', checked);
    if (checked) {
      set('stock_actual', 0);
      set('stock_minimo', 0);
      set('stock_maximo', 0);
    }
  };

  const validar = () => {
    const e = {};
    if (!form.codigo.trim())        e.codigo  = 'El código es obligatorio';
    if (!form.nombre.trim())        e.nombre  = 'El nombre es obligatorio';
    if (form.precio_venta < 0)      e.precio_venta = 'El precio no puede ser negativo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validar()) return;
    onSave({
      ...form,
      codigo:          form.codigo.trim(),
      nombre:          form.nombre.trim(),
      nombre_corto:    form.nombre_corto.trim() || null,
      grupo_id:        form.grupo_id || null,
      referencia:      form.referencia.trim() || null,
      marca:           form.marca.trim() || null,
      precio_costo:    +form.precio_costo,
      precio_venta:    +form.precio_venta,
      precio_especial: +form.precio_especial,
      impuesto_pct:    +form.impuesto_pct,
      stock_actual:    form.no_usar_existencia ? 0 : +form.stock_actual,
      stock_minimo:    form.no_usar_existencia ? 0 : +form.stock_minimo,
      stock_maximo:    form.no_usar_existencia ? 0 : +form.stock_maximo,
    });
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={isEdit ? 'Editar artículo' : 'Nuevo artículo'}>
      <div className={styles.modal}>
        <div className={styles.head}>
          <h3>{isEdit ? 'Editar artículo' : 'Nuevo artículo'}</h3>
          <button onClick={onClose} className={styles.btnClose} aria-label="Cerrar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>

          {/* ── IDENTIFICACIÓN ─────────────────────────────── */}
          <div className={styles.sectionLabel}>Identificación</div>

          <div className={styles.gridTwo}>
            <Field label="Código *" error={errors.codigo}>
              <input value={form.codigo} onChange={e => set('codigo', e.target.value)}
                placeholder="Ej: 1234567890" disabled={isEdit} />
            </Field>
            <Field label="Grupo">
              <select value={form.grupo_id} onChange={e => set('grupo_id', e.target.value)}>
                <option value="">Sin grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Nombre *" error={errors.nombre}>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre completo del artículo" />
          </Field>

          <div className={styles.gridTwo}>
            <Field label="Nombre corto">
              <input value={form.nombre_corto} onChange={e => set('nombre_corto', e.target.value)}
                placeholder="Para pantallas pequeñas" />
            </Field>
            <Field label="Unidad de medida">
              <input value={form.unidad_medida} onChange={e => set('unidad_medida', e.target.value)} />
            </Field>
            <Field label="Referencia">
              <input value={form.referencia} onChange={e => set('referencia', e.target.value)} />
            </Field>
            <Field label="Marca">
              <input value={form.marca} onChange={e => set('marca', e.target.value)} />
            </Field>
          </div>

          {/* ── PRECIOS ───────────────────────────────────── */}
          <div className={styles.sectionLabel} style={{ marginTop: 12 }}>Precios e impuestos</div>

          <div className={styles.gridThree}>
            <Field label="Precio de costo (L.)">
              <input type="number" min="0" step="0.01" value={form.precio_costo}
                onChange={e => set('precio_costo', e.target.value)} />
            </Field>
            <Field label="Precio de venta (L.) *" error={errors.precio_venta}>
              <input type="number" min="0" step="0.01" value={form.precio_venta}
                onChange={e => set('precio_venta', e.target.value)} />
            </Field>
            <Field label="Precio especial / mayoreo">
              <input type="number" min="0" step="0.01" value={form.precio_especial}
                onChange={e => set('precio_especial', e.target.value)} />
            </Field>
            <Field label="ISV (%)">
              <select value={form.impuesto_pct} onChange={e => set('impuesto_pct', +e.target.value)}>
                {ISV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          {/* ── TOGGLE: NO USAR EXISTENCIA ─────────────────── */}
          <div className={styles.toggleCard}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>
                <i className="ti ti-toggle-right" style={{ marginRight: 6, fontSize: 16, verticalAlign: -2 }} aria-hidden="true" />
                No usar existencia
              </span>
              <span className={styles.toggleDesc}>
                Activá para servicios, combustibles, combos o productos facturados manualmente sin
                descuento de inventario. Al activar, los campos de stock quedan bloqueados.
              </span>
            </div>
            <label className={styles.toggle} aria-label="No usar existencia">
              <input
                type="checkbox"
                checked={form.no_usar_existencia}
                onChange={e => handleToggleServicio(e.target.checked)}
              />
              <div className={styles.track} />
              <div className={styles.thumb} />
            </label>
          </div>

          {/* ── STOCK (deshabilitado si es servicio) ─────── */}
          <div className={styles.sectionLabel} style={{ marginTop: 12 }}>
            Inventario
            {form.no_usar_existencia && (
              <span className={styles.badgeServ}>No aplica — artículo de servicio</span>
            )}
          </div>

          <div className={styles.gridThree}>
            <Field label="Stock actual">
              <input type="number" min="0" step="1"
                value={form.stock_actual}
                onChange={e => set('stock_actual', e.target.value)}
                disabled={form.no_usar_existencia} />
            </Field>
            <Field label="Stock mínimo">
              <input type="number" min="0" step="1"
                value={form.stock_minimo}
                onChange={e => set('stock_minimo', e.target.value)}
                disabled={form.no_usar_existencia} />
            </Field>
            <Field label="Stock máximo">
              <input type="number" min="0" step="1"
                value={form.stock_maximo}
                onChange={e => set('stock_maximo', e.target.value)}
                disabled={form.no_usar_existencia} />
            </Field>
          </div>

        </div>

        <div className={styles.foot}>
          <button onClick={onClose} className={styles.btnSec}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className={styles.btnPrim}>
            {saving
              ? <><i className="ti ti-loader-2" aria-hidden="true" /> Guardando...</>
              : <><i className="ti ti-device-floppy" aria-hidden="true" /> {isEdit ? 'Actualizar' : 'Crear artículo'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.3px' }}>
        {label}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--color-text-danger)' }}>{error}</span>}
    </div>
  );
}
