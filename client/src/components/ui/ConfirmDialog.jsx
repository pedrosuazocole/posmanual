/**
 * POSManual - DevSys Honduras
 * Componente reutilizable: Diálogo de confirmación
 * Archivo: client/src/components/ui/ConfirmDialog.jsx
 *
 * Uso en cualquier módulo del sistema:
 *   <ConfirmDialog
 *     title="Desactivar usuario"
 *     message='¿Desactivar a "cajero01"?'
 *     confirmLabel="Desactivar"
 *     danger={true}
 *     onConfirm={() => toggleMut.mutate(usuario)}
 *     onCancel={() => setConfirm(null)}
 *   />
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  danger       = false,
  onConfirm,
  onCancel,
}) {
  const confirmBg = danger ? '#A32D2D' : '#1B4F9B';

  return (
    <div style={{
      background: danger ? 'var(--color-background-danger)' : 'var(--color-background-warning)',
      border: `0.5px solid ${danger ? 'var(--color-border-danger)' : 'var(--color-border-warning)'}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div>
        {title && (
          <div style={{
            fontSize: 13,
            fontWeight: 500,
            color: danger ? 'var(--color-text-danger)' : 'var(--color-text-warning)',
            marginBottom: 2,
          }}>
            {title}
          </div>
        )}
        <p style={{
          fontSize: 13,
          color: danger ? 'var(--color-text-danger)' : 'var(--color-text-warning)',
        }}>
          {message}
        </p>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: `0.5px solid ${danger ? 'var(--color-border-danger)' : 'var(--color-border-warning)'}`,
            padding: '6px 12px',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 12,
            cursor: 'pointer',
            color: danger ? 'var(--color-text-danger)' : 'var(--color-text-warning)',
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          style={{
            background: confirmBg,
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 'var(--border-radius-md)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
