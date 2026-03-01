import React, { useState } from 'react'
import type { SimulationResult } from '../../App'
import { ASSETS, computeHealthScore } from '../../data/assetInventory'
import SliderInput from '../ui/SliderInput'
import MethodologyPanel from '../ui/MethodologyPanel'

interface Props {
  onResult: (result: SimulationResult) => void
}

interface MaintInputs {
  tollIncreasePct: number
  truckIncreasePct: number
  closedLanes: string[]
  weatherSeverity: number
  operatingHrsExt: number
  trafficGrowthPct: number
  extremeWeather: boolean
}

interface AssetProjection {
  id: string
  type: string
  currentHealth: number
  newHealthScore: number
  newRUL: number
  failProb: number
  crossesThreshold: boolean
  stressMult: number
  etfDays: number
  recommendation: string
}

const TODAY = new Date()
const LANES = ['L1', 'L2', 'L3', 'L4']

function computeStressMultiplier(inputs: MaintInputs): number {
  const effectiveWeather = inputs.extremeWeather
    ? Math.min(1, inputs.weatherSeverity + 0.4)
    : inputs.weatherSeverity
  const trafficIdx = Math.min(1, (1 + inputs.trafficGrowthPct / 100) * (1 + inputs.truckIncreasePct / 100 * 0.3))
  const weightFactor = Math.min(1, 1 + inputs.truckIncreasePct / 100 * 0.5)
  const weatherIdx = effectiveWeather
  const timeIdx = Math.min(1, (8 + inputs.operatingHrsExt) / 12)
  return 0.4 * trafficIdx + 0.3 * weightFactor + 0.2 * weatherIdx + 0.1 * timeIdx
}

function simulateForward(inputs: MaintInputs, days: number): AssetProjection[] {
  const stressMult = computeStressMultiplier(inputs)
  return ASSETS.map((asset) => {
    const health = computeHealthScore(asset, TODAY)
    const lifecycleDays = asset.lifecycle_years * 365.25
    const baseDegradation = 1 / lifecycleDays
    const adjDegradation = baseDegradation * stressMult

    const newHealthScore = Math.max(0, health.healthScore - adjDegradation * days * 100)
    const newRUL = Math.max(0, health.rul - adjDegradation * days * asset.lifecycle_years)
    const failProb = Math.min(99, Math.round((1 - newHealthScore / 100) * 40 * (days / 30)))
    const crossesThreshold = newHealthScore < 50 && health.healthScore >= 50

    const etfDays =
      adjDegradation > 0
        ? Math.round((health.healthScore / 100) / adjDegradation)
        : 99999

    let recommendation = 'No action required'
    if (failProb > 60) {
      recommendation = 'Schedule immediate inspection'
    } else if (crossesThreshold) {
      recommendation = 'Preventive replacement recommended'
    } else if (stressMult > 1.3) {
      recommendation = 'Monitor closely under current conditions'
    }

    return {
      id: asset.id,
      type: asset.type,
      currentHealth: health.healthScore,
      newHealthScore: Math.round(newHealthScore),
      newRUL,
      failProb,
      crossesThreshold,
      stressMult,
      etfDays,
      recommendation,
    }
  })
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

function healthColor(score: number): string {
  if (score > 75) return '#27ae60'
  if (score >= 50) return '#f39c12'
  return '#e74c3c'
}

const PredictiveMaintScenario: React.FC<Props> = () => {
  const [inputs, setInputs] = useState<MaintInputs>({
    tollIncreasePct: 20,
    truckIncreasePct: 10,
    closedLanes: [],
    weatherSeverity: 0.3,
    operatingHrsExt: 0,
    trafficGrowthPct: 5,
    extremeWeather: false,
  })
  const [projections, setProjections] = useState<AssetProjection[] | null>(null)
  const [simDays, setSimDays] = useState<number | null>(null)

  const handleSim = (days: number) => {
    setSimDays(days)
    setProjections(simulateForward(inputs, days))
  }

  const toggleLane = (laneId: string) => {
    setInputs((prev) => ({
      ...prev,
      closedLanes: prev.closedLanes.includes(laneId)
        ? prev.closedLanes.filter((l) => l !== laneId)
        : [...prev.closedLanes, laneId],
    }))
  }

  return (
    <div>
      {/* Data Sources */}
      <div style={dataSourceStyle}>
        <strong style={{ color: '#ccd8e8' }}>Data Sources:</strong> Same 9-asset inventory as Asset
        Health module · Stress-adjusted linear degradation model
        <br />
        No backend call — computed entirely in the browser.
      </div>

      {/* Inputs */}
      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabelStyle}>Traffic &amp; Load</div>
        <SliderInput
          label="Toll Increase"
          min={0} max={100} step={1}
          value={inputs.tollIncreasePct}
          onChange={(v) => setInputs((p) => ({ ...p, tollIncreasePct: v }))}
          formatValue={(v) => `+${v.toFixed(0)}%`}
        />
        <SliderInput
          label="Truck Traffic Increase"
          min={0} max={100} step={1}
          value={inputs.truckIncreasePct}
          onChange={(v) => setInputs((p) => ({ ...p, truckIncreasePct: v }))}
          formatValue={(v) => `+${v.toFixed(0)}%`}
        />
        <SliderInput
          label="Traffic Growth"
          min={0} max={50} step={1}
          value={inputs.trafficGrowthPct}
          onChange={(v) => setInputs((p) => ({ ...p, trafficGrowthPct: v }))}
          formatValue={(v) => `+${v.toFixed(0)}%`}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabelStyle}>Lane Closure</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LANES.map((lane) => (
            <label
              key={lane}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: inputs.closedLanes.includes(lane) ? '#e94560' : '#ccd8e8',
                cursor: 'pointer',
                background: '#0a2744',
                border: `1px solid ${inputs.closedLanes.includes(lane) ? '#e94560' : '#1a3a60'}`,
                borderRadius: 4,
                padding: '4px 8px',
              }}
            >
              <input
                type="checkbox"
                checked={inputs.closedLanes.includes(lane)}
                onChange={() => toggleLane(lane)}
                style={{ accentColor: '#e94560' }}
              />
              {lane}
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={sectionLabelStyle}>Environment</div>
        <SliderInput
          label="Weather Severity"
          min={0} max={1} step={0.05}
          value={inputs.weatherSeverity}
          onChange={(v) => setInputs((p) => ({ ...p, weatherSeverity: v }))}
          formatValue={(v) => {
            if (v < 0.2) return 'Clear'
            if (v < 0.5) return 'Moderate'
            if (v < 0.8) return 'Severe'
            return 'Extreme'
          }}
        />
        <SliderInput
          label="Operating Hours Ext."
          min={0} max={4} step={0.5}
          value={inputs.operatingHrsExt}
          onChange={(v) => setInputs((p) => ({ ...p, operatingHrsExt: v }))}
          formatValue={(v) => `+${v.toFixed(1)} hr/day`}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: inputs.extremeWeather ? '#e94560' : '#ccd8e8',
            cursor: 'pointer',
            marginTop: 6,
          }}
        >
          <input
            type="checkbox"
            checked={inputs.extremeWeather}
            onChange={(e) => setInputs((p) => ({ ...p, extremeWeather: e.target.checked }))}
            style={{ accentColor: '#e94560' }}
          />
          Extreme Weather Event
        </label>
      </div>

      {/* Simulation buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => handleSim(30)}
          style={{
            flex: 1,
            padding: '9px 0',
            background: simDays === 30 ? '#e94560' : '#0a2744',
            color: simDays === 30 ? '#fff' : '#ccd8e8',
            fontWeight: 700,
            fontSize: 12,
            borderRadius: 5,
            border: `1px solid ${simDays === 30 ? '#e94560' : '#1a3a60'}`,
            cursor: 'pointer',
          }}
        >
          Simulate 30 Days
        </button>
        <button
          type="button"
          onClick={() => handleSim(90)}
          style={{
            flex: 1,
            padding: '9px 0',
            background: simDays === 90 ? '#e94560' : '#0a2744',
            color: simDays === 90 ? '#fff' : '#ccd8e8',
            fontWeight: 700,
            fontSize: 12,
            borderRadius: 5,
            border: `1px solid ${simDays === 90 ? '#e94560' : '#1a3a60'}`,
            cursor: 'pointer',
          }}
        >
          Simulate 90 Days
        </button>
      </div>

      {/* Results table */}
      {projections && (
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabelStyle}>
            Projections ({simDays}-day forward simulation)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 10,
                background: '#06192e',
              }}
            >
              <thead>
                <tr style={{ background: '#5577aa' }}>
                  {[
                    'Asset', 'Cur. H%', 'Proj. H%', 'Stress×',
                    'Fail%', 'ETF (d)', 'Recommendation',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '5px 6px',
                        color: '#e0e0e0',
                        fontWeight: 700,
                        textAlign: h === 'Asset' || h === 'Recommendation' ? 'left' : 'right',
                        whiteSpace: 'nowrap',
                        borderBottom: '1px solid #1a3a60',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projections.map((p) => {
                  const critical = p.failProb > 60 || p.crossesThreshold
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #1a3a60',
                        background: critical ? 'rgba(200,50,50,0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '4px 6px', color: '#ccd8e8', whiteSpace: 'nowrap' }}>
                        {p.id}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          color: healthColor(p.currentHealth),
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.currentHealth}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          color: healthColor(p.newHealthScore),
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.newHealthScore}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          color: '#aabbcc',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.stressMult.toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          color: p.failProb > 60 ? '#e74c3c' : p.failProb > 30 ? '#f39c12' : '#27ae60',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.failProb}%
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          textAlign: 'right',
                          color: '#aabbcc',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.etfDays > 9999 ? '∞' : p.etfDays}
                      </td>
                      <td
                        style={{
                          padding: '4px 6px',
                          color: critical ? '#e74c3c' : '#7799bb',
                          fontSize: 10,
                        }}
                      >
                        {p.recommendation}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Methodology */}
      <MethodologyPanel title="Predictive Maintenance Model">
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
{`Predictive Maintenance Model — Stress-Adjusted Degradation

Step 1 — Stress Multiplier:
  SM = 0.4 × Traffic Volume Index
     + 0.3 × Vehicle Weight Factor
     + 0.2 × Weather Severity Index
     + 0.1 × Operating Time Factor

Step 2 — Adjusted daily degradation:
  AdjDeg = (1 / lifecycle_days) × SM

Step 3 — Forward simulation:
  Health_t = Health_0 − (AdjDeg × days × 100)
  RUL_t = RUL_0 − (AdjDeg × days × lifecycle_years)

Step 4 — Failure probability:
  FailProb = min(99%, Degradation_fraction × 40% × (days/30))

Baseline degradation assumes linear lifecycle consumption.
Stress multiplier compounds the degradation rate multiplicatively.

ETF (days to failure) = (Health_0 / 100) / AdjDeg_per_day`}
        </pre>
      </MethodologyPanel>
    </div>
  )
}

export default PredictiveMaintScenario
