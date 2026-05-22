/**
 * POSManual - DevSys Honduras
 * Paso 1: Cargar archivo Excel
 * Archivo: client/src/pages/Importacion/steps/StepCarga.jsx
 */
import { useState, useRef } from 'react';
import { COLUMN_MAP }       from '../ImportacionPage';
import styles               from './StepCarga.module.css';

const FORMATOS = ['.xlsx', '.xls', '.csv'];

const MAPEO_VISIBLE = [
  { origen: 'codigo',     destino: 'codigo' },
  { origen: 'nombre',     destino: 'nombre' },
  { origen: 'grupo',      destino: 'grupo_id  (auto-crea si no existe)' },
  { origen: 'precio1',    destino: 'precio_venta' },
  { origen: 'costo',      destino: 'precio_costo' },
  { origen: 'impuesto1',  destino: 'impuesto_pct  (0 / 15 / 18)' },
  { origen: 'usaexist',   destino: 'no_usar_existencia  (2 = servicio)' },
  { origen: 'existencia', destino: 'stock_actual' },
  { origen: 'inactiva',   destino: 'activo  (invertido)' },
];

export default function StepCarga({ onFile, archivo, onNext }) {
  const [dragging, setDragging] = useState(false);
  const inputRef  = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const handleDrag = (e, over) => {
    e.preventDefault();
    setDragging(over);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <i className="ti ti-file-spreadsheet" aria-hidden="true" /> Seleccionar archivo
        </h3>

        {/* Drop zone */}
        <div
          className={`${styles.dz} ${dragging ? styles.drag : ''} ${archivo ? styles.done : ''}`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => handleDrag(e, true)}
          onDragLeave={e => handleDrag(e, false)}
          role="button"
          tabIndex={0}
          aria-label="Cargar archivo de artículos"
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
        >
          <i className={archivo ? 'ti ti-file-check' : 'ti ti-upload'} aria-hidden="true" />

          {archivo ? (
            <>
              <p className={styles.dzNombre}>{archivo.name}</p>
              <small>{(archivo.size / 1024).toFixed(0)} KB — listo para validar</small>
            </>
          ) : (
            <>
              <p>Arrastrá el archivo o hacé clic para seleccionar</p>
              <small>articulo.xlsx · Máx. 10 MB · ~2 000 filas</small>
            </>
          )}

          <div className={styles.dzFormatos}>
            {FORMATOS.map(f => <span key={f} className={styles.formato}>{f}</span>)}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={e => onFile(e.target.files[0])}
        />

        {/* Mapeo de columnas */}
        <div className={styles.seccion}>Mapeo de columnas del sistema legado</div>
        <div className={styles.mapeoGrid}>
          {MAPEO_VISIBLE.map(({ origen, destino }) => (
            <div key={origen} className={styles.mapeoFila}>
              <div className={styles.mapeoOrig}>{origen}</div>
              <i className="ti ti-arrow-right" style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }} aria-hidden="true" />
              <div className={styles.mapeoDest}>{destino}</div>
            </div>
          ))}
        </div>

        <div className={styles.btnRow}>
          <button className={styles.btnDl} onClick={descargarPlantilla}>
            <i className="ti ti-download" aria-hidden="true" /> Descargar plantilla
          </button>
          <div style={{ flex: 1 }} />
          <button
            className={styles.btnPrimario}
            disabled={!archivo}
            onClick={onNext}
          >
            <i className="ti ti-check" aria-hidden="true" /> Validar archivo
          </button>
        </div>
      </div>
    </div>
  );
}

// Genera y descarga plantilla Excel con estructura correcta
function descargarPlantilla() {
  const XLSX = window.XLSX || require('xlsx');
  const datos = [
    Object.keys({
      codigo:1, nombre:1, grupo:1, unidad:1, costo:1, precio1:1,
      precio2:1, impuesto1:1, existencia:1, minimo:1, maximo:1,
      usaexist:1, inactiva:1, nombrecorto:1, referencia:1, marca:1,
    }),
    ['1001','EJEMPLO PRODUCTO',4,'UNIDAD',15,25,22,15,100,10,500,1,0,'Ej. corto','REF-001','Marca'],
    ['SRV-001','SERVICIO SIN STOCK',50,'SERVICIO',0,50,0,0,0,0,0,2,0,'','',''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws['!cols'] = datos[0].map(() => ({ wch: 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Artículos');
  XLSX.writeFile(wb, 'plantilla_articulos_posmanual.xlsx');
}
