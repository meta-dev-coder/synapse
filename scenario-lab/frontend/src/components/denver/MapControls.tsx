import { useState } from 'react'
import type { DenverState, Action } from './DenverApp'

interface MapControlsProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetView?: () => void
}

const QUICK_LAYERS = ['traffic', 'emissions', 'bus', 'corridors'] as const
const LAYER_LABELS: Record<string, string> = {
  traffic: 'Traffic', emissions: 'Emissions', bus: 'Bus', corridors: 'Corridors',
}
const DROPDOWN_LAYERS = [
  { key: 'roads', label: 'Roads' },
  { key: 'bus', label: 'Bus Routes' },
  { key: 'stops', label: 'Stops' },
  { key: 'intersections', label: 'Intersections' },
  { key: 'ev_stations', label: 'EV Stations' },
] as const

export default function MapControls({ state, dispatch, onZoomIn, onZoomOut, onResetView }: MapControlsProps) {
  const [layersOpen, setLayersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const pill = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        background: active ? 'var(--den-success)' : 'var(--den-surface)',
        border: '1px solid var(--den-border)',
        color: active ? '#fff' : 'var(--den-text-muted)',
        padding: '5px 11px',
        borderRadius: 20,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        boxShadow: active ? '0 0 6px var(--den-success)' : 'none',
        transition: 'background 300ms ease, color 300ms ease, box-shadow 300ms ease',
      }}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* Top-Right: Layer toggles */}
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, flexWrap: 'wrap', zIndex: 10 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setLayersOpen(o => !o)}
            style={{
              background: 'var(--den-surface)',
              border: '1px solid var(--den-border)',
              color: 'var(--den-text)',
              padding: '5px 11px',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Layers ▾
          </button>
          {layersOpen && (
            <div style={{
              position: 'absolute',
              top: 36,
              right: 0,
              background: 'var(--den-panel)',
              border: '1px solid var(--den-border)',
              borderRadius: 8,
              padding: 12,
              minWidth: 160,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              zIndex: 20,
            }}>
              {DROPDOWN_LAYERS.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: 'var(--den-text)' }}>
                  <input
                    type="checkbox"
                    checked={state.mapLayers[key as keyof typeof state.mapLayers]}
                    onChange={() => dispatch({ type: 'TOGGLE_LAYER', layer: key as keyof DenverState['mapLayers'] })}
                    style={{ accentColor: 'var(--den-primary)' }}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
        {QUICK_LAYERS.map(layer =>
          pill(
            LAYER_LABELS[layer],
            state.mapLayers[layer],
            () => dispatch({ type: 'TOGGLE_LAYER', layer }),
          )
        )}
      </div>

      {/* Top-Left: Context controls */}
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8, zIndex: 10 }}>
        <select
          value={state.timeFilter}
          onChange={e => dispatch({ type: 'SET_TIME_FILTER', value: e.target.value as DenverState['timeFilter'] })}
          style={{
            background: 'var(--den-surface)',
            border: '1px solid var(--den-border)',
            color: 'var(--den-text)',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <option value="peak">Morning Peak</option>
          <option value="midday">Midday</option>
          <option value="evening">Evening Peak</option>
          <option value="full_day">Full Day</option>
        </select>
        <select
          value={state.dayRange}
          onChange={e => dispatch({ type: 'SET_DAY_RANGE', value: e.target.value as DenverState['dayRange'] })}
          style={{
            background: 'var(--den-surface)',
            border: '1px solid var(--den-border)',
            color: 'var(--den-text)',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      {/* Bottom-Left: Navigation */}
      <div style={{ position: 'absolute', bottom: 72, left: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
        {[
          { label: '+', onClick: onZoomIn },
          { label: '−', onClick: onZoomOut },
          { label: '⌖', onClick: onResetView },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              background: 'var(--den-surface)',
              border: '1px solid var(--den-border)',
              color: 'var(--den-text)',
              width: 32,
              height: 32,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bottom-Right: Settings */}
      <div style={{ position: 'absolute', bottom: 72, right: 12, zIndex: 10 }}>
        <button
          onClick={() => setSettingsOpen(o => !o)}
          style={{
            background: 'var(--den-surface)',
            border: '1px solid var(--den-border)',
            color: 'var(--den-text)',
            width: 32,
            height: 32,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ⚙
        </button>
        {settingsOpen && (
          <div style={{
            position: 'absolute',
            bottom: 40,
            right: 0,
            background: 'var(--den-panel)',
            border: '1px solid var(--den-border)',
            borderRadius: 8,
            padding: 14,
            width: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--den-text-muted)', display: 'block', marginBottom: 4 }}>
                Opacity
              </label>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={state.mapOpacity}
                onChange={e => dispatch({ type: 'SET_MAP_OPACITY', value: Number(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--den-primary)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--den-text-muted)', display: 'block', marginBottom: 4 }}>
                Intensity
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['low', 'medium', 'high'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => dispatch({ type: 'SET_MAP_INTENSITY', value: v })}
                    style={{
                      flex: 1,
                      background: state.mapIntensity === v ? 'var(--den-primary)' : 'var(--den-surface)',
                      border: '1px solid var(--den-border)',
                      color: state.mapIntensity === v ? '#fff' : 'var(--den-text-muted)',
                      padding: '4px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
