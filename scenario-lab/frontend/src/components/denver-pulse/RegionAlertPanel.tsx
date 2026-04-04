import React, { useEffect, useRef } from 'react'
import { DenverPulseAlert, RegionAlertGroup } from './api'
import useAutoCycle from './useAutoCycle'

// ---------------------------------------------------------------------------
// Shared alert styles (moved here from DenverPulseDashboard)
// ---------------------------------------------------------------------------

export const ALERT_STYLES: Record<string, { bg: string; border: string }> = {
  red:    { bg: '#fef2f2', border: '#fecaca' },
  orange: { bg: '#fff7ed', border: '#fed7aa' },
  green:  { bg: '#ecfdf5', border: '#a7f3d0' },
  blue:   { bg: '#eff6ff', border: '#bfdbfe' },
  yellow: { bg: '#fefce8', border: '#fde68a' },
}

const METRIC_ICONS: Record<string, string> = {
  traffic:      '🚗',
  transit:      '🚌',
  emissions:    '💨',
  construction: '🏗',
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  WARNING:  '#ea580c',
  CAUTION:  '#ca8a04',
  NORMAL:   '#16a34a',
  INFO:     '#2563eb',
}

const DOT_COLORS: Record<string, string> = {
  red:    '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green:  '#22c55e',
  blue:   '#3b82f6',
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  padding: 16,
}

// ---------------------------------------------------------------------------
// AlertItem
// ---------------------------------------------------------------------------

export function AlertItem({ alert }: { alert: DenverPulseAlert }) {
  const s = ALERT_STYLES[alert.level] ?? ALERT_STYLES.blue
  const icon = METRIC_ICONS[alert.metric_type ?? 'traffic'] ?? '🚗'
  const sevColor = SEVERITY_COLORS[alert.severity_label ?? 'INFO'] ?? '#2563eb'
  const trendPct = alert.trend_pct ?? null
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
      {/* Top row: icon + severity label + trend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: sevColor, fontWeight: 700 }}>
          {icon} {alert.severity_label ?? 'INFO'}
        </span>
        {trendPct != null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: trendPct > 0 ? '#dc2626' : '#16a34a' }}>
            {trendPct > 0 ? '▲' : '▼'} {Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
      </div>
      {/* Title */}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{alert.title}</div>
      {/* Description */}
      <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{alert.description}</div>
      {/* Bottom row: timestamp */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{alert.timestamp}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RegionAlertPanel
// ---------------------------------------------------------------------------

interface Props {
  regionAlerts: RegionAlertGroup[]
  fallbackAlerts: DenverPulseAlert[]
  alertTick?: number
  latestRegionId?: string | null
}

export default function RegionAlertPanel({ regionAlerts, fallbackAlerts, alertTick, latestRegionId }: Props) {
  const groups = regionAlerts.length > 0 ? regionAlerts : null
  const { index, progress, goTo, jumpTo, pause, resume } = useAutoCycle(groups?.length ?? 1, 5000)
  const scrollRef = useRef<HTMLDivElement>(null)

  // When new alerts arrive: jump to the updated region for 4 s, scroll to top to show new cards
  useEffect(() => {
    if (!alertTick || !groups) return
    const targetIdx = latestRegionId
      ? groups.findIndex(g => g.region_id === latestRegionId)
      : 0
    jumpTo(targetIdx >= 0 ? targetIdx : 0, 4000)
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }, [alertTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: render static city-wide list when no region data
  if (!groups) {
    return (
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Alerts</span>
          <span style={{
            fontSize: 10, fontWeight: 700, background: '#ef4444',
            color: '#fff', borderRadius: 10, padding: '1px 7px',
          }}>
            {fallbackAlerts.length}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {fallbackAlerts.map((a, i) => <AlertItem key={i} alert={a} />)}
        </div>
      </div>
    )
  }

  const current = groups[index]

  return (
    <div
      style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Alerts — {current.region_name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, background: '#ef4444',
          color: '#fff', borderRadius: 10, padding: '1px 7px',
        }}>
          {current.alerts.length}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: '#e5e7eb', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: '#3b82f6',
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Alert cards */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
        {current.alerts.map((a, i) => <AlertItem key={i} alert={a} />)}
      </div>

      {/* Navigation dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {groups.map((g, i) => (
          <button
            key={g.region_id}
            onClick={() => goTo(i)}
            title={g.region_name}
            style={{
              width: i === index ? 18 : 8,
              height: 8,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              background: i === index ? (DOT_COLORS[g.summary_level] ?? '#3b82f6') : '#d1d5db',
              transition: 'width 0.3s ease, background 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
