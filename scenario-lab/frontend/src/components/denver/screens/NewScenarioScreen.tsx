import React, { useState, useMemo } from 'react'
import type { DenverState, Action, ScenarioResult } from '../DenverApp'

// ── helpers ───────────────────────────────────────────────────────────────────

function randomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function fmtMtShort(mt: number): string {
  const abs = Math.abs(mt)
  if (abs >= 1_000_000) return `${(mt / 1_000_000).toFixed(2)}M mt`
  if (abs >= 1_000) return `${(mt / 1_000).toFixed(1)}K mt`
  return `${mt.toFixed(0)} mt`
}

function fmtMtPerYear(mt: number): string {
  return `${mt >= 0 ? '+' : ''}${mt.toLocaleString(undefined, { maximumFractionDigits: 0 })} mt/year`
}

// ── sub-components ────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--den-text)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--den-primary)', fontWeight: 600 }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--den-primary)', cursor: 'pointer' }}
      />
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer',
      marginBottom: 14,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: 'var(--den-primary)', width: 15, height: 15, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 12, color: 'var(--den-text)' }}>{label}</span>
    </label>
  )
}

function ModeSplitBar({
  label,
  pct,
  color,
}: {
  label: string
  pct: number
  color: string
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--den-text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--den-text)' }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 7, background: 'var(--den-border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  )
}

function ResultKpi({
  label,
  value,
  color,
  sub,
}: {
  label: string
  value: string
  color?: string
  sub?: string
}) {
  return (
    <div style={{
      background: 'var(--den-surface)',
      border: '1px solid var(--den-border)',
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--den-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Part A: NewScenarioNav ─────────────────────────────────────────────────────

interface NavProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
}

export function NewScenarioNav({ state, dispatch }: NavProps) {
  const code = useMemo(() => randomCode(), [])
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scenarioName] = useState(`Scenario ${code}`)

  const user = state.user
  const canEditPolicy = user?.role === 'policy_analyst'
  const canEditOps = user?.role === 'policy_analyst' || user?.role === 'operations_manager'

  const inputs = state.activeInputs

  function handleRun() {
    if (!canEditOps || running) return
    setRunning(true)
    const api = (import.meta.env.VITE_DENVER_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1/denver'
    fetch(`${api}/scenario/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    })
      .then(r => r.json())
      .then((data: ScenarioResult) => {
        dispatch({ type: 'SET_ACTIVE_RESULT', result: data })
      })
      .catch(err => console.warn('Scenario run failed:', err))
      .finally(() => setRunning(false))
  }

  function handleSave() {
    if (!state.activeResult) return
    setSaving(true)
    const api2 = (import.meta.env.VITE_DENVER_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1/denver'
    fetch(`${api2}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scenarioName,
        inputs: state.activeInputs,
        results: state.activeResult,
      }),
    })
      .then(r => r.json())
      .then(data => dispatch({ type: 'ADD_SAVED_SCENARIO', scenario: data }))
      .catch(err => console.warn('Save failed:', err))
      .finally(() => setSaving(false))
  }

  return (
    <div style={{ padding: '14px 14px 8px', display: 'flex', flexDirection: 'column' }}>
      {/* Scenario name */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4 }}>SCENARIO NAME</div>
        <input
          defaultValue={scenarioName}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--den-surface)',
            border: '1px solid var(--den-border)',
            borderRadius: 6,
            color: 'var(--den-text)',
            fontSize: 13,
            padding: '6px 8px',
            fontFamily: 'var(--den-font)',
            outline: 'none',
          }}
        />
      </div>

      {/* Sliders / checkboxes */}
      {canEditPolicy && (
        <SliderRow
          label="EV Adoption %"
          value={inputs.ev_adoption_pct}
          min={0}
          max={30}
          step={1}
          unit="%"
          onChange={v => dispatch({ type: 'SET_ACTIVE_INPUTS', inputs: { ev_adoption_pct: v } })}
        />
      )}

      {canEditPolicy && (
        <SliderRow
          label="Transit Increase %"
          value={inputs.mode_shift_pct}
          min={0}
          max={15}
          step={1}
          unit="%"
          onChange={v => dispatch({ type: 'SET_ACTIVE_INPUTS', inputs: { mode_shift_pct: v } })}
        />
      )}

      {canEditOps && (
        <SliderRow
          label="Bus Efficiency %"
          value={inputs.bus_efficiency_pct}
          min={0}
          max={20}
          step={1}
          unit="%"
          onChange={v => dispatch({ type: 'SET_ACTIVE_INPUTS', inputs: { bus_efficiency_pct: v } })}
        />
      )}

      {canEditPolicy && (
        <CheckRow
          label="Add Bike Lanes"
          checked={inputs.bike_lanes}
          onChange={v => dispatch({ type: 'SET_ACTIVE_INPUTS', inputs: { bike_lanes: v } })}
        />
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={!canEditOps || running}
        style={{
          width: '100%',
          padding: '9px 0',
          background: canEditOps ? 'var(--den-primary)' : 'var(--den-border)',
          color: canEditOps ? '#fff' : 'var(--den-text-muted)',
          border: 'none',
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 600,
          cursor: canEditOps ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          marginBottom: 8,
          transition: 'opacity 150ms ease',
          opacity: running ? 0.7 : 1,
          fontFamily: 'var(--den-font)',
        }}
      >
        {running ? (
          <>
            <span style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'den-spin 0.6s linear infinite',
            }} />
            Running…
          </>
        ) : (
          '▶ Run Scenario'
        )}
      </button>

      {/* CSS for spinner */}
      <style>{`@keyframes den-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Save button */}
      {state.activeResult !== null && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '8px 0',
            background: 'transparent',
            color: 'var(--den-success)',
            border: '1px solid var(--den-success)',
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            fontFamily: 'var(--den-font)',
          }}
        >
          {saving ? 'Saving…' : '💾 Save'}
        </button>
      )}
    </div>
  )
}

// ── Part B: NewScenarioRightPanel ──────────────────────────────────────────────

interface RightPanelProps {
  state: DenverState
}

export function NewScenarioRightPanel({ state }: RightPanelProps) {
  const result = state.activeResult

  if (result === null) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--den-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          fontSize: 28,
        }}>
          📊
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--den-text)', marginBottom: 8 }}>
          Run scenario to see results
        </div>
        <div style={{ fontSize: 12, color: 'var(--den-text-muted)', lineHeight: 1.6 }}>
          Drag the sliders on the left and click{' '}
          <strong style={{ color: 'var(--den-primary)' }}>▶ Run Scenario</strong>{' '}
          to simulate the impact on Denver's emissions and traffic.
        </div>
      </div>
    )
  }

  const modeSplit = result.new_mode_split ?? {}
  const carPct = (modeSplit['car'] ?? 0) as number
  const transitPct = (modeSplit['transit'] ?? 0) as number
  const evBikePct = (modeSplit['active'] ?? modeSplit['ev_bike'] ?? 0) as number

  return (
    <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--den-text)', marginBottom: 14 }}>
        Scenario Results
      </div>

      {/* CO₂ Reduction % */}
      <ResultKpi
        label="CO₂ Reduction"
        value={`${result.co2_reduction_pct.toFixed(1)}%`}
        color="var(--den-success)"
      />

      {/* CO₂ Reduction mt */}
      <ResultKpi
        label="CO₂ Reduction (absolute)"
        value={fmtMtPerYear(-result.co2_reduction_mt)}
        color="var(--den-success)"
        sub="relative to baseline"
      />

      {/* Net Zero Gap */}
      <ResultKpi
        label="Net Zero Gap Remaining"
        value={fmtMtShort(result.net_zero_gap_remaining_mt)}
        color="var(--den-warning)"
      />

      {/* Traffic Improvement */}
      <ResultKpi
        label="Traffic Improvement"
        value={`↑ ${result.traffic_improvement_pct.toFixed(1)}%`}
        color="var(--den-primary)"
      />

      {/* Bus Delay Reduction */}
      <ResultKpi
        label="Bus Delay Reduction"
        value={`↑ ${result.bus_delay_reduction_pct.toFixed(1)}%`}
        color="var(--den-primary)"
      />

      {/* New Mode Split */}
      <div style={{
        background: 'var(--den-surface)',
        border: '1px solid var(--den-border)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          New Mode Split
        </div>
        <ModeSplitBar label="Car" pct={carPct} color="var(--den-warning)" />
        <ModeSplitBar label="Transit" pct={transitPct} color="var(--den-primary)" />
        <ModeSplitBar label="EV+Bike" pct={evBikePct} color="var(--den-success)" />
      </div>

      {/* New EV Fleet % */}
      <ResultKpi
        label="New EV Fleet %"
        value={`${result.new_ev_fleet_pct.toFixed(1)}%`}
        color="var(--den-success)"
      />
    </div>
  )
}

// ── Default export: standalone combined view ──────────────────────────────────

interface NewScenarioScreenProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
}

export default function NewScenarioScreen({ state, dispatch }: NewScenarioScreenProps) {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{
        width: 240,
        flexShrink: 0,
        background: 'var(--den-panel)',
        borderRight: '1px solid var(--den-border)',
        overflowY: 'auto',
      }}>
        <NewScenarioNav state={state} dispatch={dispatch} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--den-bg)' }}>
        <NewScenarioRightPanel state={state} />
      </div>
    </div>
  )
}
