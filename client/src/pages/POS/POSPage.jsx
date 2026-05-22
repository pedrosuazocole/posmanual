/**
 * POSManual - DevSys Honduras
 * Página principal: Punto de Venta
 * Archivo: client/src/pages/POS/POSPage.jsx
 *
 * Layout de dos columnas:
 *   Izquierda → CatalogoPanel (búsqueda + grid de artículos)
 *   Derecha   → FacturaPanel (items + totales + cobro)
 */
import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate }  from 'react-router-dom';
import { toast }        from 'sonner';

import { usePOSStore }     from '../../store/posStore';
import { useArticulos, useGrupos } from '../../hooks/useArticulos';
import CatalogoPanel       from '../../components/pos/CatalogoPanel';
import FacturaPanel        from '../../components/pos/FacturaPanel';
import { ModalArticuloManual } from '../../components/pos/FacturaSubComponents';
import api                 from '../../api/axios';
import styles              from './POSPage.module.css';

export default function POSPage() {
  const navigate = useNavigate();
  const [modalManual, setModalManual] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState(null);
  const [search, setSearch]           = useState('');

  const { agregarItem, limpiarFactura, turno, setTurno } = usePOSStore();

  // Verificar turno activo al montar la página
  useEffect(() => {
    api.get('/turnos/activo')
      .then(res => setTurno(res.data))
      .catch(() => {
        // No hay turno activo — redirigir
        navigate('/turno/abrir');
      });
  }, [setTurno, navigate]);

  // Catálogo con filtros reactivos
  const { data: articulos = [], isLoading } = useArticulos({ search, grupoId: grupoActivo });
  const { data: grupos = [] }               = useGrupos();

  // Mutación: emitir factura proforma
  const emitirMutation = useMutation({
    mutationFn: (payload) => api.post('/ventas', payload).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`✅ Factura ${data.numero_factura} — L. ${data.total.toFixed(2)}`);
      limpiarFactura();
      // Abrir vista previa de impresión
      window.open(`/imprimir/factura/${data.id}`, '_blank', 'width=400,height=700');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al emitir la factura');
    },
  });

  /** Agrega artículo al POS; si precio=0 abre modal manual */
  const handleAgregarItem = useCallback((art) => {
    if (!art.precio_venta || art.precio_venta === 0) {
      setModalManual({ nombre: art.nombre, codigo: art.codigo, isv: art.impuesto_pct });
      return;
    }
    agregarItem(art);
  }, [agregarItem]);

  if (!turno) {
    return (
      <div className={styles.sinTurno}>
        <i className="ti ti-clock-pause" />
        <h2>Sin turno activo</h2>
        <p>Debés abrir un turno de caja para comenzar a facturar.</p>
        <button onClick={() => navigate('/turno/abrir')}>Abrir turno</button>
      </div>
    );
  }

  return (
    <main className={styles.posLayout}>
      {/* ── Catálogo: izquierda ── */}
      <CatalogoPanel
        articulos={articulos}
        grupos={grupos}
        grupoActivo={grupoActivo}
        onGrupo={setGrupoActivo}
        onSearch={setSearch}
        onAgregarItem={handleAgregarItem}
        onManual={() => setModalManual(true)}
        loading={isLoading}
      />

      {/* ── Factura: derecha ── */}
      <FacturaPanel
        onEmitir={(payload) => emitirMutation.mutate(payload)}
        emitiendo={emitirMutation.isPending}
      />

      {/* ── Modal artículo manual ── */}
      {modalManual && (
        <ModalArticuloManual
          initialData={typeof modalManual === 'object' ? modalManual : {}}
          onClose={() => setModalManual(false)}
        />
      )}
    </main>
  );
}
