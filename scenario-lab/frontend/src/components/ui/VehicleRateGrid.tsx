import React from 'react'

export interface VehicleRates {
  car: number
  truck: number
  bus: number
  van: number
}

interface VehicleRow {
  key: keyof VehicleRates
  label: string
  icon: string
}

const ROWS: VehicleRow[] = [
  { key: 'car',   label: 'Car',   icon: '🚗' },
  { key: 'truck', label: 'Truck', icon: '🚛' },
  { key: 'bus',   label: 'Bus',   icon: '🚌' },
  { key: 'van',   label: 'Van',   icon: '🚐' },
]

interface Props {
  rates: VehicleRates
  onChange: (cls: string, val: number) => void
}

const VehicleRateGrid: React.FC<Props> = ({ rates, onChange }) => {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: '#aabbcc', fontWeight: 500, marginBottom: 8 }}>
        Vehicle Rates (veh/min)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ROWS.map(({ key, label, icon }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#0a2744',
              border: '1px solid #1a3a60',
              borderRadius: 5,
              padding: '6px 10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 13, color: '#ccd8e8' }}>{label}</span>
            </div>
            <input
              type="number"
              min={0}
              max={50}
              step={0.01}
              value={rates[key]}
              onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default VehicleRateGrid
