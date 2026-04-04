import React, { useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Series {
  values: number[]
  color: string
  fillOpacity?: number  // unused — no fills
  label?: string
}

interface ColorZone {
  above: number
  color: string
}

interface TrendSparklineProps {
  labels: string[]
  series: Series[]
  title: string
  unit?: string
  stacked?: boolean
  colorZones?: ColorZone[]   // kept for API compat, not rendered
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtVal(v: number, unit?: string): string {
  if (unit === 'tCO₂e') {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
    return v.toFixed(0)
  }
  if (unit === '%') return `${v.toFixed(1)}%`
  if (unit === 'km/h') return v.toFixed(1)
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)
}

// Build an SVG polyline "d" string in a 100×40 viewBox
const VW = 100
const VH = 40

function buildPath(values: number[], minV: number, range: number): string {
  const n = values.length
  if (n < 2) return ''
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * VW
      const y = VH - ((v - minV) / range) * VH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrendSparkline({
  labels, series, title, unit, stacked,
}: TrendSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const n = series[0]?.values.length ?? 0

  // Global min/max
  let allVals: number[] = []
  for (const s of series) allVals = allVals.concat(s.values)

  if (allVals.length === 0) {
    return (
      <div style={{
        background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 6,
        padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{ fontSize: 9, color: '#d1d5db' }}>No data</span>
      </div>
    )
  }

  const minV = stacked ? 0 : Math.min(...allVals)
  const maxV = stacked ? 100 : Math.max(...allVals)
  const range = maxV - minV || 1

  // For stacked: draw cumulative top line per layer
  const paths: { d: string; color: string }[] = []
  if (stacked) {
    const cum = new Array(n).fill(0)
    for (const s of series) {
      const tops = s.values.map((v, i) => cum[i] + v)
      for (let i = 0; i < n; i++) cum[i] += s.values[i]
      paths.push({ d: buildPath(tops, minV, range), color: s.color })
    }
  } else {
    for (const s of series) {
      paths.push({ d: buildPath(s.values, minV, range), color: s.color })
    }
  }

  // Latest and delta values
  const latestVal = series[0]?.values[n - 1] ?? 0
  const prevVal   = series[0]?.values[n - 2] ?? latestVal
  const delta     = latestVal - prevVal
  const deltaColor = delta > 0 ? '#ef4444' : delta < 0 ? '#16a34a' : '#9ca3af'

  // Hover x-index from mouse position on SVG
  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    const idx = Math.round(frac * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  const hVal = hoverIdx != null ? series[0]?.values[hoverIdx] : null

  return (
    <div
      ref={containerRef}
      style={{
        background: '#fff', border: '1px solid #f3f4f6', borderRadius: 6,
        padding: '6px 8px', position: 'relative',
      }}
    >
      {/* Header: title left, latest value right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            {fmtVal(hVal ?? latestVal, unit)}
          </span>
          {unit && (
            <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400 }}>{unit}</span>
          )}
          {!stacked && hoverIdx == null && (
            <span style={{ fontSize: 9, fontWeight: 600, color: deltaColor }}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'}
            </span>
          )}
        </div>
      </div>

      {/* Sparkline — lines only, no fills, CSS height so fonts never scale with SVG */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 96, display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {paths.map((p, i) => (
          <path
            key={i} d={p.d} fill="none"
            stroke={p.color} strokeWidth={1.5}
            strokeLinejoin="round" strokeLinecap="round"
            opacity={0.9}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Hover crosshair */}
        {hoverIdx != null && n > 1 && (
          <line
            x1={(hoverIdx / (n - 1)) * VW} y1={0}
            x2={(hoverIdx / (n - 1)) * VW} y2={VH}
            stroke="#cbd5e1" strokeWidth={1} strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* X-axis: first and last label via CSS (correct system font) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: '#d1d5db' }}>{labels[0]}</span>
        <span style={{ fontSize: 9, color: '#d1d5db' }}>{labels[n - 1]}</span>
      </div>

      {/* Hover tooltip */}
      {hoverIdx != null && (
        <div style={{
          position: 'absolute',
          bottom: 34,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b',
          color: '#f1f5f9',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 11,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          minWidth: 100,
        }}>
          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4, fontWeight: 500 }}>
            {labels[hoverIdx]}
          </div>
          {series.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#cbd5e1' }}>
                <span style={{ width: 8, height: 2, background: s.color, display: 'inline-block', borderRadius: 1, flexShrink: 0 }} />
                {s.label ?? title}
              </span>
              <span style={{ fontWeight: 700, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>
                {fmtVal(s.values[hoverIdx] ?? 0, unit)}{unit === '%' ? '' : unit ? ` ${unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}


      {/* Legend for stacked / multi-series */}
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {series.map((s, i) => s.label ? (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, color: '#6b7280' }}>
              <span style={{ width: 12, height: 2, background: s.color, display: 'inline-block', borderRadius: 1, flexShrink: 0 }} />
              {s.label}
            </span>
          ) : null)}
        </div>
      )}
    </div>
  )
}
