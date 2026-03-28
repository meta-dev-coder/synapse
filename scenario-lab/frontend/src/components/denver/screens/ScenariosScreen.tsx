import { useEffect } from 'react'
import type { DenverState, Action, SavedScenario } from '../DenverApp'

const API = (import.meta.env.VITE_DENVER_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1/denver'

interface ScenariosScreenProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
}

function fmt(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function ModeSplitBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--den-text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--den-text)' }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{
        height: 6,
        background: 'var(--den-border)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(value * 100, 100)}%`,
          background: 'var(--den-primary)',
          borderRadius: 3,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  )
}

function DetailPanel({ scenario }: { scenario: SavedScenario }) {
  const r = scenario.results
  const modeSplit = r.new_mode_split ?? {}

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      background: 'var(--den-surface)',
      border: '1px solid var(--den-border)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--den-text)' }}>
        {scenario.name} — Detail
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 16,
      }}>
        {[
          { label: 'CO\u2082 Reduction', value: `${r.co2_reduction_pct.toFixed(1)}%` },
          { label: 'Net Zero Gap Remaining', value: `${r.net_zero_gap_remaining_mt.toFixed(2)}M mt` },
          { label: 'Traffic Improvement', value: `${r.traffic_improvement_pct.toFixed(1)}%` },
          { label: 'Bus Delay Reduction', value: `${r.bus_delay_reduction_pct.toFixed(1)}%` },
          { label: 'New EV Fleet', value: `${(r.new_ev_fleet_pct * 100).toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--den-panel)',
            border: '1px solid var(--den-border)',
            borderRadius: 6,
            padding: '8px 10px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--den-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--den-text-muted)', marginBottom: 8, fontWeight: 600 }}>
        NEW MODE SPLIT
      </div>
      {Object.entries(modeSplit).map(([mode, share]) => (
        <ModeSplitBar key={mode} label={mode} value={typeof share === 'number' ? share : 0} />
      ))}
    </div>
  )
}

export default function ScenariosScreen({ state, dispatch }: ScenariosScreenProps) {
  useEffect(() => {
    fetch(`${API}/scenarios`)
      .then(r => r.json())
      .then((data: SavedScenario[]) => dispatch({ type: 'SET_SAVED_SCENARIOS', scenarios: data }))
      .catch(err => console.warn('Failed to load scenarios:', err))
  }, [dispatch])

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    fetch(`${API}/scenarios/${id}`, { method: 'DELETE' })
      .then(() => dispatch({ type: 'DELETE_SAVED_SCENARIO', id }))
      .catch(err => console.warn('Failed to delete scenario:', err))
  }

  const selectedScenario = state.savedScenarios.find(s => s.id === state.selectedScenarioId) ?? null

  return (
    <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--den-text)' }}>
        Saved Scenarios
      </div>

      {state.savedScenarios.length === 0 ? (
        <div style={{
          padding: 32,
          textAlign: 'center',
          color: 'var(--den-text-muted)',
          fontSize: 13,
          border: '1px dashed var(--den-border)',
          borderRadius: 8,
        }}>
          No saved scenarios yet. Run a New Scenario to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.savedScenarios.map(scenario => {
            const isSelected = scenario.id === state.selectedScenarioId
            return (
              <div
                key={scenario.id}
                onClick={() => dispatch({ type: 'SELECT_SCENARIO', id: isSelected ? null : scenario.id })}
                style={{
                  padding: '10px 12px',
                  background: isSelected ? 'var(--den-surface)' : 'var(--den-panel)',
                  border: `1px solid ${isSelected ? 'var(--den-primary)' : 'var(--den-border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'border-color 200ms ease, background 200ms ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--den-text)', marginBottom: 3 }}>
                    {scenario.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--den-text-muted)' }}>
                    CO\u2082 -{scenario.results.co2_reduction_pct.toFixed(1)}% &nbsp;&middot;&nbsp; {fmt(scenario.created_at)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, scenario.id)}
                  style={{
                    background: 'none',
                    border: '1px solid var(--den-danger)',
                    color: 'var(--den-danger)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      )}

      {selectedScenario && <DetailPanel scenario={selectedScenario} />}
    </div>
  )
}
