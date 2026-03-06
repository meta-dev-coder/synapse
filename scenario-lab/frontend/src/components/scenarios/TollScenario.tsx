import React, { useState } from 'react'
import { API } from '../../lib/api'
import SliderInput from '../ui/SliderInput'
import KpiCard from '../ui/KpiCard'
import KpiGrid from '../ui/KpiGrid'
import PerLaneTable, { type ColDef } from '../ui/PerLaneTable'
import MethodologyPanel from '../ui/MethodologyPanel'
import VehicleRateGrid, { type VehicleRates } from '../ui/VehicleRateGrid'
import SimulationLog from '../SimulationLog'
import type { SimulationResult } from '../../App'

interface Props {
  onResult: (result: SimulationResult) => void
  simDuration: number
}

interface TollLaneResult {
  lane_id: string
  revenue_simulated_usd_hr: number
  revenue_baseline_usd_hr: number
  volume_simulated_veh_hr: number
  volume_baseline_veh_hr: number
  evasion_rate_pct: number
  diversion_probability: number
  density_scalar: number
  vehicle_volumes_simulated: Record<string, number>
}

interface TollResult {
  revenue_delta_pct: number
  total_revenue_simulated_usd_hr: number
  total_revenue_baseline_usd_hr: number
  evasion_rate_projected_pct: number
  diversion_probability: number
  per_lane: TollLaneResult[]
  cesium_heatmap: Record<string, number>
  [key: string]: unknown
}

const sectionStyle: React.CSSProperties = { marginBottom: 18 }

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#e94560',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 10,
}

const groupHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#7799bb',
  textTransform: 'uppercase',
  letterSpacing: 1,
  padding: '5px 0 3px',
  borderBottom: '1px solid #1a3a60',
  marginBottom: 4,
  marginTop: 8,
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
  { key: 'lane_id',                    label: 'Lane',          align: 'left' },
  { key: 'lane_type',                  label: 'Type',          align: 'left' },
  {
    key: 'revenue_baseline_usd_hr',
    label: 'Base Rev ($)',
    format: (v) => `$${Number(v).toFixed(0)}`,
  },
  {
    key: 'revenue_simulated_usd_hr',
    label: 'Sim Rev ($)',
    format: (v) => `$${Number(v).toFixed(0)}`,
  },
  {
    key: 'rev_delta_pct',
    label: 'Rev Δ (%)',
    format: (v) => `${Number(v).toFixed(1)}%`,
  },
  {
    key: 'volume_simulated_veh_hr',
    label: 'Volume (veh/hr)',
    format: (v) => Number(v).toFixed(0),
  },
  {
    key: 'evasion_rate_pct',
    label: 'Evasion (%)',
    format: (v) => `${Number(v).toFixed(1)}%`,
  },
]

const LANE_TYPE_LABELS: Record<string, string> = {
  'NB-L1': 'HOV',  'NB-L2': 'ETC Fast', 'NB-L3': 'ETC Gen', 'NB-L4': 'Cash',
  'SB-L1': 'HOV',  'SB-L2': 'ETC Fast', 'SB-L3': 'ETC Gen', 'SB-L4': 'Cash',
}

function buildLaneRows(perLane: TollLaneResult[]): Record<string, unknown>[] {
  return perLane.map((lane) => {
    const delta =
      lane.revenue_baseline_usd_hr > 0
        ? ((lane.revenue_simulated_usd_hr - lane.revenue_baseline_usd_hr) /
            lane.revenue_baseline_usd_hr) *
          100
        : 0
    return {
      ...lane,
      lane_type: LANE_TYPE_LABELS[lane.lane_id] ?? '—',
      rev_delta_pct: delta,
    }
  })
}

const TollScenario: React.FC<Props> = ({ onResult, simDuration }) => {
  const [vehicleRates, setVehicleRates] = useState<VehicleRates>({
    car: 3.0,
    truck: 7.5,
    bus: 6.0,
    van: 4.0,
  })
  const [peakMultiplier, setPeakMultiplier] = useState(1.0)
  const [evExemption, setEvExemption] = useState(false)
  const [enforcementIntensity, setEnforcementIntensity] = useState(0.5)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TollResult | null>(null)

  const handleRateChange = (cls: string, val: number) => {
    setVehicleRates((prev) => ({ ...prev, [cls]: val }))
  }

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(API.toll, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_rates: vehicleRates,
          peak_multiplier: peakMultiplier,
          ev_exemption: evExemption,
          enforcement_intensity: enforcementIntensity,
          simulation_duration_sec: simDuration,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Server error ${resp.status}: ${text}`)
      }
      const data: TollResult = await resp.json()
      setResult(data)
      onResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const nbRows = result ? buildLaneRows(result.per_lane.filter((r) => r.lane_id.startsWith('NB'))) : []
  const sbRows = result ? buildLaneRows(result.per_lane.filter((r) => r.lane_id.startsWith('SB'))) : []

  return (
    <div>
      <div style={dataSourceStyle}>
        <strong style={{ color: '#ccd8e8' }}>Data Sources:</strong> Baseline: A10-West Toll Plaza
        · Weekday AM/PM Peak · 7,960 veh/hr total (8 lanes, NB + SB)
        <br />
        Baseline revenue: $28,130/hr · Source: Synthetic POC corridor (Amsterdam scale)
        <br />
        Elasticities sourced from VTPI Transport Demand Estimation literature.
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Vehicle Toll Rates ($/veh)</div>
        <VehicleRateGrid rates={vehicleRates} onChange={handleRateChange} />
      </div>

      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Traffic Parameters</div>
        <SliderInput
          label="Peak Hour Multiplier"
          min={0.5}
          max={3.0}
          step={0.05}
          value={peakMultiplier}
          onChange={setPeakMultiplier}
          formatValue={(v) => `×${v.toFixed(2)}`}
        />
        <SliderInput
          label="Enforcement Intensity"
          min={0}
          max={1}
          step={0.01}
          value={enforcementIntensity}
          onChange={setEnforcementIntensity}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            fontSize: 13,
            color: '#ccd8e8',
          }}
        >
          <input
            type="checkbox"
            checked={evExemption}
            onChange={(e) => setEvExemption(e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#e94560' }}
          />
          EV Toll Exemption
        </label>
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
          marginBottom: 8,
          opacity: loading ? 0.7 : 1,
          transition: 'background 0.15s',
          border: 'none',
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Running...' : 'Run Simulation'}
      </button>

      <SimulationLog isRunning={loading} simDuration={simDuration} />

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
              label="Revenue Δ"
              value={result.revenue_delta_pct.toFixed(1)}
              unit="%"
              delta={result.revenue_delta_pct}
              positive_is_good={true}
            />
            <KpiCard
              label="Total Revenue"
              value={`$${result.total_revenue_simulated_usd_hr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            />
            <KpiCard
              label="Evasion Rate"
              value={result.evasion_rate_projected_pct.toFixed(1)}
              unit="%"
              delta={result.evasion_rate_projected_pct}
              positive_is_good={false}
            />
            <KpiCard
              label="Diversion Prob."
              value={(result.diversion_probability * 100).toFixed(1)}
              unit="%"
            />
          </KpiGrid>

          {result.per_lane && result.per_lane.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabelStyle, marginBottom: 4 }}>Per-Lane Breakdown</div>
              <div style={groupHeaderStyle}>Northbound (NB)</div>
              <PerLaneTable columns={LANE_COLS} rows={nbRows} />
              <div style={groupHeaderStyle}>Southbound (SB)</div>
              <PerLaneTable columns={LANE_COLS} rows={sbRows} />
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
{`Model: Demand Elasticity + Logistic Diversion

Step 1 — Traffic volume per class:
  ΔV_cls = V_baseline × ε_cls × (ΔRate / Rate_baseline)
  Elasticities: Car −0.45 · Truck −0.20 · Bus −0.10 · Van −0.35

Step 2 — Revenue with peak & EV discount:
  Revenue = Σ (Rate_cls × Vol_cls_sim) × PeakMultiplier
  EV exemption: car revenue reduced by (EV fraction % per lane)

Step 3 — Evasion (multiplicative):
  p_evade = p_baseline × (1 + 0.3 × ΔRate%) × (1 − enforcement × 0.6)
  Clamped to [0.1%, 50%]

Step 4 — Diversion (logistic):
  P_divert = 1 / (1 + e^(−0.85 × (AvgΔ$ − 2.0)))
  Threshold: $2 avg rate increase → 50% diversion probability`}
        </pre>
      </MethodologyPanel>
    </div>
  )
}

export default TollScenario
