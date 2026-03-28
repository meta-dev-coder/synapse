import { useState } from 'react'
import type { DenverState, Action, SavedScenario } from '../DenverApp'

const API = (import.meta.env.VITE_DENVER_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1/denver'

export interface CompareResult {
  scenario_a: SavedScenario
  scenario_b: SavedScenario
  delta: Record<string, number>
  winner: string
  insights: string[]
}

// ---------------------------------------------------------------------------
// CompareNav
// ---------------------------------------------------------------------------

interface CompareNavProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
  onCompare: (result: CompareResult) => void
}

export function CompareNav({ state, dispatch, onCompare }: CompareNavProps) {
  const [loading, setLoading] = useState(false)

  const { compareAId, compareBId, savedScenarios } = state

  function handleSelectA(id: string) {
    dispatch({ type: 'SET_COMPARE_A', id: id || null })
    if (id && compareBId && id !== compareBId) {
      triggerCompare(id, compareBId)
    }
  }

  function handleSelectB(id: string) {
    dispatch({ type: 'SET_COMPARE_B', id: id || null })
    if (compareAId && id && compareAId !== id) {
      triggerCompare(compareAId, id)
    }
  }

  function triggerCompare(aId: string, bId: string) {
    setLoading(true)
    fetch(`${API}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_a_id: aId, scenario_b_id: bId }),
    })
      .then(r => r.json())
      .then((result: CompareResult) => {
        dispatch({ type: 'SET_COMPARE_A', id: aId })
        dispatch({ type: 'SET_COMPARE_B', id: bId })
        onCompare(result)
      })
      .catch(err => console.warn('Compare failed:', err))
      .finally(() => setLoading(false))
  }

  function handleManualCompare() {
    if (compareAId && compareBId && compareAId !== compareBId) {
      triggerCompare(compareAId, compareBId)
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    background: 'var(--den-surface)',
    border: '1px solid var(--den-border)',
    borderRadius: 6,
    color: 'var(--den-text)',
    fontSize: 12,
    cursor: 'pointer',
  }

  const canCompare = Boolean(compareAId && compareBId && compareAId !== compareBId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4, fontWeight: 600 }}>
          SCENARIO A
        </div>
        <select
          value={compareAId ?? ''}
          onChange={e => handleSelectA(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select&hellip;</option>
          {savedScenarios.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4, fontWeight: 600 }}>
          SCENARIO B
        </div>
        <select
          value={compareBId ?? ''}
          onChange={e => handleSelectB(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select&hellip;</option>
          {savedScenarios.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleManualCompare}
        disabled={!canCompare || loading}
        style={{
          width: '100%',
          padding: '7px 0',
          background: canCompare && !loading ? 'var(--den-primary)' : 'var(--den-border)',
          border: 'none',
          borderRadius: 6,
          color: canCompare && !loading ? '#fff' : 'var(--den-text-muted)',
          fontSize: 12,
          fontWeight: 600,
          cursor: canCompare && !loading ? 'pointer' : 'not-allowed',
          transition: 'background 200ms ease',
        }}
      >
        {loading ? 'Comparing\u2026' : 'Compare \u25B6'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompareRightPanel
// ---------------------------------------------------------------------------

interface CompareRightPanelProps {
  state: DenverState
  compareResult: CompareResult | null
  dispatch: React.Dispatch<Action>
}

interface TableRow {
  label: string
  aVal: string
  bVal: string
  delta: string
}

function fmtDelta(value: number, suffix = '%'): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}${suffix}`
}

function buildRows(result: CompareResult): TableRow[] {
  const a = result.scenario_a.results
  const b = result.scenario_b.results
  const d = result.delta

  return [
    {
      label: 'CO\u2082 Reduction',
      aVal: `${a.co2_reduction_pct.toFixed(1)}%`,
      bVal: `${b.co2_reduction_pct.toFixed(1)}%`,
      delta: fmtDelta(d['co2_reduction_pct'] ?? 0),
    },
    {
      label: 'Traffic',
      aVal: `${a.traffic_improvement_pct.toFixed(1)}%`,
      bVal: `${b.traffic_improvement_pct.toFixed(1)}%`,
      delta: fmtDelta(d['traffic_improvement_pct'] ?? 0),
    },
    {
      label: 'Bus Delay',
      aVal: `${a.bus_delay_reduction_pct.toFixed(1)}%`,
      bVal: `${b.bus_delay_reduction_pct.toFixed(1)}%`,
      delta: fmtDelta(d['bus_delay_reduction_pct'] ?? 0),
    },
    {
      label: 'Net Zero Gap',
      aVal: `${a.net_zero_gap_remaining_mt.toFixed(2)}M mt`,
      bVal: `${b.net_zero_gap_remaining_mt.toFixed(2)}M mt`,
      delta: fmtDelta((d['net_zero_gap_remaining_mt'] ?? 0) * 1000, 'k'),
    },
  ]
}

export function CompareRightPanel({ state, compareResult, dispatch }: CompareRightPanelProps) {
  const { compareView } = state

  const viewButtons: { key: 'A' | 'B' | 'diff'; label: string }[] = [
    { key: 'A', label: 'Show A' },
    { key: 'B', label: 'Show B' },
    { key: 'diff', label: 'Difference' },
  ]

  if (!compareResult) {
    return (
      <div style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--den-text-muted)',
        fontSize: 13,
      }}>
        Select two scenarios to compare
      </div>
    )
  }

  const rows = buildRows(compareResult)
  const isWinner = compareResult.winner && compareResult.winner !== 'tie'

  const thStyle: React.CSSProperties = {
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--den-text-muted)',
    borderBottom: '1px solid var(--den-border)',
    textAlign: 'left',
  }
  const tdStyle: React.CSSProperties = {
    padding: '7px 8px',
    fontSize: 12,
    color: 'var(--den-text)',
    borderBottom: '1px solid var(--den-border)',
  }
  const tdDeltaStyle: React.CSSProperties = {
    ...tdStyle,
    color: 'var(--den-success)',
    fontWeight: 600,
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--den-text)' }}>
        Comparison
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        {viewButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => dispatch({ type: 'SET_COMPARE_VIEW', view: btn.key })}
            style={{
              flex: 1,
              padding: '5px 0',
              background: compareView === btn.key ? 'var(--den-primary)' : 'var(--den-surface)',
              border: '1px solid var(--den-border)',
              borderRadius: 5,
              color: compareView === btn.key ? '#fff' : 'var(--den-text-muted)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 200ms ease, color 200ms ease',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Comparison table */}
      <div style={{
        background: 'var(--den-surface)',
        border: '1px solid var(--den-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={{ ...thStyle, textAlign: 'right' }}>A</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>B</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>&Delta;</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <td style={{ ...tdStyle, color: 'var(--den-text-muted)', fontSize: 11 }}>{row.label}</td>
                {compareView !== 'B' && (
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.aVal}</td>
                )}
                {compareView === 'B' && (
                  <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                )}
                {compareView !== 'A' && (
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{row.bVal}</td>
                )}
                {compareView === 'A' && (
                  <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                )}
                <td style={{ ...tdDeltaStyle, textAlign: 'right' }}>{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Winner banner */}
      <div style={{
        padding: '10px 14px',
        background: isWinner ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
        border: `1px solid ${isWinner ? 'var(--den-success)' : 'var(--den-border)'}`,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        color: isWinner ? 'var(--den-success)' : 'var(--den-text-muted)',
        textAlign: 'center',
      }}>
        {isWinner
          ? `Scenario ${compareResult.winner} performs better overall`
          : 'Scenarios are comparable'}
      </div>

      {/* Insights */}
      {compareResult.insights.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--den-text-muted)', marginBottom: 8 }}>
            AUTO-INSIGHTS
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {compareResult.insights.map((insight, i) => (
              <li key={i} style={{ fontSize: 12, color: 'var(--den-text)', lineHeight: 1.5 }}>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompareScreen (default export — convenience wrapper)
// ---------------------------------------------------------------------------

interface CompareScreenProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
}

export default function CompareScreen({ state, dispatch }: CompareScreenProps) {
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{
        width: 240,
        padding: 16,
        borderRight: '1px solid var(--den-border)',
        background: 'var(--den-panel)',
        flexShrink: 0,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--den-text)', marginBottom: 12 }}>
          Compare Scenarios
        </div>
        <CompareNav state={state} dispatch={dispatch} onCompare={setCompareResult} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CompareRightPanel state={state} compareResult={compareResult} dispatch={dispatch} />
      </div>
    </div>
  )
}
