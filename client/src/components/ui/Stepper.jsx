/**
 * POSManual - DevSys Honduras
 * Componente reutilizable: Stepper de pasos
 * Archivo: client/src/components/ui/Stepper.jsx
 *
 * Props:
 *   steps   - [{ label: string }]
 *   current - número de paso activo (1-based)
 */
export default function Stepper({ steps, current }) {
  return (
    <nav aria-label="Pasos del proceso" style={{
      display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.5rem',
    }}>
      {steps.map((step, i) => {
        const num    = i + 1;
        const done   = num < current;
        const active = num === current;

        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {/* Círculo numerado */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              flex: i < steps.length - 1 ? 'none' : 1,
            }}>
              <div
                aria-current={active ? 'step' : undefined}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: done || active ? 'none' : '1.5px solid var(--color-border-secondary)',
                  background: done || active ? '#1B4F9B' : 'var(--color-background-primary)',
                  color: done || active ? '#fff' : 'var(--color-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 500, flexShrink: 0,
                  transition: 'background .2s, color .2s',
                }}
              >
                {done
                  ? <i className="ti ti-check" style={{ fontSize: 13 }} aria-hidden="true" />
                  : num
                }
              </div>
              <span style={{
                fontSize: 12,
                color: active ? 'var(--color-text-primary)' : done ? '#185FA5' : 'var(--color-text-secondary)',
                fontWeight: active ? 500 : 400,
                whiteSpace: 'nowrap',
              }}>
                {step.label}
              </span>
            </div>

            {/* Línea separadora */}
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: 1,
                background: done ? '#185FA5' : 'var(--color-border-tertiary)',
                margin: '0 8px',
                transition: 'background .2s',
              }} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
