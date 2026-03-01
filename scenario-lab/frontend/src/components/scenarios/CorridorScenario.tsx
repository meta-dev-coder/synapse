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

interface CorridorLaneResult {
  lane_id: string
  is_closed: boolean
  volume_simulated_veh_hr: number
  capacity_effective_veh_hr: number
  travel_time_sec: number
  travel_time_delta_pct: number
  queue_veh: number
  queue_m: number
  congestion_scalar: number
}

interface CorridorResult {
  travel_time_delta_pct: number
  total_queue_length_m: number
  throughput_reduction_pct: number
  per_lane: CorridorLaneResult[]
  cesium_heatmap: Record<string, number>
  [key: string]: unknown
}

const LANES = ['L1', 'L2', 'L3', 'L4'] as const
const LANE_LABELS: Record<string, string> = {
  L1: 'L1 — HOV/Express',
  L2: 'L2 — ETC',
  L3: 'L3 — ETC',
  L4: 'L4 — Cash',
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
  { key: 'lane_id',                      label: 'Lane',             align: 'left' },
  {
    key: 'status',
    label: 'Status',
    align: 'left',
    redWhenTrue: 'is_closed',
    format: (_v, row) =>
      row['is_closed'] ? 'CLOSED' : 'OPEN',
  },
  {
    key: 'volume_simulated_veh_hr',
    label: 'Volume (veh/hr)',
    format: (v) => Number(v).toFixed(0),
  },
  {
    key: 'capacity_effective_veh_hr',
    label: 'Cap Eff (veh/hr)',
    format: (v) => Number(v).toFixed(0),
  },
  {
    key: 'travel_time_sec',
    label: 'TT (s)',
    format: (v) => Number(v).toFixed(0),
  },
  {
    key: 'travel_time_delta_pct',
    label: 'TT Δ (%)',
    format: (v) => `${Number(v).toFixed(1)}%`,
  },
  {
    key: 'queue_m',
    label: 'Queue (m)',
    format: (v) => Number(v).toFixed(0),
  },
]

const CorridorScenario: React.FC<Props> = ({ onResult }) => {
  const [closedLanes, setClosedLanes] = useState<string[]>([])
  const [capacityReductionPct, setCapacityReductionPct] = useState(0)
  const [weatherFactor, setWeatherFactor] = useState(1.0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CorridorResult | null>(null)

  const toggleLane = (laneId: string) => {
    setClosedLanes((prev) =>
      prev.includes(laneId) ? prev.filter((l) => l !== laneId) : [...prev, laneId]
    )
  }

  const openLaneCount = result
    ? result.per_lane.filter((l) => !l.is_closed).length
    : LANES.length - closedLanes.length

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('http://localhost:8000/api/v1/simulate/corridor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closed_lanes: closedLanes,
          capacity_reduction_pct: capacityReductionPct,
          weather_factor: weatherFactor,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Server error ${resp.status}: ${text}`)
      }
      const data: CorridorResult = await resp.json()
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
        <strong style={{ color: '#ccd8e8' }}>Data Sources:</strong> Baseline: A10-West · 2.5 km
        corridor · 6,200 veh/hr design capacity
        <br />
        BPR parameters: α = 0.15, β = 4.0 (HCM standard) · Avg vehicle spacing 6.5 m
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Closed Lanes</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LANES.map((laneId) => (
            <label
              key={laneId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                fontSize: 13,
                color: closedLanes.includes(laneId) ? '#e94560' : '#ccd8e8',
                background: '#0a2744',
                border: `1px solid ${closedLanes.includes(laneId) ? '#e94560' : '#1a3a60'}`,
                borderRadius: 5,
                padding: '7px 10px',
                transition: 'all 0.15s',
              }}
            >
              <input
                type="checkbox"
                checked={closedLanes.includes(laneId)}
                onChange={() => toggleLane(laneId)}
                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#e94560' }}
              />
              {LANE_LABELS[laneId]}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Capacity Parameters</div>
        <SliderInput
          label="Additional Capacity Reduction"
          min={0}
          max={80}
          step={1}
          value={capacityReductionPct}
          onChange={setCapacityReductionPct}
          unit="%"
          formatValue={(v) => `${v.toFixed(0)}%`}
        />
        <SliderInput
          label="Weather Impact Factor"
          min={0.5}
          max={1.5}
          step={0.01}
          value={weatherFactor}
          onChange={setWeatherFactor}
          formatValue={(v) => `×${v.toFixed(2)}`}
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
              label="Travel Time Δ"
              value={result.travel_time_delta_pct.toFixed(1)}
              unit="%"
              delta={result.travel_time_delta_pct}
              positive_is_good={false}
            />
            <KpiCard
              label="Queue Length"
              value={result.total_queue_length_m.toFixed(0)}
              unit="m"
            />
            <KpiCard
              label="Throughput Reduction"
              value={result.throughput_reduction_pct.toFixed(1)}
              unit="%"
              delta={-result.throughput_reduction_pct}
              positive_is_good={true}
            />
            <KpiCard
              label="Open Lanes"
              value={`${openLaneCount} / ${LANES.length}`}
            />
          </KpiGrid>

          {result.per_lane && result.per_lane.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...sectionLabelStyle, marginBottom: 6 }}>Per-Lane Breakdown</div>
              <PerLaneTable
                columns={LANE_COLS}
                rows={result.per_lane as unknown as Record<string, unknown>[]}
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
{`Model: Bureau of Public Roads (BPR) Travel-Time Function

Step 1 — Effective capacity:
  c_eff = c_baseline × (1 − cap_reduction%) × weather_factor
  Closed lanes: c_eff = 0

Step 2 — Traffic redistribution:
  Displaced volume absorbed proportionally by open lanes:
  ΔV_open = V_closed × (c_eff_open / Σ c_eff_open)

Step 3 — BPR travel time:
  t(v) = t_free × [1 + 0.15 × (v / c_eff)^4]

Step 4 — Queue:
  Queue_veh = max(0, V_sim − c_eff)
  Queue_m   = Queue_veh × 6.5 m (avg spacing incl. headway)

Data: Baseline free-flow times from baseline_data.py
  L1 90 s · L2 112 s · L3 112 s · L4 300 s`}
        </pre>
      </MethodologyPanel>
    </div>
  )
}

export default CorridorScenario
