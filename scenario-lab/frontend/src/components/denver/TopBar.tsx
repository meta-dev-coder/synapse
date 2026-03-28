import type { DenverState } from './DenverApp'

interface TopBarProps {
  state: DenverState
  onBack: () => void
}

export default function TopBar({ state, onBack }: TopBarProps) {
  const scenarioName = state.activeResult
    ? 'Active Scenario'
    : state.selectedScenarioId
    ? state.savedScenarios.find(s => s.id === state.selectedScenarioId)?.name ?? 'Scenario'
    : 'Baseline'

  return (
    <div style={{
      height: 48,
      background: 'var(--den-panel)',
      borderBottom: '1px solid var(--den-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      flexShrink: 0,
    }}>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: '1px solid var(--den-border)',
          color: 'var(--den-text-muted)',
          padding: '4px 10px',
          borderRadius: 5,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        ← Back
      </button>

      <div style={{
        background: 'var(--den-surface)',
        border: '1px solid var(--den-border)',
        borderRadius: 5,
        padding: '3px 10px',
        fontSize: 13,
        color: 'var(--den-text)',
        fontWeight: 600,
      }}>
        Denver
      </div>

      <span style={{ color: 'var(--den-border)' }}>|</span>

      <span style={{ fontSize: 13, color: 'var(--den-text-muted)' }}>{scenarioName}</span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--den-success)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--den-success)', display: 'inline-block' }} />
          Live + 30-day GPS Data
        </span>
        {state.user && (
          <span style={{ fontSize: 12, color: 'var(--den-text-muted)' }}>
            Welcome, {state.user.name} ({state.user.role.replace(/_/g, ' ')})
          </span>
        )}
      </div>
    </div>
  )
}
