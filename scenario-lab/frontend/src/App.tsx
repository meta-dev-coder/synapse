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

export interface SimulationResult {
  cesium_heatmap?: Record<string, number>
  [key: string]: unknown
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('toll')
  const [simDuration, setSimDuration] = useState(30)

  const handleScenarioChange = useCallback((scenario: ScenarioType) => {
    setActiveScenario(scenario)
  }, [])

  const renderScenario = () => {
    switch (activeScenario) {
      case 'toll':
        return <TollScenario onResult={() => {}} simDuration={simDuration} />
      case 'corridor':
        return <CorridorScenario onResult={() => {}} simDuration={simDuration} />
      case 'emission':
        return <EmissionScenario onResult={() => {}} simDuration={simDuration} />
      case 'evasion':
        return <EvasionScenario onResult={() => {}} simDuration={simDuration} />
      case 'comparison':
        return <ComparisonScenario onResult={() => {}} simDuration={simDuration} />
      case 'asset_health':
        return <AssetHealthScenario onResult={() => {}} />
      case 'predictive_maint':
        return <PredictiveMaintScenario onResult={() => {}} />
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
            overflowY: 'auto',
            overflowX: 'hidden',
            zIndex: 10,
            boxShadow: '2px 0 12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 20px 14px',
              background: '#0a2744',
              borderBottom: '1px solid #1a4a80',
              flexShrink: 0,
            }}
          >
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
        </div>

        {/* Right Cesium pane */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <CesiumViewer />
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
