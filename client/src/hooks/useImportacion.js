/**
 * POSManual - DevSys Honduras
 * Hook: useImportacion — orquesta todo el flujo de importación
 * Archivo: client/src/hooks/useImportacion.js
 *
 * Responsabilidades:
 *   - Parsear el Excel en el cliente (sin enviar al servidor aún)
 *   - Validar filas y calcular estadísticas
 *   - Ejecutar el UPSERT masivo vía POST /articulos/importar
 *   - Reportar progreso en tiempo real
 */
import { useState, useCallback } from 'react';
import { useMutation }           from '@tanstack/react-query';
import * as XLSX                 from 'xlsx';
import api                       from '../api/axios';

// ── Validación de una fila del Excel ──────────────────────────
export function validarFila(row, index) {
  const errs = [];
  if (!row.codigo?.toString().trim()) errs.push('Código vacío');
  if (!row.nombre?.toString().trim()) errs.push('Nombre vacío');
  if (Number(row.precio1) < 0)        errs.push(`Precio negativo (${row.precio1})`);
  if (![undefined, null, 0, 15, 18].includes(Number(row.impuesto1)))
    errs.push(`ISV inválido (${row.impuesto1})`);
  return errs.length ? { fila: index + 2, codigo: row.codigo, nombre: row.nombre, errores: errs } : null;
}

// ── Estadísticas del catálogo completo ────────────────────────
export function calcularEstadisticas(rows) {
  const listaErrores = rows.map(validarFila).filter(Boolean);
  return {
    total:    rows.length,
    validos:  rows.length - listaErrores.length,
    errores:  listaErrores.length,
    grupos:   [...new Set(rows.map(r => r.grupo).filter(Boolean))].length,
    servicios:rows.filter(r => Number(r.usaexist) === 2).length,
    isv15:    rows.filter(r => Number(r.impuesto1) === 15).length,
    isv18:    rows.filter(r => Number(r.impuesto1) === 18).length,
    exentos:  rows.filter(r => Number(r.impuesto1) === 0).length,
    listaErrores,
  };
}

// ─────────────────────────────────────────────────────────────
export function useImportacion() {
  const [step,      setStep]      = useState(1);         // 1..4
  const [archivo,   setArchivo]   = useState(null);      // File
  const [rawRows,   setRawRows]   = useState([]);        // filas del Excel
  const [stats,     setStats]     = useState(null);      // calcularEstadisticas()
  const [resultado, setResultado] = useState(null);      // respuesta del servidor
  const [uploadPct, setUploadPct] = useState(0);         // 0-100

  // ── Paso 1: parsear Excel en el cliente ────────────────────
  const cargarArchivo = useCallback((file) => {
    setArchivo(file);
    setResultado(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb   = XLSX.read(e.target.result, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
      setRawRows(rows);
      setStats(calcularEstadisticas(rows));
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Pasos 2-3: navegar ─────────────────────────────────────
  const irPaso = useCallback((n) => setStep(n), []);

  // ── Paso 4: enviar al servidor ─────────────────────────────
  const importarMutation = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData();
      fd.append('archivo', file);
      const { data } = await api.post('/articulos/importar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          // El upload ocupa el 15% inicial de la barra
          const pct = Math.round((evt.loaded / (evt.total || 1)) * 15);
          setUploadPct(pct);
        },
      });
      return data;
    },
    onSuccess: (data) => {
      setResultado(data);
      setUploadPct(100);
    },
    onError: () => {
      setUploadPct(0);
    },
  });

  const iniciarImportacion = useCallback(() => {
    setStep(4);
    setUploadPct(0);
    importarMutation.mutate(archivo);
  }, [archivo, importarMutation]);

  // ── Exportar errores a Excel ───────────────────────────────
  const exportarErrores = useCallback(() => {
    if (!stats?.listaErrores?.length) return;
    const ws = XLSX.utils.json_to_sheet(stats.listaErrores.map(e => ({
      Fila:    e.fila,
      Codigo:  e.codigo  || '',
      Nombre:  e.nombre  || '',
      Errores: e.errores.join('; '),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Errores');
    XLSX.writeFile(wb, 'errores_importacion.xlsx');
  }, [stats]);

  // ── Exportar reporte de resultado ─────────────────────────
  const exportarReporte = useCallback(() => {
    if (!resultado) return;
    const datos = [
      ['Reporte de importación — POSManual DevSys Honduras'],
      ['Fecha', new Date().toLocaleDateString('es-HN')],
      [],
      ['Artículos nuevos',       resultado.insertados],
      ['Artículos actualizados', resultado.actualizados],
      ['Errores omitidos',       stats.errores],
      ['Grupos creados',         stats.grupos],
      ['ISV 15%',                stats.isv15],
      ['ISV 18%',                stats.isv18],
      ['Exentos',                stats.exentos],
      ['Servicios (sin stock)',   stats.servicios],
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, 'reporte_importacion.xlsx');
  }, [resultado, stats]);

  return {
    step, irPaso,
    archivo, cargarArchivo,
    rawRows, stats,
    resultado,
    uploadPct,
    isPending:  importarMutation.isPending,
    isError:    importarMutation.isError,
    errorMsg:   importarMutation.error?.response?.data?.message,
    iniciarImportacion,
    exportarErrores,
    exportarReporte,
  };
}
