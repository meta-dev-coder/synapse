import React from 'react'
import type { ScenarioType } from '../App'
// ScenarioType includes 'settings' — added in App.tsx

interface Tab {
  id: ScenarioType
  label: string
}

const TABS: Tab[] = [
  { id: 'toll',             label: 'Toll' },
  { id: 'corridor',         label: 'Corridor' },
  { id: 'emission',         label: 'Emission' },
  { id: 'evasion',          label: 'Evasion' },
  { id: 'comparison',       label: 'Comparison' },
  { id: 'asset_health',     label: 'Asset Health' },
  { id: 'predictive_maint', label: 'Maintenance' },
  { id: 'settings',         label: 'Settings' },
]

interface Props {
  active: ScenarioType
  onChange: (s: ScenarioType) => void
}

const ScenarioTabs: React.FC<Props> = ({ active, onChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0,
        borderBottom: '1px solid #1a4a80',
        background: '#0a2744',
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              flex: '1 1 auto',
              padding: '10px 4px',
              fontSize: 11,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? '#e94560' : '#8899aa',
              background: isActive ? '#0f3460' : 'transparent',
              borderBottom: isActive ? '2px solid #e94560' : '2px solid transparent',
              transition: 'all 0.15s ease',
              letterSpacing: 0.3,
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default ScenarioTabs
