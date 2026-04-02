import React, { useEffect, useState, useCallback, useRef } from 'react'
import { api, DenverPulseDashboardResponse, DenverPulseAlert, DenverPulseTrends, TrafficSimVehicle } from './api'
import DenverPulseCesiumMap from './DenverPulseCesiumMap'
import useTrafficSimLoop from './useTrafficSimLoop'

type MapMetric = 'ghg' | 'mode' | 'speed' | 'congestion'
type TrendMetric = 'emissions' | 'modeshift'
type TrendRange = '7d' | '30d' | 'ytd'

// ---------------------------------------------------------------------------
// Inline SVG trend chart
// ---------------------------------------------------------------------------

const TREND_COLORS: Record<string, string> = {
  emissions: '#3b82f6',
  car: '#f97316',
  pt: '#3b82f6',
  bike: '#10b981',
  walk: '#8b5cf6',
}

function TrendChart({ trends, trendMetric }: { trends: DenverPulseTrends; trendMetric: TrendMetric }) {
  const W = 600
  const H = 180
  const PAD = { top: 14, right: 14, bottom: 28, left: 48 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom

  const series: { key: string; data: number[]; color: string }[] =
    trendMetric === 'emissions'
      ? [{ key: 'emissions', data: trends.emissions ?? [], color: TREND_COLORS.emissions }]
      : [
          { key: 'car', data: trends.car_pct ?? [], color: TREND_COLORS.car },
          { key: 'pt', data: trends.pt_pct ?? [], color: TREND_COLORS.pt },
          { key: 'bike', data: trends.bike_pct ?? [], color: TREND_COLORS.bike },
          { key: 'walk', data: trends.walk_pct ?? [], color: TREND_COLORS.walk },
        ]

  // Compute global min/max across all visible series
  let allVals: number[] = []
  for (const s of series) allVals = allVals.concat(s.data)

  // Guard: no data → show placeholder
  if (allVals.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
        No trend data available
      </div>
    )
  }

  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1

  // Normalize labels to match data length
  const dataLen = series[0]?.data.length ?? 0
  const labels = (trends.labels ?? []).slice(0, dataLen)

  function toPoints(data: number[]): string {
    return data
      .map((v, i) => {
        const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * cw : cw / 2)
        const y = PAD.top + ch - ((v - minV) / range) * ch
        return `${x},${y}`
      })
      .join(' ')
  }

  const labelStep = Math.max(1, Math.floor(labels.length / 6))

  // Format Y-axis values compactly
  const fmtY = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="xMidYMid meet">
      {/* Y-axis labels */}
      <text x={PAD.left - 6} y={PAD.top + 4} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">
        {fmtY(maxV)}
      </text>
      <text x={PAD.left - 6} y={PAD.top + ch} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">
        {fmtY(minV)}
      </text>
      {/* Y-axis gridlines */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left + cw} y2={PAD.top} stroke="#f3f4f6" strokeWidth={1} />
      <line x1={PAD.left} y1={PAD.top + ch / 2} x2={PAD.left + cw} y2={PAD.top + ch / 2} stroke="#f3f4f6" strokeWidth={1} strokeDasharray="4 4" />
      <line x1={PAD.left} y1={PAD.top + ch} x2={PAD.left + cw} y2={PAD.top + ch} stroke="#f3f4f6" strokeWidth={1} />
      {/* Data lines */}
      {series.map(s => (
        <polyline
          key={s.key}
          points={toPoints(s.data)}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {/* X-axis labels */}
      {labels.map((label, i) =>
        i % labelStep === 0 ? (
          <text
            key={i}
            x={PAD.left + (labels.length > 1 ? (i / (labels.length - 1)) * cw : cw / 2)}
            y={H - 6}
            fontSize="10"
            fill="#9ca3af"
            textAnchor="middle"
            dominantBaseline="auto"
          >
            {label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Alert item
// ---------------------------------------------------------------------------

const ALERT_STYLES: Record<string, { bg: string; border: string }> = {
  red: { bg: '#fef2f2', border: '#fecaca' },
  orange: { bg: '#fff7ed', border: '#fed7aa' },
  green: { bg: '#ecfdf5', border: '#a7f3d0' },
  blue: { bg: '#eff6ff', border: '#bfdbfe' },
  yellow: { bg: '#fefce8', border: '#fde68a' },
}

function AlertItem({ alert }: { alert: DenverPulseAlert }) {
  const s = ALERT_STYLES[alert.level] ?? ALERT_STYLES.blue
  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 6,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{alert.title}</div>
      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{alert.description}</div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{alert.timestamp}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: trend arrow
// ---------------------------------------------------------------------------

function TrendBadge({ value, positiveIsGood }: { value: number; positiveIsGood: boolean }) {
  const up = value > 0
  const good = positiveIsGood ? up : !up
  const color = good ? '#16a34a' : '#dc2626'
  const arrow = up ? '\u25B2' : '\u25BC'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, marginLeft: 6 }}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  )
}

// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  padding: 16,
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const DenverPulseDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DenverPulseDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMetric, setActiveMetric] = useState<MapMetric>('ghg')
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('emissions')
  const [trendRange, setTrendRange] = useState<TrendRange>('7d')

  // Synthetic vehicle animation state
  const [simVehicles, setSimVehicles] = useState<TrafficSimVehicle[] | null>(null)
  const repathingRef = useRef(false)

  const onNeedRepath = useCallback((count: number) => {
    if (repathingRef.current) return
    repathingRef.current = true
    api.repathTrafficDots({ count })
      .then(data => {
        if (mergeRef.current) mergeRef.current(data.vehicles)
      })
      .catch(err => console.warn('Dashboard repath failed:', err))
      .finally(() => { repathingRef.current = false })
  }, [])

  const { positions, mergeVehicles } = useTrafficSimLoop(simVehicles, true, 1, onNeedRepath)
  const mergeRef = useRef<((v: TrafficSimVehicle[]) => void) | null>(null)
  mergeRef.current = mergeVehicles

  useEffect(() => {
    api
      .getDashboard()
      .then(d => {
        setDashboardData(d)
        setLoading(false)
      })
      .catch(e => {
        setError(String(e))
        setLoading(false)
      })

    // Fetch city-wide synthetic vehicles
    api
      .getTrafficDots()
      .then(data => setSimVehicles(data.vehicles))
      .catch(err => console.warn('Traffic dots unavailable:', err))
  }, [])

  if (loading) {
    return <div style={{ padding: 32, color: '#888' }}>Loading dashboard...</div>
  }
  if (error) {
    return <div style={{ padding: 32, color: '#dc2626' }}>Error: {error}</div>
  }
  if (!dashboardData) return null

  const { kpis, kpi_trends, alerts } = dashboardData

  // Determine dominant mode
  const modes = kpis.mode_share
  const dominant = (Object.entries(modes) as [string, number][]).sort((a, b) => b[1] - a[1])[0]

  // Choose trend data
  const trendsMap: Record<TrendRange, DenverPulseTrends> = {
    '7d': dashboardData.trends_7d,
    '30d': dashboardData.trends_30d,
    ytd: dashboardData.trends_ytd,
  }
  const activeTrends = trendsMap[trendRange]

  const selectStyle: React.CSSProperties = {
    fontSize: 11,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 14,
        gap: 10,
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {/* GHG */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Total GHG Emissions</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4 }}>
            {kpis.ghg_tco2e.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500 }}>tCO&#x2082;e</span>
          </div>
          {kpi_trends.ghg !== undefined && <TrendBadge value={kpi_trends.ghg} positiveIsGood={false} />}
        </div>

        {/* Mode Share */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Mode Share</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4 }}>
            {dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1)} {dominant[1]}%
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {(Object.entries(modes) as [string, number][]).map(([k, v]) => (
              <span key={k} style={{ fontSize: 10, color: '#6b7280' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background:
                      k === 'car' ? '#f97316' : k === 'pt' ? '#3b82f6' : k === 'bike' ? '#10b981' : '#8b5cf6',
                    marginRight: 3,
                  }}
                />
                {k.charAt(0).toUpperCase() + k.slice(1)} {v}%
              </span>
            ))}
          </div>
        </div>

        {/* Average Speed */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Average Speed</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4 }}>
            {kpis.avg_speed_kmh.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500 }}>km/h</span>
          </div>
          {kpi_trends.speed !== undefined && <TrendBadge value={kpi_trends.speed} positiveIsGood={true} />}
        </div>

        {/* Congestion */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Congestion Level</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4 }}>
            {kpis.congestion_pct.toFixed(1)}%
          </div>
          {kpi_trends.congestion !== undefined && (
            <TrendBadge value={kpi_trends.congestion} positiveIsGood={false} />
          )}
        </div>
      </div>

      {/* Map + Alerts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 2fr) minmax(200px, 1fr)', gap: 12, flex: 1, minHeight: 280 }}>
        {/* Map */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px 8px',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Live Map</span>
            <select
              value={activeMetric}
              onChange={e => setActiveMetric(e.target.value as MapMetric)}
              style={selectStyle}
            >
              <option value="ghg">GHG Emissions</option>
              <option value="mode">Mode Share</option>
              <option value="speed">Speed</option>
              <option value="congestion">Congestion</option>
            </select>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <DenverPulseCesiumMap
              metric={activeMetric}
              cesiumEdges={dashboardData.cesium_edges[activeMetric] || {}}
              height="100%"
              trafficSimPositions={positions.length > 0 ? positions : null}
              dotColorMode="metric"
            />
          </div>
        </div>

        {/* Alerts */}
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Alerts</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                background: '#ef4444',
                color: '#fff',
                borderRadius: 10,
                padding: '1px 7px',
              }}
            >
              {alerts.length}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {alerts.map((a, i) => (
              <AlertItem key={i} alert={a} />
            ))}
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      <div style={{ ...cardStyle, minHeight: 240, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Trends</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={trendMetric}
              onChange={e => setTrendMetric(e.target.value as TrendMetric)}
              style={selectStyle}
            >
              <option value="emissions">Emissions</option>
              <option value="modeshift">Mode Shift</option>
            </select>
            <select
              value={trendRange}
              onChange={e => setTrendRange(e.target.value as TrendRange)}
              style={selectStyle}
            >
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="ytd">Year to Date</option>
            </select>
          </div>
        </div>

        {/* Legend for modeshift */}
        {trendMetric === 'modeshift' && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 6 }}>
            {[
              { label: 'Car', color: '#f97316' },
              { label: 'PT', color: '#3b82f6' },
              { label: 'Bike', color: '#10b981' },
              { label: 'Walk', color: '#8b5cf6' },
            ].map(l => (
              <span key={l.label} style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 3, background: l.color, borderRadius: 1, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }}>
          {activeTrends && <TrendChart trends={activeTrends} trendMetric={trendMetric} />}
        </div>
      </div>
    </div>
  )
}

export default DenverPulseDashboard
