import React from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

const DenverPulseMethodologyModal: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15,23,42,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          maxWidth: 672,
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{'\uD83D\uDCD6'}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
              Calculation Methodology & Assumptions
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: '#6b7280',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section 1 — Data Sources */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Data Sources</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { title: 'Traffic Data', detail: 'RTD GPS, 29.1M records' },
                { title: 'Emissions', detail: 'Denver GHG Inventory 2024' },
                { title: 'Mode Share', detail: 'RTD ridership logs + GPS bus activity' },
              ].map(d => (
                <div
                  key={d.title}
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{d.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2 — Estimated vs Actual */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Estimated vs Actual</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Estimated', desc: 'Policy multipliers applied to baseline', color: '#f97316', bg: '#fff7ed' },
                { label: 'Actual', desc: 'RTD GPS 1.9GB real-time sensor data', color: '#10b981', bg: '#ecfdf5' },
                { label: 'Assumed', desc: 'Uniform adoption across all zones', color: '#3b82f6', bg: '#eff6ff' },
              ].map(d => (
                <div
                  key={d.label}
                  style={{
                    background: d.bg,
                    border: `1px solid ${d.color}33`,
                    borderRadius: 8,
                    padding: 12,
                    borderLeft: `4px solid ${d.color}`,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: d.color, marginBottom: 4 }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: '#4b5563' }}>{d.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 — KPI Derivation Logic */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#2563eb',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>KPI Derivation Logic</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'GHG Emissions', formula: 'GHG = baseline_tCO2e * (1 - ev_share * 0.6) * policy_multiplier' },
                { label: 'Congestion Index', formula: 'Congestion = (volume / capacity) * BPR_alpha * (1 + policy_relief)' },
                { label: 'Average Speed', formula: 'Avg Speed = free_flow_speed / (1 + 0.15 * (V/C)^4) + policy_boost' },
                { label: 'Transit Share', formula: 'Transit % = base_pt_pct * (1 + bus_lane_factor + pricing_shift)' },
              ].map(f => (
                <div
                  key={f.label}
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>{f.label}</div>
                  <code style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{f.formula}</code>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DenverPulseMethodologyModal
