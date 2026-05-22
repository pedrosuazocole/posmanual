/**
 * POSManual - DevSys Honduras
 * Página: Importación masiva de artículos
 * Archivo: client/src/pages/Importacion/ImportacionPage.jsx
 *
 * Flujo en 4 pasos:
 *   1. Cargar archivo  → 2. Validar datos  → 3. Previsualizar  → 4. Importar
 *
 * Dependencias: xlsx (parseo client-side), react-hot-toast → sonner, zustand
 */
import { useState, useCallback, useRef } from 'react';
import { useMutation }  from '@tanstack/react-query';
import { toast }        from 'sonner';
import * as XLSX        from 'xlsx';
import api              from '../../api/axios';
import Stepper          from '../../components/ui/Stepper';
import StepCarga        from './steps/StepCarga';
import StepValidar      from './steps/StepValidar';
import StepPrevisualizar from './steps/StepPrevisualizar';
import StepImportar     from './steps/StepImportar';
import styles           from './ImportacionPage.module.css';

// ── Mapeo de columnas Excel → esquema POSManual ──────────────
export const COLUMN_MAP = {
  codigo:      'codigo',
  grupo:       'grupo_origen',
  nombre:      'nombre',
  nombrecorto: 'nombre_corto',
  referencia:  'referencia',
  marca:       'marca',
  unidad:      'unidad_medida',
  costo:       'precio_costo',
  precio1:     'precio_venta',
  precio2:     'precio_especial',
  impuesto1:   'impuesto_pct',
  existencia:  'stock_actual',
  minimo:      'stock_minimo',
  maximo:      'stock_maximo',
  usaexist:    'no_usar_existencia',   // 2 → TRUE (servicio)
  inactiva:    'activo',               // 0 → activo=TRUE
};

// ── Validador de filas ───────────────────────────────────────
export function validarFila(row, index) {
  const errs = [];
  if (!row.codigo?.toString().trim())           errs.push('Código vacío');
  if (!row.nombre?.toString().trim())           errs.push('Nombre vacío');
  if (Number(row.precio1) < 0)                  errs.push(`Precio negativo (${row.precio1})`);
  if (![0, 15, 18].includes(Number(row.impuesto1))) errs.push(`ISV inválido (${row.impuesto1})`);
  return errs.length ? { fila: index + 2, codigo: row.codigo, nombre: row.nombre, errores: errs } : null;
}

// ── Estadísticas agregadas ────────────────────────────────────
export function calcEstadisticas(rows) {
  const errores       = rows.map(validarFila).filter(Boolean);
  const gruposUnicos  = [...new Set(rows.map(r => r.grupo).filter(Boolean))];
  return {
    total:     rows.length,
    validos:   rows.length - errores.length,
    errores:   errores.length,
    grupos:    gruposUnicos.length,
    servicios: rows.filter(r => Number(r.usaexist) === 2).length,
    isv15:     rows.filter(r => Number(r.impuesto1) === 15).length,
    isv18:     rows.filter(r => Number(r.impuesto1) === 18).length,
    exentos:   rows.filter(r => Number(r.impuesto1) === 0).length,
    listaErrores: errores,
  };
}

// ─────────────────────────────────────────────────────────────
export default function ImportacionPage() {
  const [step,     setStep]     = useState(1);
  const [rawRows,  setRawRows]  = useState([]);
  const [archivo,  setArchivo]  = useState(null);
  const [stats,    setStats]    = useState(null);
  const [resultado,setResultado]= useState(null);
  const fileRef   = useRef(null);
  const formRef   = useRef(new FormData());

  // ── Parsear Excel en el cliente ────────────────────────────
  const parsearArchivo = useCallback((file) => {
    setArchivo(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb  = XLSX.read(e.target.result, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      setRawRows(rows);
      setStats(calcEstadisticas(rows));
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Mutación de importación ────────────────────────────────
  const importarMutation = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('archivo', file);
      const { data } = await api.post('/articulos/importar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // onUploadProgress para barra del paso 4
        onUploadProgress: (evt) => {
          const pct = Math.round((evt.loaded / evt.total) * 15);
          window._importPct?.(pct); // callback desde StepImportar
        },
      });
      return data;
    },
    onSuccess: (data) => {
      setResultado(data);
      toast.success(`✅ ${data.insertados} artículos importados correctamente`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error durante la importación');
    },
  });

  const steps = [
    { label: 'Cargar archivo' },
    { label: 'Validar datos' },
    { label: 'Previsualizar' },
    { label: 'Importar' },
  ];

  return (
    <div className={styles.page}>
      <Stepper steps={steps} current={step} />

      {step === 1 && (
        <StepCarga
          onFile={parsearArchivo}
          archivo={archivo}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && stats && (
        <StepValidar
          stats={stats}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepPrevisualizar
          rows={rawRows}
          stats={stats}
          onBack={() => setStep(2)}
          onNext={() => { setStep(4); importarMutation.mutate(archivo); }}
        />
      )}

      {step === 4 && (
        <StepImportar
          stats={stats}
          resultado={resultado}
          isPending={importarMutation.isPending}
        />
      )}
    </div>
  );
}
