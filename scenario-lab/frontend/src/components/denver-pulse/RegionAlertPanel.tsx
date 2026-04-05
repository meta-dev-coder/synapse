import React from 'react'
import { DenverPulseAlert, RegionAlertGroup } from './api'

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

export function AlertItem({ alert, regionName }: { alert: DenverPulseAlert; regionName?: string }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {regionName && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#6b7280',
              background: '#f3f4f6', borderRadius: 4, padding: '1px 5px',
            }}>
              {regionName}
            </span>
          )}
          {trendPct != null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: trendPct > 0 ? '#dc2626' : '#16a34a' }}>
              {trendPct > 0 ? '▲' : '▼'} {Math.abs(trendPct).toFixed(1)}%
            </span>
          )}
        </div>
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
  selectedZoneId?: string | null
  zoneOrder?: string[]
}

export default function RegionAlertPanel({ regionAlerts, fallbackAlerts, selectedZoneId, zoneOrder }: Props) {
  const groups = regionAlerts.length > 0 ? regionAlerts : null

  // City-wide fallback when no region data
  if (!groups) {
    return (
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Alerts — City-wide</span>
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

  // Region selected — show only that region's alerts
  if (selectedZoneId) {
    const group = groups.find(g => g.region_id === selectedZoneId)
    const regionAlertList = group?.alerts ?? []
    return (
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            Alerts — {group?.region_name ?? 'Region'}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, background: '#ef4444',
            color: '#fff', borderRadius: 10, padding: '1px 7px',
          }}>
            {regionAlertList.length}
          </span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {regionAlertList.length === 0
            ? <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingTop: 16 }}>No alerts for this region</div>
            : regionAlertList.map((a, i) => <AlertItem key={i} alert={a} />)
          }
        </div>
      </div>
    )
  }

  // City-wide — all regions in dropdown order, each alert labeled with region name
  const orderedGroups = zoneOrder
    ? zoneOrder.map(id => groups.find(g => g.region_id === id)).filter(Boolean) as RegionAlertGroup[]
    : groups
  const allAlerts: { alert: DenverPulseAlert; regionName: string }[] = orderedGroups.flatMap(g =>
    g.alerts.map(a => ({ alert: a, regionName: g.region_name }))
  )
  const totalCount = allAlerts.length

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Alerts — City-wide</span>
        <span style={{
          fontSize: 10, fontWeight: 700, background: '#ef4444',
          color: '#fff', borderRadius: 10, padding: '1px 7px',
        }}>
          {totalCount}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {allAlerts.map(({ alert, regionName }, i) => (
          <AlertItem key={i} alert={alert} regionName={regionName} />
        ))}
      </div>
    </div>
  )
}
