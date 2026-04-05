import React, { useState, useCallback, Component } from 'react'
import CesiumViewer from './components/CesiumViewer'
import ScenarioTabs from './components/ScenarioTabs'
import TollScenario from './components/scenarios/TollScenario'
import CorridorScenario from './components/scenarios/CorridorScenario'
import EmissionScenario from './components/scenarios/EmissionScenario'
import EvasionScenario from './components/scenarios/EvasionScenario'
import ComparisonScenario from './components/scenarios/ComparisonScenario'
import AssetHealthScenario from './components/scenarios/AssetHealthScenario'
import PredictiveMaintScenario from './components/scenarios/PredictiveMaintScenario'
import SettingsScenario from './components/scenarios/SettingsScenario'
import SimulationSelector from './components/SimulationSelector'
import DenverPulseApp from './components/denver-pulse/DenverPulseApp'
import BentleyLogin, { type DenverRole } from './components/denver-pulse/BentleyLogin'
import WhyThisResultModal from './components/ui/WhyThisResultModal'

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: '#e74c3c', background: '#0a0a0a', height: '100vh' }}>
          <h2>Render error — check console for details</h2>
          <pre style={{ fontSize: 12, color: '#aaa', whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
          <button
            type="button"
            style={{ marginTop: 16, padding: '8px 20px', background: '#e94560', color: '#fff', borderRadius: 5, border: 'none', cursor: 'pointer' }}
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export type ScenarioType = 'toll' | 'corridor' | 'emission' | 'evasion' | 'comparison' | 'asset_health' | 'predictive_maint' | 'settings'
export type SimulationModule = 'toll_plaza' | 'denver_traffic' | null

export interface SimulationResult {
  cesium_heatmap?: Record<string, number>
  [key: string]: unknown
}

type MapMetric = 'ghg' | 'mode' | 'speed' | 'congestion'

const MAP_LEGENDS: Record<MapMetric, { label: string; color: string }[]> = {
  ghg:        [{ label: 'High', color: '#ef4444' }, { label: 'Med', color: '#f97316' }, { label: 'Low', color: '#22c55e' }],
  mode:       [{ label: 'Car', color: '#f97316' }, { label: 'PT', color: '#3b82f6' }, { label: 'Bike', color: '#10b981' }, { label: 'Walk', color: '#8b5cf6' }],
  speed:      [{ label: 'Fast', color: '#22c55e' }, { label: 'Mod', color: '#eab308' }, { label: 'Slow', color: '#ef4444' }],
  congestion: [{ label: 'Severe', color: '#dc2626' }, { label: 'Mod', color: '#f97316' }, { label: 'Free', color: '#22c55e' }],
}

// ─── Toll Plaza module (existing app) ─────────────────────────────────────────

const TollPlazaApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('toll')
  const [simDuration, setSimDuration] = useState(30)
  const [mapMetric, setMapMetric] = useState<MapMetric>('ghg')
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null)
  const [whyOpen, setWhyOpen] = useState(false)

  const handleScenarioChange = useCallback((scenario: ScenarioType) => {
    setActiveScenario(scenario)
  }, [])

  const handleResult = useCallback((result: SimulationResult) => {
    setCurrentResult(result)
  }, [])

  const renderScenario = () => {
    switch (activeScenario) {
      case 'toll':
        return <TollScenario onResult={handleResult} simDuration={simDuration} />
      case 'corridor':
        return <CorridorScenario onResult={handleResult} simDuration={simDuration} />
      case 'emission':
        return <EmissionScenario onResult={handleResult} simDuration={simDuration} />
      case 'evasion':
        return <EvasionScenario onResult={handleResult} simDuration={simDuration} />
      case 'comparison':
        return <ComparisonScenario onResult={handleResult} simDuration={simDuration} />
      case 'asset_health':
        return <AssetHealthScenario onResult={handleResult} />
      case 'predictive_maint':
        return <PredictiveMaintScenario onResult={handleResult} />
      case 'settings':
        return <SettingsScenario simDuration={simDuration} onSimDurationChange={setSimDuration} />
    }
  }

  return (
    <ErrorBoundary>
      <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div
          style={{
            width: '48vw',
            minWidth: 480,
            maxWidth: 960,
            background: '#0f3460',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10,
            boxShadow: '2px 0 12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 20px 12px',
              background: '#0a2744',
              borderBottom: '1px solid #1a4a80',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <button
                onClick={onBack}
                style={{
                  background: 'transparent',
                  border: '1px solid #2a5a90',
                  borderRadius: 4,
                  color: '#8899aa',
                  fontSize: 11,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#aabbcc'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#4a7ab0'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#8899aa'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2a5a90'
                }}
              >
                ← Simulations
              </button>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e94560', letterSpacing: 0.5 }}>
              🚦 Scenario Lab
            </div>
            <div style={{ fontSize: 12, color: '#8899aa', marginTop: 3 }}>
              A10-West Toll Plaza POC · 8 Lanes (NB + SB)
            </div>
          </div>

          {/* Scenario tabs */}
          <ScenarioTabs active={activeScenario} onChange={handleScenarioChange} />

          {/* Scenario panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
            {renderScenario()}
          </div>

          {/* Why this result — appears after any simulation */}
          {currentResult && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid #1a3a60',
              flexShrink: 0,
            }}>
              <button
                onClick={() => setWhyOpen(true)}
                style={{
                  width: '100%', padding: '8px 14px',
                  background: 'transparent',
                  border: '1px solid #2a5a90',
                  borderRadius: 6, cursor: 'pointer',
                  color: '#8899aa', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#e0e0e0'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#4a7ab0'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = '#8899aa'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#2a5a90'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                ❓ Why this result?
              </button>
            </div>
          )}
        </div>

        {/* Right pane — Impact Visualization header + Cesium */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Header bar */}
          <div style={{
            background: '#0a2744',
            borderBottom: '1px solid #1a4a80',
            padding: '8px 16px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#c0d0e0' }}>
              <span>🗺</span>
              <span>Impact Visualization</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 10 }}>
                {MAP_LEGENDS[mapMetric].map(item => (
                  <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8899aa', fontWeight: 500 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block', flexShrink: 0 }} />
                    {item.label}
                  </span>
                ))}
              </div>
              {/* Metric dropdown */}
              <select
                value={mapMetric}
                onChange={e => setMapMetric(e.target.value as MapMetric)}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 5,
                  border: '1px solid #2a5a90', background: '#0f3460',
                  color: '#c0d0e0', cursor: 'pointer', fontWeight: 500,
                }}
              >
                <option value="ghg">GHG Emissions</option>
                <option value="mode">Mode Share</option>
                <option value="speed">Average Speed</option>
                <option value="congestion">Congestion Level</option>
              </select>
            </div>
          </div>

          {/* Cesium viewer fills remaining height */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <CesiumViewer />
          </div>
        </div>

        <WhyThisResultModal open={whyOpen} onClose={() => setWhyOpen(false)} />
      </div>
    </ErrorBoundary>
  )
}

// ─── Root app ─────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [activeModule, setActiveModule] = useState<SimulationModule>(null)
  const [denverRole, setDenverRole] = useState<DenverRole | null>(null)

  if (activeModule === null) return <SimulationSelector onSelect={setActiveModule} />
  if (activeModule === 'toll_plaza') return <TollPlazaApp onBack={() => setActiveModule(null)} />
  if (activeModule === 'denver_traffic') {
    if (!denverRole) {
      return (
        <BentleyLogin
          onLogin={role => setDenverRole(role)}
          onBack={() => setActiveModule(null)}
        />
      )
    }
    return (
      <ErrorBoundary>
        <DenverPulseApp
          onBack={() => { setActiveModule(null); setDenverRole(null) }}
          role={denverRole}
        />
      </ErrorBoundary>
    )
  }
  return null
}

export default App
