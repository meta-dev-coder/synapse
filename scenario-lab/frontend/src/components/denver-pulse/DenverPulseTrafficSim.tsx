import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { trafficSimApi, NeighborhoodInfo, TrafficSimInitResponse, TrafficSimVehicle } from './api'
import useTrafficSimLoop from './useTrafficSimLoop'

const DenverPulseCesiumMap = React.lazy(() =>
  import('./DenverPulseCesiumMap').catch(() => ({
    default: () => <div style={{ padding: 32, color: '#888' }}>Map unavailable</div>,
  }))
)

const MODE_COLORS: Record<string, string> = {
  car: '#ff0000',
  truck: '#ff8800',
  van: '#ffff00',
  bus: '#0000ff',
  bike: '#00ff00',
}

const MODE_LABELS: Record<string, string> = {
  car: 'Car',
  truck: 'Truck',
  van: 'Van',
  bus: 'Bus',
  bike: 'Bike',
}

const DenverPulseTrafficSim: React.FC = () => {
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [simData, setSimData] = useState<TrafficSimInitResponse | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 2 | 5>(1)
  const [error, setError] = useState<string | null>(null)
  const repathingRef = useRef(false)

  // Fetch neighborhoods on mount
  useEffect(() => {
    trafficSimApi.getNeighborhoods()
      .then(data => setNeighborhoods(data))
      .catch(err => {
        console.warn('Failed to load neighborhoods:', err)
        setError('Failed to load neighborhoods. Is the backend running?')
      })
  }, [])

  // Handle neighborhood selection
  const handleSelectNeighborhood = useCallback(async (id: string) => {
    setSelectedId(id)
    setSimData(null)
    setPlaying(false)
    setLoading(true)
    setError(null)
    try {
      const data = await trafficSimApi.initTrafficSim({ neighborhood_id: id })
      setSimData(data)
    } catch (err) {
      console.error('Init traffic sim failed:', err)
      setError(`Failed to initialize simulation: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const mergeRef = useRef<((v: TrafficSimVehicle[]) => void) | null>(null)

  // onNeedRepath calls mergeVehicles via ref (avoids circular dependency)
  const onNeedRepath = useCallback((count: number) => {
    if (!selectedId || repathingRef.current) return
    repathingRef.current = true
    trafficSimApi.repathVehicles({ neighborhood_id: selectedId, count })
      .then(data => {
        if (mergeRef.current) mergeRef.current(data.vehicles)
      })
      .catch(err => console.warn('Repath failed:', err))
      .finally(() => { repathingRef.current = false })
  }, [selectedId])

  const { positions, mergeVehicles } = useTrafficSimLoop(
    simData?.vehicles ?? null,
    playing,
    speed,
    onNeedRepath,
  )
  mergeRef.current = mergeVehicles

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Cesium Map */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <Suspense fallback={<div style={{ padding: 32, color: '#888' }}>Loading map...</div>}>
          <DenverPulseCesiumMap
            metric="congestion"
            cesiumEdges={{}}
            height="100%"
            trafficSimPositions={positions.length > 0 ? positions : null}
            trafficSimBoundary={simData?.boundary ?? null}
          />
        </Suspense>

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 50, color: '#fff',
          }}>
            <div style={{
              width: 36, height: 36, border: '3px solid rgba(255,255,255,0.3)',
              borderTop: '3px solid #fff', borderRadius: '50%',
              animation: 'spin 1s linear infinite', marginBottom: 16,
            }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Fetching road network...</div>
            <div style={{ fontSize: 12, color: '#ccc', marginTop: 4 }}>First load may take 10-15s</div>
          </div>
        )}
      </div>

      {/* Right: Controls panel */}
      <div style={{
        width: 360, flexShrink: 0, background: '#f9fafb',
        borderLeft: '1px solid #e5e7eb', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Card 1: Select Neighborhood */}
        <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
            Select Neighborhood
          </div>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
              padding: '8px 12px', fontSize: 12, color: '#991b1b', marginBottom: 10,
            }}>
              {error}
            </div>
          )}
          <select
            value={selectedId ?? ''}
            onChange={e => e.target.value && handleSelectNeighborhood(e.target.value)}
            disabled={loading}
            style={{
              width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6,
              border: '1px solid #d1d5db', background: '#fff', color: '#111827',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <option value="">-- Choose a neighborhood --</option>
            {neighborhoods.map(n => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.area_km2.toFixed(1)} km2)
              </option>
            ))}
          </select>
        </div>

        {/* Card 2: Simulation Controls */}
        {simData && (
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
              Simulation Controls
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setPlaying(p => !p)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                  background: playing ? '#dc2626' : '#2563eb', color: '#fff',
                  fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              {([1, 2, 5] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  style={{
                    padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db',
                    background: speed === s ? '#2563eb' : '#fff',
                    color: speed === s ? '#fff' : '#374151',
                    fontWeight: 600, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#4b5563' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#111827' }}>{simData.stats.vehicle_count}</span> vehicles
              </div>
              <div>
                <span style={{ fontWeight: 600, color: '#111827' }}>{simData.stats.area_km2.toFixed(2)}</span> km2
              </div>
              <div>
                <span style={{ fontWeight: 600, color: '#111827' }}>{positions.length}</span> active
              </div>
            </div>
          </div>
        )}

        {/* Card 3: Mode Breakdown */}
        {simData && (
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
              Mode Breakdown
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(simData.stats.modes).map(([mode, count]) => (
                <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: MODE_COLORS[mode] ?? '#999', flexShrink: 0,
                    border: mode === 'van' ? '1px solid #ccc' : undefined,
                  }} />
                  <span style={{ color: '#374151', fontWeight: 500, flex: 1 }}>
                    {MODE_LABELS[mode] ?? mode}
                  </span>
                  <span style={{ color: '#111827', fontWeight: 600 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info section when no sim loaded */}
        {!simData && !loading && (
          <div style={{ padding: 20, color: '#6b7280', fontSize: 12, lineHeight: 1.6 }}>
            Select a neighborhood above to initialize a vehicle traffic simulation.
            The backend will fetch the road network from OSMnx, generate vehicle paths,
            and animate them on the Cesium map.
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default DenverPulseTrafficSim
