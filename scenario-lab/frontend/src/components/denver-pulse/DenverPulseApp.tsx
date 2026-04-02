import React, { useState, Suspense, useCallback } from 'react'
import type { DenverPulseSavedScenario } from './api'

const DenverPulseDashboard = React.lazy(() =>
  import('./DenverPulseDashboard').catch(() => ({
    default: () => <div style={{ padding: 32, color: '#888' }}>Dashboard view loading...</div>,
  }))
)
const DenverPulseSimulation = React.lazy(() =>
  import('./DenverPulseSimulation').catch(() => ({
    default: () => <div style={{ padding: 32, color: '#888' }}>Simulation view loading...</div>,
  }))
)
const DenverPulseScenarios = React.lazy(() =>
  import('./DenverPulseScenarios').catch(() => ({
    default: () => <div style={{ padding: 32, color: '#888' }}>Scenarios view loading...</div>,
  }))
)
const DenverPulseTrafficSim = React.lazy(() =>
  import('./DenverPulseTrafficSim').catch(() => ({
    default: () => <div style={{ padding: 32, color: '#888' }}>Traffic Sim loading...</div>,
  }))
)

type View = 'dashboard' | 'simulation' | 'scenarios' | 'traffic_sim'

const TITLES: Record<View, string> = {
  dashboard: 'Live Dashboard',
  simulation: 'Scenario Simulation',
  scenarios: 'Scenarios & Compare',
  traffic_sim: 'Traffic Simulation',
}

interface NavItem {
  id: View
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Live Dashboard', icon: '📊' },
  { id: 'simulation', label: 'Scenario Simulation', icon: '⚙️' },
  { id: 'scenarios', label: 'Scenarios & Compare', icon: '🔀' },
  { id: 'traffic_sim', label: 'Traffic Sim', icon: '🚗' },
]

const DenverPulseApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [loadedScenario, setLoadedScenario] = useState<DenverPulseSavedScenario | null>(null)

  const handleLoadScenario = useCallback((scenario: DenverPulseSavedScenario) => {
    setLoadedScenario(scenario)
    setActiveView('simulation')
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 224,
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: '#2563eb',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              marginRight: 10,
            }}
          >
            DP
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Denver Pulse</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
              marginTop: 4,
              padding: '0 8px',
            }}
          >
            Analyst Views
          </div>
          {NAV.map(item => {
            const active = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  width: '100%',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  background: active ? '#eff6ff' : 'transparent',
                  color: active ? '#1d4ed8' : '#4b5563',
                }}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div
          style={{
            padding: 14,
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#dbeafe',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#1d4ed8',
            }}
          >
            DA
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Denver Analyst</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Policy Analyst</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <header
          style={{
            height: 52,
            background: '#fff',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={onBack}
              style={{
                background: 'transparent',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                color: '#6b7280',
                fontSize: 11,
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1f2937', margin: 0 }}>
              {TITLES[activeView]}
            </h2>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#4b5563',
              background: '#f9fafb',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 2s infinite',
              }}
            />
            System Online
          </div>
        </header>

        {/* View content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense fallback={<div style={{ padding: 32, color: '#888' }}>Loading...</div>}>
            {activeView === 'dashboard' && <DenverPulseDashboard />}
            {activeView === 'simulation' && <DenverPulseSimulation loadedScenario={loadedScenario} onLoaded={() => setLoadedScenario(null)} />}
            {activeView === 'scenarios' && <DenverPulseScenarios onLoadScenario={handleLoadScenario} />}
            {activeView === 'traffic_sim' && <DenverPulseTrafficSim />}
          </Suspense>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default DenverPulseApp
