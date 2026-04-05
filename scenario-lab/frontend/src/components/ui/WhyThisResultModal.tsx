
interface Props {
  open: boolean
  onClose: () => void
  confidenceText?: string
}

const ASSUMPTIONS = [
  'BPR/Webster model assumes steady-state conditions; transient surge effects are not captured.',
  'Lane parameters are applied uniformly — no partial-lane or time-of-day variation modeled.',
  'Traveler behavior responds immediately to signal/toll changes; no lag or rebound effects.',
]

export default function WhyThisResultModal({ open, onClose, confidenceText }: Props) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(15,52,96,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        border: '1px solid #e5e7eb', width: '100%', maxWidth: 480,
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>❓</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Why this result?</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Key Assumptions */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>📋</span> Key Assumptions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ASSUMPTIONS.map((text, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 10px', background: '#f9fafb',
                  borderRadius: 6, border: '1px solid #f3f4f6',
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#dbeafe', color: '#1d4ed8',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estimated vs Actual */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>⚡</span> Estimated vs Actual
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 10px', background: '#fff7ed',
                borderRadius: 6, border: '1px solid #fed7aa',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#c2410c',
                  background: '#fed7aa', borderRadius: 3, padding: '1px 5px',
                  flexShrink: 0, marginTop: 1,
                }}>ESTIMATED</span>
                <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                  Scenario values are modeled from calibrated traffic equations — not directly measured outcomes.
                </span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 10px', background: '#ecfdf5',
                borderRadius: 6, border: '1px solid #a7f3d0',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#065f46',
                  background: '#a7f3d0', borderRadius: 3, padding: '1px 5px',
                  flexShrink: 0, marginTop: 1,
                }}>ACTUAL</span>
                <span style={{ fontSize: 12, color: '#064e3b', lineHeight: 1.5 }}>
                  Baseline KPIs come from real toll-plaza sensor data updated per simulation run.
                </span>
              </div>
            </div>
          </div>

          {/* Confidence Explanation */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#374151', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>🛡</span> Confidence Explanation
            </div>
            <div style={{
              padding: '10px 12px', background: '#f9fafb',
              borderRadius: 6, border: '1px solid #e5e7eb',
              fontSize: 12, color: '#374151', lineHeight: 1.6,
            }}>
              {confidenceText ?? 'Results are derived from established traffic engineering models (BPR, Webster) calibrated against historical plaza data. Confidence is higher for moderate traffic loads and lower near capacity limits where non-linear effects dominate.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px', borderRadius: 6, border: 'none',
              background: '#111827', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >Got it</button>
        </div>
      </div>
    </div>
  )
}
