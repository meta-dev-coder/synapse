import React, { useState } from 'react'
import SliderInput from '../ui/SliderInput'
import KpiCard from '../ui/KpiCard'
import KpiGrid from '../ui/KpiGrid'
import PerLaneTable, { type ColDef } from '../ui/PerLaneTable'
import MethodologyPanel from '../ui/MethodologyPanel'
import type { SimulationResult } from '../../App'

interface Props {
  onResult: (result: SimulationResult) => void
}

interface EvasionLaneResult {
  lane_id: string
  evasion_rate_baseline_pct: number
  evasion_rate_simulated_pct: number
  revenue_leakage_baseline_usd_hr: number
  revenue_leakage_simulated_usd_hr: number
  risk_scalar: number
}

interface EvasionResult {
  evasion_rate_projected_pct: number
  revenue_leakage_reduction_pct: number
  total_leakage_baseline_usd_hr: number
  total_leakage_simulated_usd_hr: number
  per_lane: EvasionLaneResult[]
  cesium_heatmap: Record<string, number>
  [key: string]: unknown
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#e94560',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 10,
}

const dataSourceStyle: React.CSSProperties = {
  background: '#0a2744',
  border: '1px solid #1a3a60',
  borderRadius: 5,
  padding: '8px 12px',
  marginBottom: 14,
  fontSize: 11,
  color: '#7799bb',
  lineHeight: 1.6,
}

const LANE_COLS: ColDef[] = [
  { key: 'lane_id',                         label: 'Lane',               align: 'left' },
  { key: 'evasion_rate_baseline_pct',        label: 'Baseline %',         format: (v) => `${Number(v).toFixed(1)}%` },
  { key: 'evasion_rate_simulated_pct',       label: 'Simulated %',        format: (v) => `${Number(v).toFixed(1)}%` },
  {
    key: 'delta_pts',
    label: 'Δ pts',
    format: (v) => {
      const n = Number(v)
      return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`
    },
  },
  {
    key: 'leakage_saved',
    label: 'Leakage Saved ($/hr)',
    format: (v) => `$${Number(v).toFixed(0)}`,
  },
  { key: 'risk_scalar',                      label: 'Risk Score',         format: (v) => Number(v).toFixed(2) },
]

function buildLaneRows(perLane: EvasionLaneResult[]): Record<string, unknown>[] {
  return perLane.map((lane) => ({
    ...lane,
    delta_pts: lane.evasion_rate_simulated_pct - lane.evasion_rate_baseline_pct,
    leakage_saved: lane.revenue_leakage_baseline_usd_hr - lane.revenue_leakage_simulated_usd_hr,
  }))
}

const EvasionScenario: React.FC<Props> = ({ onResult }) => {
  const [tollIncreasePct, setTollIncreasePct] = useState(20)
  const [detectionAccuracy, setDetectionAccuracy] = useState(0.72)
  const [patrolFrequency, setPatrolFrequency] = useState(0.35)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EvasionResult | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('http://localhost:8000/api/v1/simulate/evasion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toll_increase_pct: tollIncreasePct,
          detection_accuracy: detectionAccuracy,
          patrol_frequency: patrolFrequency,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Server error ${resp.status}: ${text}`)
      }
      const data: EvasionResult = await resp.json()
      setResult(data)
      onResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Data Sources */}
      <div style={dataSourceStyle}>
        <strong style={{ color: '#ccd8e8' }}>Data Sources:</strong> Baseline evasion: L1 1.2% ·
        L2 3.8% · L3 4.1% · L4 18.5%
        <br />
        Baseline leakage: $1,067/hr (7.2% corridor avg)
        <br />
        Evasion elasticities: Car 0.35 · Truck 0.15 · Bus 0.08 · Van 0.28
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Toll Policy</div>
        <SliderInput
          label="Toll Increase"
          min={0}
          max={100}
          step={1}
          value={tollIncreasePct}
          onChange={setTollIncreasePct}
          unit="%"
          formatValue={(v) => `+${v.toFixed(0)}%`}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Enforcement Parameters</div>
        <SliderInput
          label="Detection Accuracy"
          min={0}
          max={1}
          step={0.01}
          value={detectionAccuracy}
          onChange={setDetectionAccuracy}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <SliderInput
          label="Patrol Frequency"
          min={0}
          max={1}
          step={0.01}
          value={patrolFrequency}
          onChange={setPatrolFrequency}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
        />
      </div>

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
          opacity: loading ? 0.7 : 1,
          transition: 'background 0.15s',
          border: 'none',
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Running...' : 'Run Simulation'}
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
          <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>Results</div>

          <KpiGrid>
            <KpiCard
              label="Evasion Rate"
              value={result.evasion_rate_projected_pct.toFixed(1)}
              unit="%"
              delta={result.evasion_rate_projected_pct}
              positive_is_good={false}
            />
            <KpiCard
              label="Leakage Reduction"
              value={result.revenue_leakage_reduction_pct.toFixed(1)}
              unit="%"
              delta={result.revenue_leakage_reduction_pct}
              positive_is_good={true}
            />
            <KpiCard
              label="Leakage Baseline"
              value={
                result.total_leakage_baseline_usd_hr != null
                  ? `$${result.total_leakage_baseline_usd_hr.toFixed(0)}`
                  : '—'
              }
              unit="/hr"
            />
            <KpiCard
              label="Leakage Simulated"
              value={
                result.total_leakage_simulated_usd_hr != null
                  ? `$${result.total_leakage_simulated_usd_hr.toFixed(0)}`
                  : '—'
              }
              unit="/hr"
            />
          </KpiGrid>

          {result.per_lane && result.per_lane.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>Per-Lane Breakdown</div>
              <PerLaneTable
                columns={LANE_COLS}
                rows={buildLaneRows(result.per_lane)}
              />
            </div>
          )}
        </div>
      )}

      <MethodologyPanel title="Model Methodology">
        <pre
          style={{
            margin: 0,
            fontSize: 10,
            lineHeight: 1.6,
            color: '#7799bb',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}
        >
{`Model: Multiplicative Deterrence Model

Step 1 — Evasion pressure from toll increase:
  avg_ε = Σ(ε_cls × Vol_cls) / Σ Vol_cls
  pressure = 1 + avg_ε × (toll_increase_pct / 100)

Step 2 — Detection deterrence:
  deterrence = 1 − detection_accuracy × 0.8
  (At 100% accuracy → 80% reduction in evasion rate)

Step 3 — Patrol modifier:
  patrol_mod = 1 − patrol_frequency × 0.35
  (Max patrol effect: 35% reduction)

Step 4 — Simulated evasion:
  p_evade = p_baseline × pressure × deterrence × patrol_mod
  Clamped to [0.5%, 40%]

Step 5 — Revenue leakage:
  Leakage = Vol_lane × p_evade × avg_weighted_rate`}
        </pre>
      </MethodologyPanel>
    </div>
  )
}

export default EvasionScenario
