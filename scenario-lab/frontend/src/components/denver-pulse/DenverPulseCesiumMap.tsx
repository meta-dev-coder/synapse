import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as Cesium from 'cesium'

const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzU1YzQzMC0xYzYxLTQwZTAtYTNiMi0wZGM4MmQ0OGNhZWEiLCJpZCI6MzQ3OTY1LCJpYXQiOjE3NTk4MjI5NjN9.SyVlQADR9sojgRpFNUPjRFZajsCWXRWRwEUyJ9_pU1s'

type Metric = 'ghg' | 'mode' | 'speed' | 'congestion'

interface GpsBus {
  id: string; lat: number; lon: number; bearing: number
}
interface GpsFrame {
  t: number; ts: string; buses: GpsBus[]
}

interface VehiclePosition {
  lon: number
  lat: number
  mode: string
}

type DotColorMode = 'mode' | 'metric'

interface Props {
  metric: Metric
  cesiumEdges: Record<string, number>
  height?: string
  showBuses?: boolean
  trafficSimPositions?: VehiclePosition[] | null
  trafficSimBoundary?: number[][] | null  // [[lon,lat], ...]
  flyToBoundary?: boolean
  dotColorMode?: DotColorMode
}

// Bus SVG icon (blue circle with "B")
const BUS_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' +
  '<circle cx="11" cy="11" r="9" fill="#0078d4" stroke="#fff" stroke-width="1.5"/>' +
  '<text x="11" y="15" font-size="11" font-family="sans-serif" text-anchor="middle" fill="#fff" font-weight="bold">B</text>' +
  '</svg>'
)}`

// Full-city Denver corridors — same as original DenverCesiumMap.tsx
const CORRIDORS: Record<string, Cesium.Cartesian3[]> = {
  'I-25': Cesium.Cartesian3.fromDegreesArray([
    -104.9903, 39.6500, -104.9903, 39.7392, -104.9903, 39.8200,
  ]),
  'I-70': Cesium.Cartesian3.fromDegreesArray([
    -105.1300, 39.7600, -104.9000, 39.7600, -104.7500, 39.7600,
  ]),
  'E_Colfax': Cesium.Cartesian3.fromDegreesArray([
    -105.0700, 39.7404, -104.9500, 39.7404, -104.8500, 39.7404,
  ]),
  'S_Broadway': Cesium.Cartesian3.fromDegreesArray([
    -104.9878, 39.7000, -104.9878, 39.7392, -104.9878, 39.7700,
  ]),
  'Colorado_Blvd': Cesium.Cartesian3.fromDegreesArray([
    -104.9400, 39.6800, -104.9400, 39.7400, -104.9400, 39.7900,
  ]),
  'Speer_Blvd': Cesium.Cartesian3.fromDegreesArray([
    -104.9900, 39.7300, -104.9700, 39.7450, -104.9500, 39.7500,
  ]),
}

function corridorColor(metric: Metric, value: number): Cesium.Color {
  const t = Math.max(0, Math.min(1, value))
  if (metric === 'ghg' || metric === 'congestion') {
    if (t < 0.4) return Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.8)
    if (t < 0.7) return Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.8)
    return Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.8)
  }
  if (metric === 'speed') {
    // Inverted — high value = fast = green
    if (t > 0.6) return Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.8)
    if (t > 0.3) return Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.8)
    return Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.8)
  }
  // mode
  return Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.3 + 0.5 * t)
}

const MODE_DOT_COLORS: Record<string, Cesium.Color> = {
  car: Cesium.Color.fromCssColorString('#ff0000'),
  truck: Cesium.Color.fromCssColorString('#ff8800'),
  van: Cesium.Color.fromCssColorString('#ffff00'),
  bus: Cesium.Color.fromCssColorString('#0000ff'),
  bike: Cesium.Color.fromCssColorString('#00ff00'),
}
const DEFAULT_DOT_COLOR = Cesium.Color.fromCssColorString('#999999')

const METRIC_DOT_COLORS: Record<Metric, Cesium.Color> = {
  ghg: Cesium.Color.fromCssColorString('#ef4444'),
  congestion: Cesium.Color.fromCssColorString('#f59e0b'),
  speed: Cesium.Color.fromCssColorString('#22c55e'),
  mode: Cesium.Color.fromCssColorString('#3b82f6'),
}

// Denver metro bounding box for validation
const DENVER_BOUNDS = { west: -105.2, east: -104.7, south: 39.5, north: 39.95 }

const DenverPulseCesiumMap: React.FC<Props> = ({ metric, cesiumEdges, height = '100%', showBuses = false, trafficSimPositions, trafficSimBoundary, flyToBoundary = false, dotColorMode = 'mode' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const busEntityMap = useRef<Map<string, Cesium.Entity>>(new Map())
  const corridorEntityMap = useRef<Map<string, Cesium.Entity>>(new Map())
  const [gpsFrames, setGpsFrames] = useState<GpsFrame[]>([])
  const [frameIndex, setFrameIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [busTooltip, setBusTooltip] = useState<{ busId: string; x: number; y: number } | null>(null)
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pointCollectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null)
  const boundaryEntityRef = useRef<Cesium.Entity | null>(null)

  // Initialize Cesium viewer — OSM tiles base layer (2D street map, same as original)
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return
    Cesium.Ion.defaultAccessToken = ION_TOKEN

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Promise.resolve(new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: '© OpenStreetMap contributors',
          tileWidth: 256, tileHeight: 256,
          minimumLevel: 0, maximumLevel: 19,
        }))
      ),
      baseLayerPicker: false, navigationHelpButton: false, sceneModePicker: false,
      geocoder: false, homeButton: false, fullscreenButton: false,
      animation: false, timeline: false, infoBox: false, selectionIndicator: false,
    })
    viewerRef.current = viewer

    // Center on Denver city center — truly instant, no zoom animation
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-104.9903, 39.7392, 45000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90), // top-down view
        roll: 0,
      },
    })

    // Disable default fly-to on double-click (prevents unwanted zoom)
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    )

    // Mouse move → show lat/lon coordinates
    const moveHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    moveHandler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid)
      if (cartesian) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian)
        setMouseCoords({
          lat: Cesium.Math.toDegrees(carto.latitude),
          lon: Cesium.Math.toDegrees(carto.longitude),
        })
      } else {
        setMouseCoords(null)
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    // Draw initial corridors
    for (const [name, positions] of Object.entries(CORRIDORS)) {
      const entity = viewer.entities.add({
        id: `corridor-${name}`,
        polyline: {
          positions,
          width: 3,
          material: new Cesium.ColorMaterialProperty(corridorColor(metric, 0.7)),
          clampToGround: true,
        },
      })
      corridorEntityMap.current.set(name, entity)
    }

    // Bus click tooltip
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(event.position)
      if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
        const eid: string = picked.id.id as string
        if (eid.startsWith('bus-')) {
          setBusTooltip({ busId: eid.replace('bus-', ''), x: event.position.x, y: event.position.y })
          return
        }
      }
      setBusTooltip(null)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      moveHandler.destroy()
      handler.destroy()
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch GPS frames when showBuses enabled
  useEffect(() => {
    if (!showBuses) return
    fetch('http://localhost:8000/api/v1/denver/gps/positions')
      .then(r => r.json())
      .then((data: { frame_count: number; frames: GpsFrame[] }) => {
        setGpsFrames(data.frames || [])
      })
      .catch(err => console.warn('GPS data unavailable:', err))
  }, [showBuses])

  // Auto-play bus frames
  useEffect(() => {
    if (!showBuses || !playing || gpsFrames.length === 0) return
    intervalRef.current = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % gpsFrames.length)
    }, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [showBuses, playing, gpsFrames.length])

  // Update corridor colors when metric or cesiumEdges change
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    for (const [name] of Object.entries(CORRIDORS)) {
      const entity = corridorEntityMap.current.get(name)
      if (!entity?.polyline) continue
      const value = cesiumEdges[name] ?? 0.7
      entity.polyline.material = new Cesium.ColorMaterialProperty(corridorColor(metric, value))
    }
  }, [metric, cesiumEdges])

  // Render bus billboards for current frame
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !showBuses || gpsFrames.length === 0) return
    const frame = gpsFrames[frameIndex]
    if (!frame) return

    const seen = new Set<string>()
    for (const bus of frame.buses) {
      seen.add(bus.id)
      const pos = Cesium.Cartesian3.fromDegrees(bus.lon, bus.lat, 0)
      const existing = busEntityMap.current.get(bus.id)
      if (existing) {
        existing.position = new Cesium.ConstantPositionProperty(pos)
      } else {
        const entity = viewer.entities.add({
          id: `bus-${bus.id}`,
          position: pos,
          billboard: {
            image: BUS_ICON, width: 22, height: 22,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
          },
        })
        busEntityMap.current.set(bus.id, entity)
      }
    }
    // Remove stale
    for (const [id, entity] of busEntityMap.current) {
      if (!seen.has(id)) {
        viewer.entities.remove(entity)
        busEntityMap.current.delete(id)
      }
    }
  }, [showBuses, frameIndex, gpsFrames])

  // ---- Traffic Sim: vehicle dot PointPrimitiveCollection ----
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!trafficSimPositions || trafficSimPositions.length === 0) {
      // Clear if no positions
      if (pointCollectionRef.current) {
        pointCollectionRef.current.removeAll()
      }
      return
    }

    // Lazily create the collection
    if (!pointCollectionRef.current) {
      pointCollectionRef.current = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection()
      ) as Cesium.PointPrimitiveCollection
    }

    const pc = pointCollectionRef.current
    pc.removeAll()
    for (const p of trafficSimPositions) {
      const color = dotColorMode === 'metric'
        ? METRIC_DOT_COLORS[metric] ?? DEFAULT_DOT_COLOR
        : MODE_DOT_COLORS[p.mode] ?? DEFAULT_DOT_COLOR
      pc.add({
        position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0),
        pixelSize: 6,
        color,
      })
    }
  }, [trafficSimPositions, dotColorMode, metric])

  // ---- Traffic Sim: boundary polygon ----
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // Remove old boundary
    if (boundaryEntityRef.current) {
      viewer.entities.remove(boundaryEntityRef.current)
      boundaryEntityRef.current = null
    }

    if (!trafficSimBoundary || trafficSimBoundary.length === 0) {
      // Reset camera to Denver center when boundary is cleared
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-104.9903, 39.7392, 45000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      })
      return
    }

    // Flatten [[lon,lat],...] to [lon,lat,lon,lat,...]
    const flat: number[] = []
    for (const coord of trafficSimBoundary) {
      flat.push(coord[0], coord[1])
    }

    const entity = viewer.entities.add({
      id: 'traffic-sim-boundary',
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(flat),
        material: Cesium.Color.fromCssColorString('rgba(0,255,255,0.1)'),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        outlineWidth: 2,
      },
    })
    boundaryEntityRef.current = entity

    // Only fly to boundary if explicitly requested (Traffic Sim view)
    if (flyToBoundary) {
      const lons = trafficSimBoundary.map(c => c[0])
      const lats = trafficSimBoundary.map(c => c[1])
      const west = Math.min(...lons)
      const east = Math.max(...lons)
      const south = Math.min(...lats)
      const north = Math.max(...lats)

      // Validate bounds are within Denver metro area
      if (
        west >= DENVER_BOUNDS.west && east <= DENVER_BOUNDS.east &&
        south >= DENVER_BOUNDS.south && north <= DENVER_BOUNDS.north
      ) {
        viewer.camera.flyTo({
          destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
          duration: 1.5,
        })
      } else {
        // Fallback to Denver center if bounds are outside Denver
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(-104.9903, 39.7392, 45000),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        })
      }
    }
  }, [trafficSimBoundary, flyToBoundary])

  const togglePlay = useCallback(() => setPlaying(p => !p), [])

  return (
    <div style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Bus playback controls */}
      {showBuses && gpsFrames.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          background: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 10,
        }}>
          <button onClick={togglePlay}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14 }}
          >{playing ? '⏸' : '▶'}</button>
          <input type="range" min={0} max={gpsFrames.length - 1} value={frameIndex}
            onChange={e => { setFrameIndex(parseInt(e.target.value)); setPlaying(false) }}
            style={{ flex: 1 }}
          />
          <span style={{ color: '#fff', fontSize: 10, whiteSpace: 'nowrap' }}>
            {frameIndex + 1}/{gpsFrames.length} · {gpsFrames[frameIndex]?.ts?.slice(11, 16) || ''}
          </span>
          <span style={{ color: '#60a5fa', fontSize: 10, whiteSpace: 'nowrap' }}>
            {gpsFrames[frameIndex]?.buses?.length || 0} buses
          </span>
        </div>
      )}

      {/* Mouse lat/lon display */}
      {mouseCoords && (
        <div style={{
          position: 'absolute', bottom: showBuses && gpsFrames.length > 0 ? 48 : 8, left: 8,
          background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '4px 8px',
          fontSize: 10, color: '#fff', fontFamily: 'monospace', zIndex: 10, pointerEvents: 'none',
        }}>
          {mouseCoords.lat.toFixed(5)}°N, {mouseCoords.lon.toFixed(5)}°W
        </div>
      )}

      {/* Bus click tooltip */}
      {busTooltip && (
        <div style={{
          position: 'absolute', left: busTooltip.x + 12, top: busTooltip.y - 8,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
          padding: '8px 12px', fontSize: 12, color: '#111827',
          pointerEvents: 'none', zIndex: 100, minWidth: 140, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Bus {busTooltip.busId}</div>
          <div style={{ color: '#6b7280' }}>Route: RTD-{(parseInt(busTooltip.busId) % 50) + 1}</div>
        </div>
      )}
    </div>
  )
}

export default DenverPulseCesiumMap
