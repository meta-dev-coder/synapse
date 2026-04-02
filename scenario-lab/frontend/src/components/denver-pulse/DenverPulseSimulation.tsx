import React, { useState, useEffect } from 'react'
import { api, DenverPulseSliders, DenverPulseSimulateResponse, DenverPulseSavedScenario } from './api'

const DenverPulseCesiumMap = React.lazy(() =>
  import('./DenverPulseCesiumMap').catch(() => ({
    default: () => <div style={{ padding: 32, color: '#888' }}>Map unavailable</div>,
  }))
)

const POLICIES = [
  { id: 'ev', title: 'EV Incentive Program', desc: 'Encourages EV adoption via incentives' },
  { id: 'bus', title: 'Dedicated Bus Lane', desc: 'Improves transit with exclusive lanes' },
  { id: 'toll', title: 'Congestion Pricing', desc: 'Reduces traffic via demand pricing' },
  { id: 'bike', title: 'Bike Lane Expansion', desc: 'Promotes cycling infrastructure' },
  { id: 'diet', title: 'Road Diet Implementation', desc: 'Reallocates road for multimodal use' },
]

const SYSTEM_SLIDERS = [
  { key: 'traffic_vol_idx', label: 'Traffic Volume Idx', min: 50, max: 150, unit: '' },
  { key: 'road_capacity_idx', label: 'Road Capacity Idx', min: 50, max: 150, unit: '' },
  { key: 'speed_kmh', label: 'Average Speed', min: 10, max: 80, unit: ' km/h' },
  { key: 'emission_idx', label: 'Emission Index', min: 50, max: 150, unit: '' },
  { key: 'ev_share_pct', label: 'EV Share', min: 0, max: 100, unit: '%' },
]

const MODE_SLIDERS = [
  { key: 'car_pct', label: 'Car', min: 0, max: 100, unit: '%' },
  { key: 'pt_pct', label: 'Public Transport', min: 0, max: 100, unit: '%' },
  { key: 'bike_pct', label: 'Bike', min: 0, max: 100, unit: '%' },
  { key: 'walk_pct', label: 'Walk', min: 0, max: 100, unit: '%' },
]

const MODE_KEYS = MODE_SLIDERS.map(s => s.key) as Array<keyof DenverPulseSliders>

const DEFAULT_SLIDERS: DenverPulseSliders = {
  traffic_vol_idx: 100,
  road_capacity_idx: 100,
  speed_kmh: 38,
  emission_idx: 100,
  ev_share_pct: 15,
  car_pct: 45,
  pt_pct: 30,
  bike_pct: 15,
  walk_pct: 10,
}

// ---------------------------------------------------------------------------
// Collapsible Data & Methodology Panel
// ---------------------------------------------------------------------------

const DATA_SOURCES = [
  { metric: 'GHG Emissions', source: 'Denver GHG Inventory 2024', type: 'real' as const, detail: '1,999,929 MT CO₂e/year on-road, IPCC AR6 factors' },
  { metric: 'Congestion Index', source: 'RTD GPS Data (29.1M records)', type: 'real' as const, detail: 'BPR function: Traffic Vol / Road Capacity × 68% baseline' },
  { metric: 'Average Speed', source: 'RTD GPS Data + BPR Model', type: 'mix' as const, detail: 'Speed = Slider × (1 − 0.6 × Congestion%). Bus speed from GPS, car speed derived.' },
  { metric: 'Mode Share', source: 'Slider Input (user-defined)', type: 'synthetic' as const, detail: 'Baseline 45/30/15/10 from HTS survey. Policy shifts are model-estimated.' },
  { metric: 'Policy Multipliers', source: 'Meta-analysis estimates', type: 'synthetic' as const, detail: 'Additive presets from 47 comparable urban interventions (2015–2023)' },
  { metric: 'Confidence Score', source: 'Heuristic', type: 'synthetic' as const, detail: 'Base 60% + 8% per policy applied, capped at 95%' },
]

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  real:      { label: 'Real Data', bg: '#dcfce7', color: '#166534' },
  mix:       { label: 'Mixed', bg: '#fef3c7', color: '#92400e' },
  synthetic: { label: 'Estimated', bg: '#fee2e2', color: '#991b1b' },
}

function DataMethodologyPanel({ policies }: { policies: string[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid #f3f4f6' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '10px 14px', background: '#f9fafb',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#374151',
        }}
      >
        <span>{open ? '▾' : '▸'} Data Sources & Methodology</span>
        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 400 }}>
          {policies.length > 0 ? `${policies.length} policies applied` : 'No policies'} · Click to {open ? 'collapse' : 'expand'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Metric</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Source</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map(row => {
                const badge = TYPE_BADGE[row.type]
                return (
                  <tr key={row.metric} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#111827' }}>{row.metric}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{row.source}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', fontSize: 9, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 4,
                        background: badge.bg, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '8px', color: '#6b7280', fontSize: 10 }}>{row.detail}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: 10, background: '#eff6ff', borderRadius: 6, fontSize: 10, color: '#1e40af', lineHeight: 1.5 }}>
            <strong>Key assumptions:</strong> Uniform policy adoption across selected geographic scope. No behavioral rebound effects modeled.
            Baseline KPIs from Denver 2024 GHG Inventory + RTD GPS data (Feb–Mar 2026, 1.9GB, 38 daily aggregates).
            Policy impact multipliers are model-estimated from comparable urban interventions, not observed Denver outcomes.
          </div>
        </div>
      )}
    </div>
  )
}

interface SimulationProps {
  loadedScenario?: DenverPulseSavedScenario | null
  onLoaded?: () => void
}

const DenverPulseSimulation: React.FC<SimulationProps> = ({ loadedScenario, onLoaded }) => {
  const [activePolicies, setActivePolicies] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState('city')
  const [horizon, setHorizon] = useState('1y')
  const [sliders, setSliders] = useState<DenverPulseSliders>({ ...DEFAULT_SLIDERS })
  const [simulateResult, setSimulateResult] = useState<DenverPulseSimulateResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [mapView, setMapView] = useState<'baseline' | 'scenario'>('baseline')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Load scenario from Scenarios view
  useEffect(() => {
    if (loadedScenario) {
      setActivePolicies(new Set(loadedScenario.policies))
      setScope(loadedScenario.scope)
      setHorizon(loadedScenario.horizon)
      setSliders({ ...loadedScenario.sliders })
      setSimulateResult(loadedScenario.simulate_result)
      setHasRun(true)
      setMapView('scenario')
      setToast(`Loaded scenario: ${loadedScenario.name}`)
      onLoaded?.()
    }
  }, [loadedScenario, onLoaded])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const togglePolicy = (id: string) => {
    setActivePolicies(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateSlider = (key: string, value: number) => {
    if (MODE_KEYS.includes(key as keyof DenverPulseSliders)) {
      setSliders(prev => {
        const others = MODE_KEYS.filter(k => k !== key)
        const remaining = 100 - value
        const othersSum = others.reduce((s, k) => s + prev[k], 0)
        const next = { ...prev, [key]: value }
        if (othersSum > 0) {
          others.forEach(k => {
            next[k] = Math.max(0, Math.round((prev[k] / othersSum) * remaining))
          })
        } else {
          const share = Math.round(remaining / others.length)
          others.forEach((k, i) => {
            next[k] = Math.max(0, i === others.length - 1 ? remaining - share * (others.length - 1) : share)
          })
        }
        // Fix rounding — clamp to non-negative before adjusting
        const total = MODE_KEYS.reduce((s, k) => s + next[k], 0)
        if (total !== 100) {
          const fix = others.find(k => next[k] > 0) ?? others[0]
          next[fix] = Math.max(0, next[fix] + (100 - total))
        }
        return next
      })
    } else {
      setSliders(prev => ({ ...prev, [key]: value }))
    }
  }

  const runSimulation = async () => {
    setRunning(true)
    try {
      const result = await api.simulate({
        policies: [...activePolicies],
        scope,
        horizon,
        sliders,
      })
      setSimulateResult(result)
      setHasRun(true)
      setMapView('scenario')
    } finally {
      setRunning(false)
    }
  }

  const handleSave = async () => {
    if (!simulateResult) return
    setSaving(true)
    try {
      await api.saveScenario({
        name: scenarioName,
        scope,
        horizon,
        policies: [...activePolicies],
        sliders,
        simulate_result: simulateResult,
      })
      setSaveModalOpen(false)
      setToast('Scenario saved successfully')
    } finally {
      setSaving(false)
    }
  }

  const modeTotal = MODE_KEYS.reduce((s, k) => s + sliders[k], 0)

  const fmtDelta = (v: number, higherBetter: boolean) => {
    const sign = v > 0 ? '+' : ''
    const color = higherBetter ? (v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#6b7280') : (v < 0 ? '#16a34a' : v > 0 ? '#dc2626' : '#6b7280')
    const arrow = v > 0 ? '\u25B2' : v < 0 ? '\u25BC' : ''
    return { text: `${sign}${v.toFixed(1)}`, color, arrow }
  }

  const kpiCards = simulateResult
    ? [
        { label: 'GHG Emissions', value: simulateResult.deltas.ghg_tco2e_delta, higherBetter: false, unit: ' tCO2e' },
        { label: 'Transit Share', value: simulateResult.deltas.mode_share_delta.pt, higherBetter: true, unit: '%' },
        { label: 'Congestion', value: simulateResult.deltas.congestion_pct_delta, higherBetter: false, unit: '%' },
        { label: 'Avg Speed', value: simulateResult.deltas.avg_speed_kmh_delta, higherBetter: true, unit: ' km/h' },
      ]
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'row', padding: 12, gap: 12, height: 'calc(100vh - 52px)', overflow: 'hidden' }}>
      {/* LEFT COLUMN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Impact Map Card — grows to fill */}
        <div style={{ flex: 1, minHeight: 300, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Impact Visualization</span>
            {simulateResult && (
              <div style={{ display: 'flex', gap: 4 }}>
                {(['baseline', 'scenario'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setMapView(v)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: mapView === v ? '#3b82f6' : '#e5e7eb',
                      background: mapView === v ? '#eff6ff' : '#fff',
                      color: mapView === v ? '#1d4ed8' : '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {!simulateResult ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', color: '#9ca3af', fontSize: 13 }}>
                Run a simulation to see impact
              </div>
            ) : (
              <React.Suspense fallback={<div style={{ padding: 20, color: '#888' }}>Loading map...</div>}>
                <DenverPulseCesiumMap
                  metric="congestion"
                  cesiumEdges={mapView === 'baseline' ? simulateResult.cesium_edges.baseline : simulateResult.cesium_edges.scenario}
                  height="100%"
                />
              </React.Suspense>
            )}
          </div>
        </div>

        {/* Results Panel — compact, does not steal space from map */}
        <div
          style={{
            flexShrink: 0,
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            opacity: simulateResult ? 1 : 0.5,
            pointerEvents: simulateResult ? 'auto' : 'none',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #f3f4f6',
              background: simulateResult ? '#eff6ff' : undefined,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {simulateResult ? 'Simulation Results' : 'Simulation Results (Pending)'}
            </span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* KPI cards — horizontal row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {kpiCards.map(kpi => {
                const d = fmtDelta(kpi.value, kpi.higherBetter)
                return (
                  <div
                    key={kpi.label}
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      {kpi.label}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: d.color, whiteSpace: 'nowrap' }}>
                      {d.arrow} {d.text}{kpi.unit}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Confidence score */}
            {simulateResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Confidence:</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: simulateResult.confidence_score >= 80 ? '#dcfce7' : simulateResult.confidence_score >= 60 ? '#fef3c7' : '#fee2e2',
                  color: simulateResult.confidence_score >= 80 ? '#166534' : simulateResult.confidence_score >= 60 ? '#92400e' : '#991b1b',
                }}>
                  {simulateResult.confidence_score.toFixed(0)}%
                </span>
              </div>
            )}

            {/* Comparison table — full width below */}
            {simulateResult && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Metric</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600 }}>Base</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: '#6b7280', fontWeight: 600, background: '#eff6ff' }}>Scenario</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Emissions (tCO₂e)', base: simulateResult.baseline.ghg_tco2e, scenario: simulateResult.scenario.ghg_tco2e },
                    { label: 'Transit Share (%)', base: simulateResult.baseline.mode_share.pt, scenario: simulateResult.scenario.mode_share.pt },
                    { label: 'Congestion (%)', base: simulateResult.baseline.congestion_pct, scenario: simulateResult.scenario.congestion_pct },
                    { label: 'Avg Speed (km/h)', base: simulateResult.baseline.avg_speed_kmh, scenario: simulateResult.scenario.avg_speed_kmh },
                  ].map(row => (
                    <tr key={row.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px', fontWeight: 500, color: '#374151' }}>{row.label}</td>
                      <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280' }}>{row.base.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#111827', background: '#eff6ff' }}>{row.scenario.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Collapsible Data & Methodology section */}
          {simulateResult && <DataMethodologyPanel policies={[...activePolicies]} />}
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div style={{ width: 460, flexShrink: 1, minWidth: 340, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
        {/* Policy Selector */}
        <div style={{ flexShrink: 0, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>1. Select Policies</span>
            <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>Multi-select</span>
          </div>
          <div style={{ padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {POLICIES.map(p => {
              const active = activePolicies.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePolicy(p.id)}
                  style={{
                    minWidth: 130,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: `2px solid ${active ? '#3b82f6' : '#e5e7eb'}`,
                    background: active ? '#eff6ff' : '#fff',
                    color: active ? '#1d4ed8' : '#4b5563',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                  title={p.desc}
                >
                  {p.title}
                </button>
              )
            })}
            <button
              disabled
              style={{
                minWidth: 130,
                padding: '8px 12px',
                borderRadius: 6,
                border: '2px solid #e5e7eb',
                background: '#fff',
                color: '#4b5563',
                opacity: 0.6,
                cursor: 'not-allowed',
                fontSize: 11,
                fontWeight: 600,
                textAlign: 'left',
              }}
              title="Coming Soon"
            >
              Policy Library
            </button>
          </div>
        </div>

        {/* Variables Engine */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>2. Variables Engine</span>
            <button
              onClick={() => setSliders({ ...DEFAULT_SLIDERS })}
              style={{ fontSize: 10, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Reset defaults
            </button>
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Scope + Horizon */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope</label>
                <select
                  value={scope}
                  onChange={e => setScope(e.target.value)}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12 }}
                >
                  <option value="downtown">Downtown</option>
                  <option value="corridor">Corridor</option>
                  <option value="city">City</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Horizon</label>
                <select
                  value={horizon}
                  onChange={e => setHorizon(e.target.value)}
                  style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 4, border: '1px solid #e5e7eb', fontSize: 12 }}
                >
                  <option value="3m">3 Months</option>
                  <option value="6m">6 Months</option>
                  <option value="1y">1 Year</option>
                </select>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: 0 }} />

            {/* System Metrics */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>System Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SYSTEM_SLIDERS.map(s => (
                  <div key={s.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: '#374151' }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>
                        {sliders[s.key as keyof DenverPulseSliders]}{s.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={sliders[s.key as keyof DenverPulseSliders]}
                      onChange={e => updateSlider(s.key, parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Mode Share */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Mode Share (Total: {modeTotal}%)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODE_SLIDERS.map(s => (
                  <div key={s.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: '#374151' }}>{s.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#2563eb' }}>
                        {sliders[s.key as keyof DenverPulseSliders]}{s.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      value={sliders[s.key as keyof DenverPulseSliders]}
                      onChange={e => updateSlider(s.key, parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'row', gap: 8 }}>
          <button
            onClick={runSimulation}
            disabled={running}
            style={{
              flex: 1,
              background: '#111827',
              color: '#fff',
              padding: 10,
              borderRadius: 6,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
              opacity: running ? 0.7 : 1,
            }}
          >
            {running ? '⏳ Processing...' : hasRun ? '🔄 Update Run' : '▶ Run Simulation'}
          </button>
          {simulateResult && (
            <button
              onClick={() => {
                setScenarioName('Scenario ' + new Date().toISOString().slice(0, 16).replace('T', ' '))
                setSaveModalOpen(true)
              }}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                padding: '10px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                color: '#374151',
              }}
            >
              💾 Save
            </button>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {saveModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setSaveModalOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setSaveModalOpen(false) }}
        >
          <div
            style={{
              maxWidth: 400,
              width: '100%',
              background: '#fff',
              padding: 24,
              borderRadius: 8,
            }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Enter' && !saving && scenarioName.trim()) handleSave() }}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Save Scenario</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Save these parameters to compare later</p>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={e => setScenarioName(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                marginTop: 4,
                marginBottom: 16,
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid #e5e7eb',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSaveModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#111827',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Scenario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#111827',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 6,
            zIndex: 60,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

export default DenverPulseSimulation
