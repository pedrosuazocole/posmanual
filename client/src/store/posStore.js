/**
 * POSManual - DevSys Honduras
 * Store Zustand: Estado reactivo del Punto de Venta
 * Archivo: client/src/store/posStore.js
 */
import { create } from 'zustand';

// Calcula todos los totales fiscales de Honduras (ISV 15% / 18% / exento)
const calcTotales = (items) => {
  let subtotal = 0, exento = 0, gravado15 = 0, gravado18 = 0;

  items.forEach(({ precio, qty, isv }) => {
    const base = precio * qty;
    subtotal += base;
    if      (isv === 15) gravado15 += base / 1.15;  // base sin ISV
    else if (isv === 18) gravado18 += base / 1.18;
    else                 exento    += base;
  });

  return {
    subtotal:  +subtotal.toFixed(2),
    descuento: 0,
    exento:    +exento.toFixed(2),
    gravado15: +gravado15.toFixed(2),
    isv15:     +(gravado15 * 0.15).toFixed(2),
    gravado18: +gravado18.toFixed(2),
    isv18:     +(gravado18 * 0.18).toFixed(2),
    total:     +subtotal.toFixed(2),
  };
};

export const usePOSStore = create((set, get) => ({
  // ── Estado de la factura ──────────────────────────────────
  items:          [],
  clienteNombre:  'CONSUMIDOR FINAL',
  clienteRtn:     '0000000',
  metodoPago:     'EFECTIVO',
  montoRecibido:  0,
  turno:          null,        // { id, cajero, abierto_en }
  totales:        calcTotales([]),

  // ── Acciones de artículos ─────────────────────────────────

  /** Agrega artículo del catálogo. Si ya existe, incrementa cantidad */
  agregarItem: (art) => set(state => {
    const existe = state.items.find(i => i.codigo === art.codigo && !i.manual);
    const next   = existe
      ? state.items.map(i =>
          i.codigo === art.codigo && !i.manual ? { ...i, qty: i.qty + 1 } : i
        )
      : [...state.items, {
          codigo:   String(art.codigo),
          nombre:   art.nombre,
          precio:   +art.precio_venta,
          isv:      +art.impuesto_pct,
          qty:      1,
          manual:   false,
          grupoId:  art.grupo_id,
          artId:    art.id,
        }];
    return { items: next, totales: calcTotales(next) };
  }),

  /** Agrega artículo ingresado manualmente (sin código de barras) */
  agregarItemManual: ({ nombre, precio, qty = 1, isv = 15 }) =>
    set(state => {
      const next = [...state.items, {
        codigo:  'MAN-' + Date.now(),
        nombre,
        precio:  +precio,
        isv:     +isv,
        qty:     +qty,
        manual:  true,
      }];
      return { items: next, totales: calcTotales(next) };
    }),

  /** Incrementa o decrementa cantidad. Elimina si qty llega a 0 */
  cambiarQty: (codigo, delta) => set(state => {
    const next = state.items
      .map(i => i.codigo === codigo ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0);
    return { items: next, totales: calcTotales(next) };
  }),

  eliminarItem: (codigo) => set(state => {
    const next = state.items.filter(i => i.codigo !== codigo);
    return { items: next, totales: calcTotales(next) };
  }),

  // ── Acciones de pago / cliente ────────────────────────────
  setCliente:       (nombre, rtn) => set({ clienteNombre: nombre, clienteRtn: rtn }),
  setMetodoPago:    (m)           => set({ metodoPago: m }),
  setMontoRecibido: (n)           => set({ montoRecibido: +n || 0 }),
  setTurno:         (t)           => set({ turno: t }),

  // ── Computed helpers ──────────────────────────────────────
  getCambio: () => {
    const { montoRecibido, totales, metodoPago } = get();
    if (metodoPago !== 'EFECTIVO') return 0;
    return Math.max(0, +(montoRecibido - totales.total).toFixed(2));
  },

  getPendiente: () => {
    const { montoRecibido, totales, metodoPago } = get();
    if (metodoPago !== 'EFECTIVO') return 0;
    return Math.max(0, +(totales.total - montoRecibido).toFixed(2));
  },

  // ── Reset de factura ──────────────────────────────────────
  limpiarFactura: () => set({
    items:         [],
    clienteNombre: 'CONSUMIDOR FINAL',
    clienteRtn:    '0000000',
    metodoPago:    'EFECTIVO',
    montoRecibido: 0,
    totales:       calcTotales([]),
  }),
}));
