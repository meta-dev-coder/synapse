import React, { useState, Suspense, useCallback } from 'react'
import type { DenverPulseSavedScenario } from './api'

type TimeWindow = '1h' | '6h' | '24h'

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
type View = 'dashboard' | 'simulation' | 'scenarios'

const TITLES: Record<View, string> = {
  dashboard: 'Live Dashboard',
  simulation: 'Scenario Simulation',
  scenarios: 'Scenarios & Compare',
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
]

const DenverPulseApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [loadedScenario, setLoadedScenario] = useState<DenverPulseSavedScenario | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')

  const handleLoadScenario = useCallback((scenario: DenverPulseSavedScenario) => {
    setLoadedScenario(scenario)
    setActiveView('simulation')
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarOpen ? 224 : 56,
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          zIndex: 20,
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo + collapse toggle */}
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 10px 0 12px',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', minWidth: 0 }}>
            <div
              style={{
                width: 28, height: 28, background: '#2563eb', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}
            >
              DP
            </div>
            {sidebarOpen && (
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
                Denver Pulse
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: 18, lineHeight: 1,
              padding: '2px 4px', flexShrink: 0, borderRadius: 4,
            }}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: sidebarOpen ? 12 : '12px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sidebarOpen && (
            <div
              style={{
                fontSize: 10, fontWeight: 700, color: '#9ca3af',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: 8, marginTop: 4, padding: '0 8px',
                whiteSpace: 'nowrap',
              }}
            >
              Analyst Views
            </div>
          )}
          {NAV.map(item => {
            const active = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  gap: sidebarOpen ? 10 : 0,
                  padding: sidebarOpen ? '10px 12px' : '10px 0',
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
                <span style={{ fontSize: sidebarOpen ? 15 : 18 }}>{item.icon}</span>
                {sidebarOpen && item.label}
              </button>
            )
          })}
        </nav>

        {/* User */}
        {sidebarOpen ? (
          <div
            style={{
              padding: 14, borderTop: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#dbeafe', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#1d4ed8', flexShrink: 0,
              }}
            >
              DA
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>Denver Analyst</div>
              <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Policy Analyst</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '14px 0', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center' }}>
            <div
              title="Denver Analyst — Policy Analyst"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#dbeafe', border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#1d4ed8', cursor: 'default',
              }}
            >
              DA
            </div>
          </div>
        )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Time window toggle — only on dashboard view */}
            {activeView === 'dashboard' && (
              <div style={{
                display: 'flex', gap: 2,
                background: '#f3f4f6', borderRadius: 6, padding: 2,
                border: '1px solid #e5e7eb',
              }}>
                {(['1h', '6h', '24h'] as TimeWindow[]).map(w => (
                  <button
                    key={w}
                    onClick={() => setTimeWindow(w)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 9px',
                      borderRadius: 4, border: 'none', cursor: 'pointer',
                      background: timeWindow === w ? '#2563eb' : 'transparent',
                      color: timeWindow === w ? '#fff' : '#6b7280',
                      transition: 'all 0.15s',
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
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
          </div>
        </header>

        {/* View content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Suspense fallback={<div style={{ padding: 32, color: '#888' }}>Loading...</div>}>
            {activeView === 'dashboard' && <DenverPulseDashboard timeWindow={timeWindow} />}
            {activeView === 'simulation' && <DenverPulseSimulation loadedScenario={loadedScenario} onLoaded={() => setLoadedScenario(null)} />}
            {activeView === 'scenarios' && <DenverPulseScenarios onLoadScenario={handleLoadScenario} />}
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
