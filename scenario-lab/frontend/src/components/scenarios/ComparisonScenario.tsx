import React, { useState } from 'react'
import SliderInput from '../ui/SliderInput'
import type { SimulationResult } from '../../App'

interface Props {
  onResult: (result: SimulationResult) => void
}

type ScenarioDef =
  | { type: 'toll';      inputs: TollInputs }
  | { type: 'corridor';  inputs: CorridorInputs }
  | { type: 'emission';  inputs: EmissionInputs }
  | { type: 'evasion';   inputs: EvasionInputs }

interface TollInputs {
  vehicle_rates: { car: number; truck: number; bus: number; van: number }
  peak_multiplier: number
  ev_exemption: boolean
  enforcement_intensity: number
}

interface CorridorInputs {
  closed_lanes: string[]
  capacity_reduction_pct: number
  weather_factor: number
}

interface EmissionInputs {
  vehicle_mix_pct: { car: number; truck: number; bus: number; van: number }
  speed_delta_kmh: number
  idling_time_min: number
}

interface EvasionInputs {
  toll_increase_pct: number
  detection_accuracy: number
  patrol_frequency: number
}

interface ComparisonMetrics {
  revenue_usd_hr: number | null
  co2_kg_hr: number | null
  travel_time_delta_pct: number | null
  evasion_rate_pct: number | null
}

interface ComparisonColumn {
  label: string
  metrics: ComparisonMetrics
  cesium_heatmap: Record<string, number>
}

interface ComparisonResult {
  baseline: ComparisonColumn
  scenario_a: ComparisonColumn
  scenario_b: ComparisonColumn
  cesium_diff_heatmap: Record<string, number>
}

const SCENARIO_TYPES = ['toll', 'corridor', 'emission', 'evasion'] as const
type ScenarioKind = typeof SCENARIO_TYPES[number]

const DEFAULT_TOLL_INPUTS: TollInputs = {
  vehicle_rates: { car: 3.0, truck: 7.5, bus: 6.0, van: 4.0 },
  peak_multiplier: 1.0,
  ev_exemption: false,
  enforcement_intensity: 0.5,
}

const DEFAULT_CORRIDOR_INPUTS: CorridorInputs = {
  closed_lanes: [],
  capacity_reduction_pct: 0,
  weather_factor: 1.0,
}

const DEFAULT_EMISSION_INPUTS: EmissionInputs = {
  vehicle_mix_pct: { car: 60, truck: 20, bus: 10, van: 10 },
  speed_delta_kmh: 0,
  idling_time_min: 3.2,
}

const DEFAULT_EVASION_INPUTS: EvasionInputs = {
  toll_increase_pct: 20,
  detection_accuracy: 0.72,
  patrol_frequency: 0.35,
}

function makeDefault(type: ScenarioKind): ScenarioDef {
  switch (type) {
    case 'toll':      return { type, inputs: { ...DEFAULT_TOLL_INPUTS } }
    case 'corridor':  return { type, inputs: { ...DEFAULT_CORRIDOR_INPUTS } }
    case 'emission':  return { type, inputs: { ...DEFAULT_EMISSION_INPUTS } }
    case 'evasion':   return { type, inputs: { ...DEFAULT_EVASION_INPUTS } }
  }
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#e94560',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 8,
}

// ─── Per-scenario mini input panels ──────────────────────────────────────────

const TollInputPanel: React.FC<{
  inputs: TollInputs
  onChange: (inputs: TollInputs) => void
}> = ({ inputs, onChange }) => (
  <div>
    <SliderInput
      label="Peak Multiplier"
      min={0.5} max={3.0} step={0.05}
      value={inputs.peak_multiplier}
      onChange={(v) => onChange({ ...inputs, peak_multiplier: v })}
      formatValue={(v) => `×${v.toFixed(2)}`}
    />
    <SliderInput
      label="Enforcement Intensity"
      min={0} max={1} step={0.01}
      value={inputs.enforcement_intensity}
      onChange={(v) => onChange({ ...inputs, enforcement_intensity: v })}
      formatValue={(v) => `${(v * 100).toFixed(0)}%`}
    />
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: '#ccd8e8', cursor: 'pointer', marginTop: 4,
      }}
    >
      <input
        type="checkbox"
        checked={inputs.ev_exemption}
        onChange={(e) => onChange({ ...inputs, ev_exemption: e.target.checked })}
        style={{ accentColor: '#e94560' }}
      />
      EV Exemption
    </label>
  </div>
)

const CorridorInputPanel: React.FC<{
  inputs: CorridorInputs
  onChange: (inputs: CorridorInputs) => void
}> = ({ inputs, onChange }) => (
  <div>
    <SliderInput
      label="Capacity Reduction"
      min={0} max={80} step={1}
      value={inputs.capacity_reduction_pct}
      onChange={(v) => onChange({ ...inputs, capacity_reduction_pct: v })}
      unit="%" formatValue={(v) => `${v.toFixed(0)}%`}
    />
    <SliderInput
      label="Weather Factor"
      min={0.5} max={1.5} step={0.01}
      value={inputs.weather_factor}
      onChange={(v) => onChange({ ...inputs, weather_factor: v })}
      formatValue={(v) => `×${v.toFixed(2)}`}
    />
  </div>
)

const EmissionInputPanel: React.FC<{
  inputs: EmissionInputs
  onChange: (inputs: EmissionInputs) => void
}> = ({ inputs, onChange }) => (
  <div>
    <SliderInput
      label="Speed Delta"
      min={-30} max={30} step={1}
      value={inputs.speed_delta_kmh}
      onChange={(v) => onChange({ ...inputs, speed_delta_kmh: v })}
      formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)} km/h`}
    />
    <SliderInput
      label="Idling Time"
      min={0} max={15} step={0.1}
      value={inputs.idling_time_min}
      onChange={(v) => onChange({ ...inputs, idling_time_min: v })}
      formatValue={(v) => `${v.toFixed(1)} min`}
    />
  </div>
)

const EvasionInputPanel: React.FC<{
  inputs: EvasionInputs
  onChange: (inputs: EvasionInputs) => void
}> = ({ inputs, onChange }) => (
  <div>
    <SliderInput
      label="Toll Increase"
      min={0} max={100} step={1}
      value={inputs.toll_increase_pct}
      onChange={(v) => onChange({ ...inputs, toll_increase_pct: v })}
      formatValue={(v) => `+${v.toFixed(0)}%`}
    />
    <SliderInput
      label="Detection Accuracy"
      min={0} max={1} step={0.01}
      value={inputs.detection_accuracy}
      onChange={(v) => onChange({ ...inputs, detection_accuracy: v })}
      formatValue={(v) => `${(v * 100).toFixed(0)}%`}
    />
  </div>
)

// ─── Scenario selector card ───────────────────────────────────────────────────

interface ScenarioCardProps {
  title: string
  scenario: ScenarioDef
  onChange: (s: ScenarioDef) => void
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ title, scenario, onChange }) => {
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(makeDefault(e.target.value as ScenarioKind))
  }

  const renderInputs = () => {
    switch (scenario.type) {
      case 'toll':
        return (
          <TollInputPanel
            inputs={scenario.inputs as TollInputs}
            onChange={(inp) => onChange({ type: 'toll', inputs: inp })}
          />
        )
      case 'corridor':
        return (
          <CorridorInputPanel
            inputs={scenario.inputs as CorridorInputs}
            onChange={(inp) => onChange({ type: 'corridor', inputs: inp })}
          />
        )
      case 'emission':
        return (
          <EmissionInputPanel
            inputs={scenario.inputs as EmissionInputs}
            onChange={(inp) => onChange({ type: 'emission', inputs: inp })}
          />
        )
      case 'evasion':
        return (
          <EvasionInputPanel
            inputs={scenario.inputs as EvasionInputs}
            onChange={(inp) => onChange({ type: 'evasion', inputs: inp })}
          />
        )
    }
  }

  return (
    <div
      style={{
        background: '#0a2744',
        border: '1px solid #1a3a60',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0' }}>{title}</span>
        <select value={scenario.type} onChange={handleTypeChange} style={{ fontSize: 12 }}>
          {SCENARIO_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      {renderInputs()}
    </div>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────

interface TableMetric {
  label: string
  key: keyof ComparisonMetrics
  unit: string
  positiveIsGood: boolean
}

type ComparisonColumnData = ComparisonColumn

const TABLE_METRICS: TableMetric[] = [
  { label: 'Revenue ($/hr)',       key: 'revenue_usd_hr',        unit: '$',   positiveIsGood: true  },
  { label: 'CO₂ (kg/hr)',          key: 'co2_kg_hr',             unit: 'kg',  positiveIsGood: false },
  { label: 'Travel Time Δ (%)',    key: 'travel_time_delta_pct', unit: '%',   positiveIsGood: false },
  { label: 'Evasion Rate (%)',     key: 'evasion_rate_pct',      unit: '%',   positiveIsGood: false },
]

function cellColor(
  values: (number | null)[],
  idx: number,
  positiveIsGood: boolean
): string {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return 'transparent'
  const v = values[idx]
  if (v === null) return 'transparent'
  const best  = positiveIsGood ? Math.max(...valid) : Math.min(...valid)
  const worst = positiveIsGood ? Math.min(...valid) : Math.max(...valid)
  if (v === best)  return '#27ae6022'
  if (v === worst) return '#e74c3c22'
  return 'transparent'
}

function cellTextColor(
  values: (number | null)[],
  idx: number,
  positiveIsGood: boolean
): string {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length < 2) return '#e0e0e0'
  const v = values[idx]
  if (v === null) return '#8899aa'
  const best  = positiveIsGood ? Math.max(...valid) : Math.min(...valid)
  const worst = positiveIsGood ? Math.min(...valid) : Math.max(...valid)
  if (v === best)  return '#27ae60'
  if (v === worst) return '#e74c3c'
  return '#e0e0e0'
}

const ComparisonTable: React.FC<{ result: ComparisonResult }> = ({ result }) => {
  const colData: ComparisonColumnData[] = [result.baseline, result.scenario_a, result.scenario_b]
  const colLabels = [result.baseline.label, result.scenario_a.label, result.scenario_b.label]

  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                padding: '6px 8px',
                color: '#8899aa',
                borderBottom: '1px solid #1a3a60',
                fontWeight: 600,
              }}
            >
              Metric
            </th>
            {colLabels.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: 'right',
                  padding: '6px 8px',
                  color: '#8899aa',
                  borderBottom: '1px solid #1a3a60',
                  fontWeight: 600,
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_METRICS.map((metric) => {
            const values = colData.map((d) => d.metrics[metric.key])
            return (
              <tr key={metric.key}>
                <td
                  style={{
                    padding: '6px 8px',
                    color: '#aabbcc',
                    borderBottom: '1px solid #112240',
                  }}
                >
                  {metric.label}
                </td>
                {values.map((v, i) => (
                  <td
                    key={i}
                    style={{
                      textAlign: 'right',
                      padding: '6px 8px',
                      background: cellColor(values, i, metric.positiveIsGood),
                      color: cellTextColor(values, i, metric.positiveIsGood),
                      fontWeight: 700,
                      borderBottom: '1px solid #112240',
                      borderRadius: 2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v !== null ? v.toFixed(1) : '—'}
                    {i > 0 && deltaBadge(v, values[0], metric.positiveIsGood)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

function deltaBadge(
  value: number | null,
  baseline: number | null,
  positiveIsGood: boolean
): React.ReactNode {
  if (value === null || baseline === null || baseline === 0) return null
  const delta = value - baseline
  const good = positiveIsGood ? delta > 0 : delta < 0
  const color = good ? '#27ae60' : '#e74c3c'
  const arrow = delta > 0 ? '▲' : '▼'
  return (
    <span style={{ fontSize: 10, color, marginLeft: 4, fontWeight: 700 }}>
      {arrow}{Math.abs(delta).toFixed(1)}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ComparisonScenario: React.FC<Props> = ({ onResult }) => {
  const [baseline, setBaseline] = useState<ScenarioDef>(makeDefault('toll'))
  const [scenarioA, setScenarioA] = useState<ScenarioDef>(makeDefault('corridor'))
  const [scenarioB, setScenarioB] = useState<ScenarioDef>(makeDefault('evasion'))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ComparisonResult | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('http://localhost:8000/api/v1/simulate/comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseline_scenario: { type: baseline.type, inputs: baseline.inputs },
          scenario_a: { type: scenarioA.type, inputs: scenarioA.inputs },
          scenario_b: { type: scenarioB.type, inputs: scenarioB.inputs },
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Server error ${resp.status}: ${text}`)
      }
      const data: ComparisonResult = await resp.json()
      setResult(data)
      onResult({ ...data, cesium_heatmap: data.cesium_diff_heatmap })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div
        style={{
          background: '#0a2744',
          border: '1px solid #1a3a60',
          borderRadius: 5,
          padding: '8px 12px',
          marginBottom: 14,
          fontSize: 11,
          color: '#7799bb',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#ccd8e8' }}>Model Architecture:</strong> Comparison runs 3
        independent scenario simulations in parallel.
        <br />
        Each column uses the full sub-model for its type (BPR for corridor,
        elasticity for toll, quadratic correction for emission, deterrence for evasion).
      </div>

      <div style={sectionLabelStyle}>Define Scenarios</div>

      <ScenarioCard title="Baseline" scenario={baseline} onChange={setBaseline} />
      <ScenarioCard title="Scenario A" scenario={scenarioA} onChange={setScenarioA} />
      <ScenarioCard title="Scenario B" scenario={scenarioB} onChange={setScenarioB} />

      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 0',
          background: loading ? '#555' : '#e94560',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          borderRadius: 6,
          marginBottom: 16,
          marginTop: 4,
          opacity: loading ? 0.7 : 1,
          transition: 'background 0.15s',
        }}
      >
        {loading ? 'Running...' : 'Run Comparison'}
      </button>

      {error && (
        <div
          style={{
            background: '#3a0a0a',
            border: '1px solid #e74c3c',
            color: '#e74c3c',
            borderRadius: 5,
            padding: '8px 12px',
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>Comparison Results</div>
          <div
            style={{
              background: '#0a2744',
              border: '1px solid #1a3a60',
              borderRadius: 6,
              padding: '8px 4px',
            }}
          >
            <ComparisonTable result={result} />
          </div>
        </div>
      )}
    </div>
  )
}

export default ComparisonScenario
