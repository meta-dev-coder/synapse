import React, { useEffect, useState, useCallback, useRef } from 'react'
import { api, DenverPulseDashboardResponse, DenverPulseTrends, TrafficSimVehicle, TrafficSimInitResponse, trafficSimApi } from './api'
import TrendSparkline from './TrendSparkline'
import DenverPulseCesiumMap from './DenverPulseCesiumMap'
import useTrafficSimLoop from './useTrafficSimLoop'
import RegionAlertPanel from './RegionAlertPanel'
import useAutoCycle from './useAutoCycle'
import useLiveKpis from './useLiveKpis'
import useRegionAlertFeed from './useRegionAlertFeed'

import { dpLog } from './dpLog'

type MapMetric = 'ghg' | 'mode' | 'speed' | 'congestion'
type TrendRange = '7d' | '30d' | 'ytd'
type TimeWindow = '1h' | '6h' | '24h'

const GHG_DIVISOR: Record<TimeWindow, number> = { '1h': 24, '6h': 4, '24h': 1 }
const GHG_UNIT_LABEL: Record<TimeWindow, string> = {
  '1h': 'tCO₂e/hr', '6h': 'tCO₂e / 6hr', '24h': 'tCO₂e/day',
}

function liveTrend(live: number, initial: number, baseTrend: number): number {
  if (initial === 0) return baseTrend
  const liveShift = (live - initial) / initial * 100
  return parseFloat((baseTrend + liveShift).toFixed(1))
}

// Stable empty object — avoids re-triggering CesiumMap effects on every render
const EMPTY_EDGES: Record<string, number> = {}

// Top 5 Denver zones — IDs verified against ODC_ADMN_NEIGHBORHOOD_A GeoJSON NBHD_ID column
const TOP_ZONES = [
  { id: '9',  name: 'Capitol Hill' },
  { id: '13', name: 'Cherry Creek' },
  { id: '14', name: 'City Park' },
  { id: '20', name: 'Congress Park' },
  { id: '70', name: 'Washington Park' },
]

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
// TrendsCarousel — 2-card carousel (2 charts per card), 5 s auto-advance
// ---------------------------------------------------------------------------

function TrendsCarousel({ trends }: { trends: DenverPulseTrends }) {
  const { index, progress, goTo, pause, resume } = useAutoCycle(2, 5000)

  const cards = [
    [
      <TrendSparkline key="em"
        title="Emissions" unit="tCO₂e"
        labels={trends.labels}
        series={[{ values: trends.emissions, color: '#f97316' }]}
      />,
      <TrendSparkline key="cg"
        title="Congestion" unit="%"
        labels={trends.labels}
        series={[{ values: trends.congestion ?? [], color: '#ef4444' }]}
        colorZones={[{ above: 70, color: '#fecaca' }, { above: 40, color: '#fde68a' }, { above: 0, color: '#d1fae5' }]}
      />,
    ],
    [
      <TrendSparkline key="sp"
        title="Avg Speed" unit="km/h"
        labels={trends.labels}
        series={[{ values: trends.speed ?? [], color: '#3b82f6' }]}
      />,
      <TrendSparkline key="ms"
        title="Mode Share" unit="%" stacked
        labels={trends.labels}
        series={[
          { values: trends.car_pct,  color: '#ef4444', label: 'Car',     fillOpacity: 0.55 },
          { values: trends.pt_pct,   color: '#3b82f6', label: 'Transit', fillOpacity: 0.55 },
          { values: trends.bike_pct, color: '#10b981', label: 'Bike',    fillOpacity: 0.55 },
          { values: trends.walk_pct, color: '#6b7280', label: 'Walk',    fillOpacity: 0.55 },
        ]}
      />,
    ],
  ]

  return (
    <div onMouseEnter={pause} onMouseLeave={resume}>
      {/* Progress bar */}
      <div style={{ height: 2, background: '#e5e7eb', borderRadius: 2, marginBottom: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress * 100}%`, background: '#3b82f6', transition: 'width 0.1s linear' }} />
      </div>

      {/* 2-column chart pair */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {cards[index]}
      </div>

      {/* Navigation dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6 }}>
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === index ? 16 : 7, height: 7, borderRadius: 4,
              border: 'none', cursor: 'pointer', padding: 0,
              background: i === index ? '#3b82f6' : '#d1d5db',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

const DenverPulseDashboard: React.FC<{ timeWindow?: TimeWindow }> = ({ timeWindow = '24h' }) => {
  const [dashboardData, setDashboardData] = useState<DenverPulseDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMetric, setActiveMetric] = useState<MapMetric>('ghg')
  const [trendRange, setTrendRange] = useState<TrendRange>('7d')

  // Zone selection state
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [zoneSimData, setZoneSimData] = useState<TrafficSimInitResponse | null>(null)
  const [zoneLoading, setZoneLoading] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<1 | 2 | 5>(1)
  const [density, setDensity] = useState(60)
  const [trendsOpen, setTrendsOpen] = useState(true)

  // City-wide vehicle state
  const [cityVehicles, setCityVehicles] = useState<TrafficSimVehicle[] | null>(null)
  const repathingRef = useRef(false)

  // Switch vehicle source based on zone selection
  const activeVehicles = selectedZoneId ? (zoneSimData?.vehicles ?? null) : cityVehicles

  const onNeedRepath = useCallback((count: number) => {
    if (repathingRef.current) return
    repathingRef.current = true
    dpLog('DASH:repath', `requesting ${count} vehicles, zone=${selectedZoneId ?? 'city'}`)
    const repathPromise = selectedZoneId
      ? trafficSimApi.repathVehicles({ neighborhood_id: selectedZoneId, count })
      : api.repathTrafficDots({ count })
    repathPromise
      .then(data => {
        dpLog('DASH:repath', `received ${data.vehicles.length} vehicles`)
        if (mergeRef.current) mergeRef.current(data.vehicles)
      })
      .catch(err => dpLog('DASH:repath', 'FAILED', err))
      .finally(() => { repathingRef.current = false })
  }, [selectedZoneId])

  const { positions, mergeVehicles } = useTrafficSimLoop(activeVehicles, playing, speed, onNeedRepath)
  const mergeRef = useRef<((v: TrafficSimVehicle[]) => void) | null>(null)
  mergeRef.current = mergeVehicles

  // Handle zone selection
  const handleZoneChange = useCallback(async (zoneId: string | null) => {
    dpLog('DASH:zone', `changing to ${zoneId ?? 'city'}`)
    setSelectedZoneId(zoneId)
    setZoneSimData(null)
    if (!zoneId) {
      setPlaying(true)
      return
    }
    setZoneLoading(true)
    // NOTE: do NOT setPlaying(false) here — stopping the rAF loop before zone
    // vehicles arrive causes positions to stay empty. Keep animation running;
    // activeVehicles becomes null while loading (statesRef clears naturally),
    // then zone vehicles slot in when data arrives.
    try {
      dpLog('DASH:zone', `initTrafficSim(${zoneId}, density=${density})...`)
      const data = await trafficSimApi.initTrafficSim({ neighborhood_id: zoneId, density })
      dpLog('DASH:zone', `got ${data.vehicles.length} vehicles, boundary=${data.boundary.length} pts`)
      setZoneSimData(data)
      setPlaying(true)  // ensure playing when zone data arrives
    } catch (err) {
      dpLog('DASH:zone', 'FAILED', err)
    } finally {
      setZoneLoading(false)
    }
  }, [density])

  // Re-init zone when density changes
  useEffect(() => {
    if (!selectedZoneId) return
    setZoneLoading(true)
    trafficSimApi.initTrafficSim({ neighborhood_id: selectedZoneId, density })
      .then(data => { setZoneSimData(data); setPlaying(true) })
      .catch(err => console.error('Density change failed:', err))
      .finally(() => setZoneLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density])

  // Load dashboard data first (fast, ~50ms)
  useEffect(() => {
    dpLog('DASH:api', 'fetching /dashboard...')
    api
      .getDashboard()
      .then(d => {
        dpLog('DASH:api', '/dashboard OK', { kpis: !!d.kpis, alerts: d.alerts?.length, edges: Object.keys(d.cesium_edges || {}) })
        // Stamp initial alerts with a cached "now - 10 min" time stored in localStorage.
        // This makes alerts look ~10 minutes old on first load; subsequent opens reuse
        // the same cached timestamp so the time doesn't reset on every page visit.
        const DP_TS_KEY = 'dp_initial_alert_ts'
        let storedTs = localStorage.getItem(DP_TS_KEY)
        if (!storedTs) {
          storedTs = String(Date.now() - 10 * 60 * 1000)
          localStorage.setItem(DP_TS_KEY, storedTs)
        }
        const initialTimeStr = new Date(Number(storedTs)).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit',
        })
        const patchAlerts = <T extends { timestamp: string }>(arr: T[]): T[] =>
          arr.map(a => ({ ...a, timestamp: initialTimeStr }))
        setDashboardData({
          ...d,
          alerts: patchAlerts(d.alerts ?? []),
          region_alerts: (d.region_alerts ?? []).map(g => ({
            ...g,
            alerts: patchAlerts(g.alerts),
          })),
        })
        setLoading(false)
      })
      .catch(e => {
        dpLog('DASH:api', '/dashboard FAILED', e)
        setError(String(e))
        setLoading(false)
      })
  }, [])

  // Defer traffic dots until dashboard has rendered (avoids blocking KPI display)
  useEffect(() => {
    if (!dashboardData) return
    dpLog('DASH:api', 'fetching /traffic-dots...')
    api
      .getTrafficDots()
      .then(data => {
        dpLog('DASH:api', `/traffic-dots OK: ${data.vehicles.length} vehicles, boundary=${data.boundary.length} pts`)
        setCityVehicles(data.vehicles)
      })
      .catch(err => dpLog('DASH:api', '/traffic-dots FAILED', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!dashboardData])

  if (loading) {
    return <div style={{ padding: 32, color: '#888' }}>Loading dashboard...</div>
  }
  if (error) {
    return <div style={{ padding: 32, color: '#dc2626' }}>Error: {error}</div>
  }
  if (!dashboardData) return null

  const { kpis: apiKpis, kpi_trends, alerts, region_alerts } = dashboardData

  return (
    <DenverPulseDashboardInner
      apiKpis={apiKpis}
      kpi_trends={kpi_trends}
      alerts={alerts}
      region_alerts={region_alerts}
      dashboardData={dashboardData}
      trendRange={trendRange}
      setTrendRange={setTrendRange}
      trendsOpen={trendsOpen}
      setTrendsOpen={setTrendsOpen}
      activeMetric={activeMetric}
      setActiveMetric={setActiveMetric}
      selectedZoneId={selectedZoneId}
      handleZoneChange={handleZoneChange}
      zoneLoading={zoneLoading}
      zoneSimData={zoneSimData}
      positions={positions}
      playing={playing}
      setPlaying={setPlaying}
      speed={speed}
      setSpeed={setSpeed}
      density={density}
      setDensity={setDensity}
      timeWindow={timeWindow}
    />
  )
}

// ---------------------------------------------------------------------------
// Inner component — allows useLiveKpis hook to run after null-guard
// ---------------------------------------------------------------------------

function DenverPulseDashboardInner({
  apiKpis, kpi_trends, alerts, region_alerts, dashboardData,
  trendRange, setTrendRange, trendsOpen, setTrendsOpen,
  activeMetric, setActiveMetric, selectedZoneId, handleZoneChange,
  zoneLoading, zoneSimData, positions, playing, setPlaying, speed, setSpeed,
  density, setDensity, timeWindow,
}: {
  apiKpis: import('./api').DenverPulseKPIs
  kpi_trends: Record<string, number>
  alerts: import('./api').DenverPulseAlert[]
  region_alerts: import('./api').RegionAlertGroup[]
  dashboardData: DenverPulseDashboardResponse
  trendRange: TrendRange
  setTrendRange: (r: TrendRange) => void
  trendsOpen: boolean
  setTrendsOpen: (fn: (o: boolean) => boolean) => void
  activeMetric: MapMetric
  setActiveMetric: (m: MapMetric) => void
  selectedZoneId: string | null
  handleZoneChange: (id: string | null) => void
  zoneLoading: boolean
  zoneSimData: import('./api').TrafficSimInitResponse | null
  positions: import('./useTrafficSimLoop').VehiclePosition[]
  playing: boolean
  setPlaying: (v: boolean) => void
  speed: 1 | 2 | 5
  setSpeed: (v: 1 | 2 | 5) => void
  density: number
  setDensity: (v: number) => void
  timeWindow: TimeWindow
}) {
  const { kpis: liveKpis, flashField } = useLiveKpis(apiKpis)
  const { groups: liveRegionAlerts, alertTick, latestRegionId } = useRegionAlertFeed(region_alerts ?? [])

  // Determine dominant live mode
  const modes = liveKpis.mode_share
  const dominant = (Object.entries(modes) as [string, number][]).sort((a, b) => b[1] - a[1])[0]

  // GHG scaled to selected time window
  const displayGhg = Math.round(liveKpis.ghg_tco2e / GHG_DIVISOR[timeWindow])
  const ghgUnit = GHG_UNIT_LABEL[timeWindow]

  // Live trend badges — drift from initial API value on top of backend baseline trend
  const liveGhgTrend = liveTrend(liveKpis.ghg_tco2e, apiKpis.ghg_tco2e, kpi_trends.ghg ?? 0)
  const liveSpeedTrend = liveTrend(liveKpis.avg_speed_kmh, apiKpis.avg_speed_kmh, kpi_trends.speed ?? 0)
  const liveCongTrend = liveTrend(liveKpis.congestion_pct, apiKpis.congestion_pct, kpi_trends.congestion ?? 0)

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
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
            GHG Emissions ({timeWindow})
            <span style={{ fontSize: 10, color: '#d1d5db', marginLeft: 3 }}>*</span>
          </div>
          <div style={{
            fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4,
            borderRadius: 4, animation: flashField === 'ghg_tco2e' ? 'kpiFlash 0.6s ease-out' : 'none',
          }}>
            {displayGhg.toLocaleString()} <span style={{ fontSize: 14, fontWeight: 500 }}>{ghgUnit}</span>
          </div>
          <TrendBadge value={liveGhgTrend} positiveIsGood={false} />
        </div>

        {/* Mode Share */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Mode Share</div>
          <div style={{
            fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4,
            borderRadius: 4, animation: flashField === 'mode_share' ? 'kpiFlash 0.6s ease-out' : 'none',
          }}>
            {dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1)} {dominant[1].toFixed(2)}%
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
                {k.charAt(0).toUpperCase() + k.slice(1)} {v.toFixed(2)}%
              </span>
            ))}
          </div>
        </div>

        {/* Average Speed */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Average Speed</div>
          <div style={{
            fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4,
            borderRadius: 4, animation: flashField === 'avg_speed_kmh' ? 'kpiFlash 0.6s ease-out' : 'none',
          }}>
            {liveKpis.avg_speed_kmh.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500 }}>km/h</span>
          </div>
          <TrendBadge value={liveSpeedTrend} positiveIsGood={true} />
        </div>

        {/* Congestion */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Congestion Level</div>
          <div style={{
            fontSize: 26, fontWeight: 700, color: '#111827', marginTop: 4,
            borderRadius: 4, animation: flashField === 'congestion_pct' ? 'kpiFlash 0.6s ease-out' : 'none',
          }}>
            {liveKpis.congestion_pct.toFixed(1)}%
          </div>
          <TrendBadge value={liveCongTrend} positiveIsGood={false} />
        </div>
      </div>

      {/* Source footnote */}
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: -4, lineHeight: 1.5 }}>
        * GHG baseline from <span style={{ fontStyle: 'italic' }}>2024 Denver Community GHG Inventory</span> (City &amp; County of Denver, Environmental Health &amp; Sustainability).
        Speed &amp; congestion: TomTom Traffic Index 2025 Denver baseline.
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
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Live Map</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={selectedZoneId ?? ''}
                onChange={e => handleZoneChange(e.target.value || null)}
                style={selectStyle}
              >
                <option value="">City Overview</option>
                {TOP_ZONES.map(z => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
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
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <DenverPulseCesiumMap
              metric={activeMetric}
              cesiumEdges={selectedZoneId ? EMPTY_EDGES : (dashboardData.cesium_edges[activeMetric] || EMPTY_EDGES)}
              height="100%"
              trafficSimPositions={positions.length > 0 ? positions : null}
              trafficSimBoundary={selectedZoneId ? (zoneSimData?.boundary ?? null) : null}
              dotColorMode={activeMetric === 'mode' ? 'mode' : 'metric'}
              cameraAltitude={selectedZoneId ? 3000 : 7000}
            />

            {/* Loading overlay for zone init */}
            {zoneLoading && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 50, color: '#fff',
              }}>
                <div style={{
                  width: 32, height: 32, border: '3px solid rgba(255,255,255,0.3)',
                  borderTop: '3px solid #fff', borderRadius: '50%',
                  animation: 'spin 1s linear infinite', marginBottom: 12,
                }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Loading zone...</div>
              </div>
            )}

            {/* Bottom overlay: Play/Speed/Density — only when zone selected */}
            {selectedZoneId && zoneSimData && (
              <div style={{
                position: 'absolute', bottom: 8, left: 8, right: 8,
                background: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '6px 12px',
                display: 'flex', alignItems: 'center', gap: 10, zIndex: 10,
              }}>
                <button
                  onClick={() => setPlaying(!playing)}
                  style={{
                    background: playing ? '#dc2626' : '#2563eb', border: 'none', borderRadius: 4,
                    color: '#fff', fontWeight: 600, fontSize: 11, padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  {playing ? 'Pause' : 'Play'}
                </button>
                {([1, 2, 5] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    style={{
                      background: speed === s ? '#2563eb' : 'rgba(255,255,255,0.15)',
                      border: 'none', borderRadius: 4,
                      color: '#fff', fontWeight: 600, fontSize: 11, padding: '4px 8px', cursor: 'pointer',
                    }}
                  >
                    {s}x
                  </button>
                ))}
                <span style={{ color: '#9ca3af', fontSize: 10 }}>|</span>
                <span style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>Density</span>
                <input
                  type="range" min={30} max={150} value={density}
                  onChange={e => setDensity(parseInt(e.target.value))}
                  style={{ width: 80 }}
                />
                <span style={{ color: '#60a5fa', fontSize: 10, whiteSpace: 'nowrap' }}>
                  {density}/km² · {positions.length} active
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Region Alerts */}
        <RegionAlertPanel regionAlerts={liveRegionAlerts} fallbackAlerts={alerts} alertTick={alertTick} latestRegionId={latestRegionId} />
      </div>

      {/* Trends — collapsible 2×2 grid */}
      <div style={{ ...cardStyle, flexShrink: 0 }}>
        {/* Header + period toggle + collapse button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: trendsOpen ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Trends</span>
            <button
              onClick={() => setTrendsOpen(o => !o)}
              title={trendsOpen ? 'Collapse trends' : 'Expand trends'}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
            >
              {trendsOpen ? '▲' : '▼'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['7d', '30d', 'ytd'] as TrendRange[]).map(r => (
              <button
                key={r}
                onClick={() => setTrendRange(r)}
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  border: '1px solid #e5e7eb',
                  background: trendRange === r ? '#3b82f6' : '#fff',
                  color: trendRange === r ? '#fff' : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                {r === 'ytd' ? 'YTD' : r}
              </button>
            ))}
          </div>
        </div>

        {trendsOpen && activeTrends && (
          <TrendsCarousel trends={activeTrends} />
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes kpiFlash {
          0%   { background: rgba(59,130,246,0.13); }
          100% { background: transparent; }
        }
      `}</style>
    </div>
  )
}

export default DenverPulseDashboard
