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

export type ScenarioType = 'toll' | 'corridor' | 'emission' | 'evasion' | 'comparison' | 'asset_health' | 'predictive_maint'
export type RampType = 'traffic' | 'emission' | 'risk' | 'congestion' | null
export type ViewMode = 'lines' | 'model'

export interface SimulationResult {
  cesium_heatmap?: Record<string, number>
  [key: string]: unknown
}

// ─── View Mode Toggle ─────────────────────────────────────────────────────────

interface ViewToggleProps {
  mode: ViewMode
  onChange: (m: ViewMode) => void
}

const ViewToggle: React.FC<ViewToggleProps> = ({ mode, onChange }) => {
  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: '5px 0',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    letterSpacing: 0.3,
  }

  return (
    <div style={{ padding: '10px 20px 12px', background: '#0a2744', borderBottom: '1px solid #1a4a80', flexShrink: 0 }}>
      <div style={{ fontSize: 10, color: '#5577aa', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
        View Mode
      </div>
      <div style={{ display: 'flex', gap: 4, background: '#06192e', borderRadius: 5, padding: 3 }}>
        <button
          type="button"
          style={{
            ...btnBase,
            background: mode === 'lines' ? '#1a4a80' : 'transparent',
            color: mode === 'lines' ? '#e0e0e0' : '#5577aa',
          }}
          onClick={() => onChange('lines')}
        >
          Lane Lines
        </button>
        <button
          type="button"
          style={{
            ...btnBase,
            background: mode === 'model' ? '#e94560' : 'transparent',
            color: mode === 'model' ? '#fff' : '#5577aa',
          }}
          onClick={() => onChange('model')}
        >
          3D Model
        </button>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('toll')
  const [cesiumHeatmap, setCesiumHeatmap] = useState<Record<string, number>>({})
  const [rampType, setRampType] = useState<RampType>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('lines')

  const handleSimulationResult = useCallback(
    (result: SimulationResult, ramp: RampType) => {
      setCesiumHeatmap(result.cesium_heatmap ?? {})
      setRampType(ramp)
    },
    []
  )

  const handleScenarioChange = useCallback((scenario: ScenarioType) => {
    setActiveScenario(scenario)
    setCesiumHeatmap({})
    setRampType(null)
  }, [])

  const renderScenario = () => {
    switch (activeScenario) {
      case 'toll':
        return <TollScenario onResult={(r) => handleSimulationResult(r, 'traffic')} />
      case 'corridor':
        return <CorridorScenario onResult={(r) => handleSimulationResult(r, 'congestion')} />
      case 'emission':
        return <EmissionScenario onResult={(r) => handleSimulationResult(r, 'emission')} />
      case 'evasion':
        return <EvasionScenario onResult={(r) => handleSimulationResult(r, 'risk')} />
      case 'comparison':
        return <ComparisonScenario onResult={(r) => handleSimulationResult(r, null)} />
      case 'asset_health':
        return <AssetHealthScenario onResult={(r) => handleSimulationResult(r, null)} />
      case 'predictive_maint':
        return <PredictiveMaintScenario onResult={(r) => handleSimulationResult(r, null)} />
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
              A10-West Toll Plaza POC
            </div>
          </div>

          {/* View mode toggle */}
          <ViewToggle mode={viewMode} onChange={setViewMode} />

          {/* Scenario tabs */}
          <ScenarioTabs active={activeScenario} onChange={handleScenarioChange} />

          {/* Scenario panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
            {renderScenario()}
          </div>
        </div>

        {/* Right Cesium pane */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <CesiumViewer
            heatmap={cesiumHeatmap}
            rampType={rampType}
            viewMode={viewMode}
          />
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
