import React, { useState } from 'react'
import type { SimulationModule } from '../App'

interface SimulationSelectorProps {
  onSelect: (module: SimulationModule) => void
}

interface CardDef {
  id: SimulationModule
  icon: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  status: 'live' | 'dev' | 'soon'
  borderColor: string
}

const CARDS: CardDef[] = [
  {
    id: 'toll_plaza',
    icon: '🚦',
    title: 'Toll Plaza Simulation',
    subtitle: 'A10-West 8-lane corridor · Amsterdam, NL',
    description:
      'Model toll rate policy, corridor disruptions, emission impact, evasion risk, and asset health for an 8-lane NB/SB highway toll plaza.',
    tags: ['Toll Optimisation', 'Corridor Closure', 'Emission', 'Evasion', 'Asset Health'],
    status: 'live',
    borderColor: '#e94560',
  },
  {
    id: 'denver_traffic',
    icon: '🏙️',
    title: 'Denver Pulse - Policy Simulation',
    subtitle: 'City-scale network · Denver, CO',
    description:
      'Policy scenario simulation for Denver city traffic. Select policies, adjust variables, and compare outcomes using real RTD GPS data and Denver GHG inventory.',
    tags: ['Policy Simulation', 'Real GPS Data', 'GHG Analysis', 'Scenario Compare'],
    status: 'live',
    borderColor: '#2196F3',
  },
  {
    id: null,
    icon: '🚌',
    title: 'Transit Network Simulation',
    subtitle: 'Multi-modal transit · Coming Soon',
    description:
      'Model bus and rail frequency changes, stop closures, and fleet electrification impacts on ridership and system performance.',
    tags: ['Frequency Optimisation', 'Fleet Mix', 'Accessibility'],
    status: 'soon',
    borderColor: '#444',
  },
  {
    id: null,
    icon: '🚛',
    title: 'Freight & Logistics Simulation',
    subtitle: 'Last-mile delivery network · Coming Soon',
    description:
      'Evaluate truck routing, loading zone policies, and depot placement to reduce urban freight congestion and emissions.',
    tags: ['Truck Routing', 'Loading Zones', 'Emissions'],
    status: 'soon',
    borderColor: '#444',
  },
]

const STATUS_CONFIG = {
  live:  { label: '● Live',           color: '#27ae60', bg: 'rgba(39,174,96,0.12)',  border: 'rgba(39,174,96,0.3)'  },
  dev:   { label: '◑ In Development', color: '#2196F3', bg: 'rgba(33,150,243,0.12)', border: 'rgba(33,150,243,0.3)' },
  soon:  { label: '○ Coming Soon',    color: '#666',    bg: 'rgba(100,100,100,0.1)', border: 'rgba(100,100,100,0.3)' },
}

const Card: React.FC<{ card: CardDef; onSelect: (id: SimulationModule) => void }> = ({ card, onSelect }) => {
  const [hovered, setHovered] = useState(false)
  const isActive = card.status !== 'soon'
  const status = STATUS_CONFIG[card.status]

  return (
    <div
      onClick={() => isActive && onSelect(card.id)}
      onMouseEnter={() => isActive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#0f3460' : '#0a2744',
        borderLeft: `1px solid ${hovered ? card.borderColor : '#1a3a5c'}`,
        borderRight: `1px solid ${hovered ? card.borderColor : '#1a3a5c'}`,
        borderBottom: `1px solid ${hovered ? card.borderColor : '#1a3a5c'}`,
        borderTop: `3px solid ${card.borderColor}`,
        borderRadius: 10,
        padding: '24px 22px',
        cursor: isActive ? 'pointer' : 'default',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
        boxShadow: hovered ? `0 8px 24px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.2)',
        opacity: isActive ? 1 : 0.55,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 240,
      }}
    >
      {/* Icon + title */}
      <div>
        <span style={{ fontSize: 28 }}>{card.icon}</span>
        <h3
          style={{
            margin: '8px 0 4px',
            fontSize: 17,
            fontWeight: 700,
            color: isActive ? '#e8f0fe' : '#667',
            letterSpacing: 0.2,
          }}
        >
          {card.title}
        </h3>
        <div style={{ fontSize: 12, color: '#5577aa' }}>{card.subtitle}</div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: '#8899aa', lineHeight: 1.55, margin: 0, flex: 1 }}>
        {card.description}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {card.tags.map(tag => (
          <span
            key={tag}
            style={{
              background: isActive ? `${card.borderColor}18` : 'rgba(80,80,80,0.1)',
              border: `1px solid ${isActive ? `${card.borderColor}44` : '#333'}`,
              borderRadius: 20,
              color: isActive ? '#aabbcc' : '#556',
              fontSize: 11,
              padding: '3px 9px',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Status badge */}
      <div style={{ marginTop: 4 }}>
        <span
          style={{
            background: status.bg,
            border: `1px solid ${status.border}`,
            borderRadius: 20,
            color: status.color,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 12px',
          }}
        >
          {status.label}
        </span>
      </div>
    </div>
  )
}

const SimulationSelector: React.FC<SimulationSelectorProps> = ({ onSelect }) => {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#060f1c',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background: '#0a2744',
          borderBottom: '1px solid #1a3a5c',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 22 }}>🔷</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e8f0fe', letterSpacing: 0.5 }}>
            Synapse
          </div>
          <div style={{ fontSize: 11, color: '#5577aa', letterSpacing: 1, textTransform: 'uppercase' }}>
            Digital Twin Platform
          </div>
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          textAlign: 'center',
          padding: '52px 32px 36px',
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: '#e8f0fe',
            margin: '0 0 10px',
            letterSpacing: 0.3,
          }}
        >
          What-If Planning Decision Engine
        </h1>
        <p style={{ fontSize: 15, color: '#5577aa', margin: 0 }}>
          Select a simulation module to begin scenario analysis
        </p>
      </div>

      {/* Cards grid */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
          padding: '0 40px 48px',
          maxWidth: 1100,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          alignContent: 'start',
        }}
      >
        {CARDS.map(card => (
          <Card key={card.title} card={card} onSelect={onSelect} />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '16px 32px 24px',
          fontSize: 12,
          color: '#334',
          flexShrink: 0,
        }}
      >
        Synapse Digital Twin Platform · AWS Infrastructure
      </div>
    </div>
  )
}

export default SimulationSelector
