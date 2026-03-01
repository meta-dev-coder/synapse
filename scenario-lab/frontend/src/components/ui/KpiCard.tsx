import React from 'react'

interface Props {
  label: string
  value: string | number
  unit?: string
  delta?: number
  positive_is_good?: boolean
}

const KpiCard: React.FC<Props> = ({ label, value, unit, delta, positive_is_good = true }) => {
  let badgeEl: React.ReactNode = null

  if (delta !== undefined && delta !== null) {
    const isPositive = delta > 0
    // If positive_is_good=true: positive delta → green, negative → red
    // If positive_is_good=false: positive delta → red, negative → green
    const isGood = positive_is_good ? isPositive : !isPositive
    const badgeColor = isGood ? '#27ae60' : '#e74c3c'
    const sign = isPositive ? '+' : ''

    badgeEl = (
      <span
        style={{
          display: 'inline-block',
          background: badgeColor + '22',
          color: badgeColor,
          border: `1px solid ${badgeColor}55`,
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 11,
          fontWeight: 700,
          marginLeft: 6,
          verticalAlign: 'middle',
        }}
      >
        {sign}{delta.toFixed(1)}%
      </span>
    )
  }

  return (
    <div
      style={{
        background: '#0a2744',
        border: '1px solid #1a3a60',
        borderRadius: 6,
        padding: '10px 14px',
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 11, color: '#8899aa', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', lineHeight: 1 }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {unit && (
          <span style={{ fontSize: 12, color: '#8899aa' }}>{unit}</span>
        )}
        {badgeEl}
      </div>
    </div>
  )
}

export default KpiCard
