import React, { useRef } from 'react'
import type { DenverState, Action } from './DenverApp'
import TopBar from './TopBar'
import LeftNav from './LeftNav'
import DenverCesiumMap, { type DenverCesiumMapHandle } from './DenverCesiumMap'
import MapControls from './MapControls'
import BottomTimeline from './BottomTimeline'

interface GlobalLayoutProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
  onBack: () => void
  apiBase: string
  rightPanel?: React.ReactNode
  navExpansion?: React.ReactNode
}

export default function GlobalLayout({ state, dispatch, onBack, apiBase: _apiBase, rightPanel, navExpansion }: GlobalLayoutProps) {
  const mapRef = useRef<DenverCesiumMapHandle>(null)
  const currentGpsFrame = state.gpsFrames[state.gpsFrameIndex] ?? null

  // Scenario overlay corridors
  const scenarioOverlay = state.selectedScenarioId
    ? (state.savedScenarios.find(s => s.id === state.selectedScenarioId)?.results?.cesium_layer_data?.corridors ?? null)
    : null

  // Compare corridors
  const compareACorridors = state.compareAId
    ? (state.savedScenarios.find(s => s.id === state.compareAId)?.results?.cesium_layer_data?.corridors ?? null)
    : null
  const compareBCorridors = state.compareBId
    ? (state.savedScenarios.find(s => s.id === state.compareBId)?.results?.cesium_layer_data?.corridors ?? null)
    : null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--den-bg)',
      color: 'var(--den-text)',
      fontFamily: 'var(--den-font)',
    }}>
      <TopBar state={state} onBack={onBack} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LeftNav state={state} dispatch={dispatch} expansionContent={navExpansion} />

        {/* Map + controls area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <DenverCesiumMap
            ref={mapRef}
            layers={state.mapLayers}
            opacity={state.mapOpacity}
            intensity={state.mapIntensity}
            gpsFrame={currentGpsFrame}
            scenarioOverlay={scenarioOverlay as Record<string, number> | null}
            compareView={state.compareView}
            compareACorridors={compareACorridors as Record<string, number> | null}
            compareBCorridors={compareBCorridors as Record<string, number> | null}
            highlightDataSource={state.selectedDataSourceId}
          />
          <MapControls
            state={state}
            dispatch={dispatch}
            onZoomIn={() => mapRef.current?.zoomIn()}
            onZoomOut={() => mapRef.current?.zoomOut()}
            onResetView={() => mapRef.current?.resetView()}
          />

          {/* Scenario preview label */}
          {state.selectedScenarioId && state.screen === 'scenarios' && (() => {
            const s = state.savedScenarios.find(sc => sc.id === state.selectedScenarioId)
            return s ? (
              <div style={{
                position: 'absolute',
                top: 12,
                left: 12,
                background: 'rgba(30,41,59,0.9)',
                border: '1px solid var(--den-border)',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                color: 'var(--den-text)',
                pointerEvents: 'none',
              }}>
                Preview: {s.name}
              </div>
            ) : null
          })()}
        </div>

        {/* Right panel */}
        {rightPanel && (
          <div style={{
            width: 320,
            background: 'var(--den-panel)',
            borderLeft: '1px solid var(--den-border)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {rightPanel}
          </div>
        )}
      </div>

      <BottomTimeline state={state} dispatch={dispatch} />
    </div>
  )
}
