import React from 'react'

interface Props {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (val: number) => void
  unit?: string
  formatValue?: (val: number) => string
}

const SliderInput: React.FC<Props> = ({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
  formatValue,
}) => {
  const display = formatValue ? formatValue(value) : value.toString()

  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 5,
        }}
      >
        <label style={{ fontSize: 12, color: '#aabbcc', fontWeight: 500 }}>{label}</label>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#e0e0e0',
            minWidth: 52,
            textAlign: 'right',
          }}
        >
          {display}
          {unit ? <span style={{ fontSize: 10, color: '#8899aa', marginLeft: 2 }}>{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#556677',
          marginTop: 2,
        }}
      >
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

export default SliderInput
