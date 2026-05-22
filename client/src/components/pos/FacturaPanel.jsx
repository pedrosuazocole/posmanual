/**
 * POSManual - DevSys Honduras
 * Componente: Panel derecho del POS — Factura y cobro
 * Archivo: client/src/components/pos/FacturaPanel.jsx
 *
 * Lee todo el estado del posStore (Zustand) directamente.
 * Props:
 *   onEmitir(payload) - llama la API para emitir factura
 *   emitiendo         - estado de loading de la mutación
 */
import { usePOSStore }  from '../../store/posStore';
import ItemsFactura     from './ItemsFactura';
import TotalesBox       from './TotalesBox';
import PagoBox          from './PagoBox';
import styles           from './FacturaPanel.module.css';

export default function FacturaPanel({ onEmitir, emitiendo }) {
  const {
    items, clienteNombre, clienteRtn, turno, totales,
    setCliente, metodoPago, montoRecibido, getCambio, limpiarFactura,
  } = usePOSStore();

  const puedeFacturar = items.length > 0 && !emitiendo;

  // Construye el payload para la API
  const handleEmitir = () => {
    if (!puedeFacturar) return;
    onEmitir({
      turno_id:       turno.id,
      cliente_nombre: clienteNombre || 'CONSUMIDOR FINAL',
      cliente_rtn:    clienteRtn    || '0000000',
      metodo_pago:    metodoPago,
      monto_recibido: metodoPago === 'EFECTIVO' ? +montoRecibido : totales.total,
      items: items.map(i => ({
        articulo_id:     i.artId  ?? null,  // null para manuales
        descripcion:     i.nombre,           // snapshot del nombre
        cantidad:        i.qty,
        precio_unitario: i.precio,
        descuento_unit:  0,
        impuesto_pct:    i.isv,
        manual:          i.manual,
      })),
      ...totales,
    });
  };

  // Número de factura provisional (el definitivo lo asigna el backend)
  const numProvisional = turno
    ? `FP-${turno.id.toString().padStart(3,'0')}-XXXX`
    : 'FP-000-XXXX';

  return (
    <aside className={styles.panel} aria-label="Panel de factura">

      {/* Encabezado */}
      <header className={styles.header}>
        <div>
          <div className={styles.docType}>Factura Proforma</div>
          <div className={styles.factNum}>{numProvisional}</div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.cajero}>CAJA VENTAS</div>
          <div className={styles.fecha}>{new Date().toLocaleDateString('es-HN')}</div>
        </div>
      </header>

      {/* Datos del cliente */}
      <div className={styles.clienteBar}>
        <label className={styles.clienteLabel}>Datos del cliente</label>
        <div className={styles.clienteInputs}>
          <input
            className={styles.clienteInput}
            type="text"
            placeholder="Nombre / Consumidor Final"
            value={clienteNombre}
            onChange={e => setCliente(e.target.value, clienteRtn)}
            style={{ flex: '1.5' }}
          />
          <input
            className={styles.clienteInput}
            type="text"
            placeholder="RTN"
            value={clienteRtn}
            onChange={e => setCliente(clienteNombre, e.target.value)}
            style={{ flex: '1' }}
          />
        </div>
      </div>

      {/* Lista de artículos */}
      <ItemsFactura />

      {/* Totales desglosados (ISV 15% / 18%) */}
      {items.length > 0 && <TotalesBox />}

      {/* Métodos de pago + campo recibido + cambio */}
      <PagoBox />

      {/* Botón emitir */}
      <button
        className={styles.btnFacturar}
        onClick={handleEmitir}
        disabled={!puedeFacturar}
        aria-label="Emitir factura proforma"
      >
        {emitiendo
          ? <><i className="ti ti-loader-2" aria-hidden="true" style={{animation:'spin 1s linear infinite'}} /> Emitiendo...</>
          : <><i className="ti ti-receipt" aria-hidden="true" /> EMITIR FACTURA PROFORMA</>
        }
      </button>

      <button className={styles.btnLimpiar} onClick={limpiarFactura}>
        <i className="ti ti-trash" aria-hidden="true" style={{fontSize:'11px'}} /> Limpiar factura
      </button>

    </aside>
  );
}
