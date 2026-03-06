import React, { useState } from 'react'
import { API } from '../../lib/api'
import SliderInput from '../ui/SliderInput'
import KpiCard from '../ui/KpiCard'
import KpiGrid from '../ui/KpiGrid'
import PerLaneTable, { type ColDef } from '../ui/PerLaneTable'
import MethodologyPanel from '../ui/MethodologyPanel'
import SimulationLog from '../SimulationLog'
import type { SimulationResult } from '../../App'

interface Props {
  onResult: (result: SimulationResult) => void
  simDuration: number
}

interface VehicleMixPct {
  car: number
  truck: number
  bus: number
  van: number
}

interface EmissionLaneResult {
  lane_id: string
  co2_kg_hr: number
  nox_g_hr: number
  co2_baseline_kg_hr: number
  nox_baseline_kg_hr: number
  speed_kmh: number
  emission_scalar: number
  vehicle_volumes_redistributed: Record<string, number>
}

interface EmissionResult {
  co2_delta_pct: number
  nox_delta_pct: number
  total_co2_kg_hr: number
  total_nox_g_hr: number
  total_co2_baseline_kg_hr: number
  total_nox_baseline_g_hr: number
  per_lane: EmissionLaneResult[]
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

const VEHICLE_KEYS: Array<{ key: keyof VehicleMixPct; label: string; icon: string }> = [
  { key: 'car',   label: 'Car',   icon: '🚗' },
  { key: 'truck', label: 'Truck', icon: '🚛' },
  { key: 'bus',   label: 'Bus',   icon: '🚌' },
  { key: 'van',   label: 'Van',   icon: '🚐' },
]

const LANE_COLS: ColDef[] = [
  { key: 'lane_id',              label: 'Lane',              align: 'left' },
  { key: 'speed_kmh',            label: 'Speed (km/h)',      format: (v) => Number(v).toFixed(0) },
  { key: 'co2_baseline_kg_hr',   label: 'CO₂ Base (kg/hr)', format: (v) => Number(v).toFixed(1) },
  { key: 'co2_kg_hr',            label: 'CO₂ Sim (kg/hr)',  format: (v) => Number(v).toFixed(1) },
  {
    key: 'co2_delta_pct',
    label: 'CO₂ Δ (%)',
    format: (v) => `${Number(v).toFixed(1)}%`,
  },
  { key: 'nox_g_hr',             label: 'NOₓ Sim (g/hr)',   format: (v) => Number(v).toFixed(0) },
]

function buildLaneRows(perLane: EmissionLaneResult[]): Record<string, unknown>[] {
  return perLane.map((lane) => {
    const co2Delta =
      lane.co2_baseline_kg_hr > 0
        ? ((lane.co2_kg_hr - lane.co2_baseline_kg_hr) / lane.co2_baseline_kg_hr) * 100
        : 0
    return { ...lane, co2_delta_pct: co2Delta }
  })
}

const EmissionScenario: React.FC<Props> = ({ onResult, simDuration }) => {
  const [vehicleMixPct, setVehicleMixPct] = useState<VehicleMixPct>({
    car: 60,
    truck: 20,
    bus: 10,
    van: 10,
  })
  const [speedDeltaKmh, setSpeedDeltaKmh] = useState(0)
  const [idlingTimeMin, setIdlingTimeMin] = useState(3.2)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EmissionResult | null>(null)

  const totalPct = Object.values(vehicleMixPct).reduce((a, b) => a + b, 0)

  const handleMixChange = (key: keyof VehicleMixPct, val: number) => {
    setVehicleMixPct((prev) => ({ ...prev, [key]: val }))
  }

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(API.emission, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_mix_pct: vehicleMixPct,
          speed_delta_kmh: speedDeltaKmh,
          idling_time_min: idlingTimeMin,
          simulation_duration_sec: simDuration,
        }),
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`Server error ${resp.status}: ${text}`)
      }
      const data: EmissionResult = await resp.json()
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
        <strong style={{ color: '#ccd8e8' }}>Data Sources:</strong> Baseline: 3,490 kg CO₂/hr ·
        17,500 g NOₓ/hr (weekday peak, 8 lanes NB + SB)
        <br />
        Emission factors: HBEFA-style reference factors per vehicle class
        <br />
        Baseline avg speed 64 km/h · Baseline idling 3.2 min/veh
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>
          Vehicle Mix (%)
          {totalPct !== 100 && (
            <span style={{ marginLeft: 8, color: '#e74c3c', fontSize: 10, fontWeight: 400 }}>
              Total: {totalPct}% (should be 100)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {VEHICLE_KEYS.map(({ key, label, icon }) => (
            <SliderInput
              key={key}
              label={`${icon} ${label}`}
              min={0}
              max={100}
              step={1}
              value={vehicleMixPct[key]}
              onChange={(v) => handleMixChange(key, v)}
              unit="%"
              formatValue={(v) => `${v.toFixed(0)}%`}
            />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Driving Conditions</div>
        <SliderInput
          label="Speed Delta"
          min={-30}
          max={30}
          step={1}
          value={speedDeltaKmh}
          onChange={setSpeedDeltaKmh}
          unit=" km/h"
          formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)} km/h`}
        />
        <SliderInput
          label="Average Idling Time"
          min={0}
          max={15}
          step={0.1}
          value={idlingTimeMin}
          onChange={setIdlingTimeMin}
          unit=" min"
          formatValue={(v) => `${v.toFixed(1)} min`}
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
              label="CO₂ Δ"
              value={result.co2_delta_pct.toFixed(1)}
              unit="%"
              delta={result.co2_delta_pct}
              positive_is_good={false}
            />
            <KpiCard
              label="NOₓ Δ"
              value={result.nox_delta_pct.toFixed(1)}
              unit="%"
              delta={result.nox_delta_pct}
              positive_is_good={false}
            />
            <KpiCard
              label="Total CO₂"
              value={result.total_co2_kg_hr.toFixed(1)}
              unit="kg/hr"
            />
            <KpiCard
              label="Total NOₓ"
              value={result.total_nox_g_hr != null ? result.total_nox_g_hr.toFixed(0) : '—'}
              unit="g/hr"
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
{`Model: Quadratic Speed-Correction Emission Factor

Step 1 — Redistribute volumes by requested vehicle_mix_pct:
  V_cls = V_lane_total × mix_frac_cls

Step 2 — Simulated speed:
  speed_sim = baseline_speed + speed_delta  (min 1 km/h)

Step 3 — Speed correction (parabolic):
  correction = 1 + 0.003 × (speed_sim − speed_optimal_cls)² / 100
  Optimal speeds: Car 80 · Truck 75 · Bus 70 · Van 80 km/h

Step 4 — Emissions per vehicle (per km):
  CO₂ = factor_cls × correction × 2.5 km + idle_CO₂_cls × idling_min
  NOₓ = nox_factor_cls × correction × 2.5 km

CO₂ factors (g/veh·km): Car 180, Truck 820, Bus 650, Van 300
NOₓ factors (mg/veh·km): Car 150, Truck 1200, Bus 900, Van 400
Idle CO₂ (g/min): Car 5, Truck 30, Bus 25, Van 10`}
        </pre>
      </MethodologyPanel>
    </div>
  )
}

export default EmissionScenario
