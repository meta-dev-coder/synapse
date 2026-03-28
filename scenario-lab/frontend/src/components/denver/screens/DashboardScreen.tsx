import { useEffect } from 'react'
import type { DenverState, Action } from '../DenverApp'

interface DashboardScreenProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtMt(mt: number): string {
  if (mt >= 1_000_000) return `${(mt / 1_000_000).toFixed(2)}M mt/year`
  if (mt >= 1_000) return `${(mt / 1_000).toFixed(1)}K mt/year`
  return `${mt.toFixed(0)} mt/year`
}

function fmtMtShort(mt: number): string {
  if (mt >= 1_000_000) return `${(mt / 1_000_000).toFixed(2)}M mt`
  if (mt >= 1_000) return `${(mt / 1_000).toFixed(1)}K mt`
  return `${mt.toFixed(0)} mt`
}

// ── sub-components ────────────────────────────────────────────────────────────

function CardShell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--den-panel)',
      border: '1px solid var(--den-border)',
      borderRadius: 10,
      padding: '16px 18px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardLabel({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.5,
      color: 'var(--den-text-muted)',
      textTransform: 'uppercase',
      marginBottom: 6,
    }}>
      {text}
    </div>
  )
}

function CardSub({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginTop: 4 }}>{text}</div>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.4,
      padding: '2px 6px',
      borderRadius: 4,
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
    }}>
      {text}
    </span>
  )
}

function SkeletonKpi({ lines = 1 }: { lines?: number }) {
  return (
    <CardShell>
      <div style={{ height: 12, width: '55%', background: 'var(--den-surface)', borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 28, width: '70%', background: 'var(--den-surface)', borderRadius: 4, marginBottom: 8 }} />
      {lines > 1 && Array.from({ length: lines - 1 }).map((_, i) => (
        <div key={i} style={{ height: 8, width: `${45 + i * 10}%`, background: 'var(--den-surface)', borderRadius: 3, marginBottom: 6 }} />
      ))}
      <div style={{ height: 10, width: '40%', background: 'var(--den-surface)', borderRadius: 3, marginTop: 6 }} />
    </CardShell>
  )
}

function ModeSplitBar({
  label,
  pct,
  color,
}: {
  label: string
  pct: number
  color: string
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--den-text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--den-text)' }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 7, background: 'var(--den-border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  )
}

const CORRIDORS: { name: string; color: string }[] = [
  { name: 'I-25 @ Downtown', color: 'var(--den-danger)' },
  { name: 'Colfax Ave', color: 'var(--den-warning)' },
  { name: 'I-70 @ I-25 Junction', color: 'var(--den-warning)' },
  { name: 'S Broadway', color: '#f6c90e' },
  { name: 'Colorado Blvd', color: '#f6c90e' },
]

// ── main component ────────────────────────────────────────────────────────────

export default function DashboardScreen({ state, dispatch }: DashboardScreenProps) {
  useEffect(() => {
    if (state.baseline !== null) return
    const api = (import.meta.env.VITE_DENVER_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1/denver'
    fetch(`${api}/baseline`)
      .then(r => r.json())
      .then(data => dispatch({ type: 'SET_BASELINE', baseline: data }))
      .catch(err => console.warn('Failed to load baseline:', err))
  }, [state.baseline, dispatch])

  const b = state.baseline

  // ── skeleton state ────────────────────────────────────────────────────────
  if (b === null) {
    return (
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--den-text)', marginBottom: 4 }}>
          Dashboard
        </div>
        <SkeletonKpi />
        <SkeletonKpi />
        <SkeletonKpi lines={3} />
        <SkeletonKpi />
        <SkeletonKpi lines={5} />
      </div>
    )
  }

  // ── mode split values — backend returns percentages (70.0, 20.0, 10.0) ───
  const carPct = b.mode_split['car'] ?? 70
  const transitPct = b.mode_split['transit'] ?? 20
  const evBikePct = b.mode_split['ev_bike'] ?? 10

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--den-text)', marginBottom: 2 }}>
        Dashboard
      </div>

      {/* KPI 1 — Total CO₂ Emissions */}
      <CardShell>
        <CardLabel text="On-Road CO₂ Emissions" />
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--den-text)', lineHeight: 1.1 }}>
          {fmtMt(b.total_onroad_co2e_mt)}
        </div>
        <CardSub text="2024 Denver GHG Inventory" />
      </CardShell>

      {/* KPI 2 — Congestion Index */}
      <CardShell>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <CardLabel text="Congestion Index" />
          <Badge text="GPS" color="var(--den-success)" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--den-text)', lineHeight: 1.1 }}>
          {b.congestion_index.toFixed(2)}
        </div>
        <CardSub text="GPS-derived · 30-day avg" />
      </CardShell>

      {/* KPI 3 — Mode Split */}
      <CardShell>
        <CardLabel text="Mode Split" />
        <ModeSplitBar label="Car" pct={carPct} color="var(--den-warning)" />
        <ModeSplitBar label="Transit" pct={transitPct} color="var(--den-primary)" />
        <ModeSplitBar label="EV+Bike" pct={evBikePct} color="var(--den-success)" />
      </CardShell>

      {/* KPI 4 — Avg Bus Delay */}
      <CardShell>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <CardLabel text="Avg Bus Delay" />
          <Badge text="GPS" color="var(--den-success)" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--den-text)', lineHeight: 1.1 }}>
          {b.avg_bus_delay_min.toFixed(1)} min
        </div>
        <CardSub text="GPS-derived · RTD fleet" />
      </CardShell>

      {/* KPI 5 — Top Congested Corridors */}
      <CardShell>
        <CardLabel text="Top Congested Corridors" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {CORRIDORS.map(({ name, color }) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: 'var(--den-text)' }}>{name}</span>
            </div>
          ))}
        </div>
      </CardShell>

      {/* Secondary stats */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          flex: 1,
          background: 'var(--den-panel)',
          border: '1px solid var(--den-border)',
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4 }}>NET ZERO GAP</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--den-danger)' }}>
            {fmtMtShort(b.net_zero_gap_mt)}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: 'var(--den-panel)',
          border: '1px solid var(--den-border)',
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, color: 'var(--den-text-muted)', marginBottom: 4 }}>EV FLEET SHARE</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--den-success)' }}>
            {b.fleet_bev_pct.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
