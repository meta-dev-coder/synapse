import React, { useEffect, useRef, useState, memo } from 'react'
import * as Cesium from 'cesium'

const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzU1YzQzMC0xYzYxLTQwZTAtYTNiMi0wZGM4MmQ0OGNhZWEiLCJpZCI6MzQ3OTY1LCJpYXQiOjE3NTk4MjI5NjN9.SyVlQADR9sojgRpFNUPjRFZajsCWXRWRwEUyJ9_pU1s'

import { dpLog } from './dpLog'

type Metric = 'ghg' | 'mode' | 'speed' | 'congestion'
type DotColorMode = 'mode' | 'metric'

interface VehiclePosition {
  lon: number
  lat: number
  mode: string
}

interface Props {
  metric: Metric
  cesiumEdges: Record<string, number>
  height?: string
  trafficSimPositions?: VehiclePosition[] | null
  trafficSimBoundary?: number[][] | null
  dotColorMode?: DotColorMode
  cameraAltitude?: number
}

// Denver corridor positions (lon, lat pairs)
const CORRIDOR_DEFS: Record<string, number[]> = {
  'I-25': [-104.9903, 39.6500, -104.9903, 39.7392, -104.9903, 39.8200],
  'I-70': [-105.1300, 39.7600, -104.9000, 39.7600, -104.7500, 39.7600],
  'E_Colfax': [-105.0700, 39.7404, -104.9500, 39.7404, -104.8500, 39.7404],
  'S_Broadway': [-104.9878, 39.7000, -104.9878, 39.7392, -104.9878, 39.7700],
  'Colorado_Blvd': [-104.9400, 39.6800, -104.9400, 39.7400, -104.9400, 39.7900],
  'Speer_Blvd': [-104.9900, 39.7300, -104.9700, 39.7450, -104.9500, 39.7500],
}

function corridorCssColor(metric: Metric, value: number): string {
  const t = Math.max(0, Math.min(1, value))
  if (metric === 'ghg' || metric === 'congestion') {
    if (t < 0.4) return 'rgba(34,197,94,0.8)'
    if (t < 0.7) return 'rgba(245,158,11,0.8)'
    return 'rgba(239,68,68,0.8)'
  }
  if (metric === 'speed') {
    if (t > 0.6) return 'rgba(34,197,94,0.8)'
    if (t > 0.3) return 'rgba(245,158,11,0.8)'
    return 'rgba(239,68,68,0.8)'
  }
  const a = 0.3 + 0.5 * t
  return `rgba(59,130,246,${a})`
}

// Vehicle point configs per mode
const VEHICLE_POINT_CONFIGS: Record<string, { pixelSize: number; color: Cesium.Color; outlineColor: Cesium.Color; outlineWidth: number }> = {
  car: { pixelSize: 8, color: Cesium.Color.RED, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
  bus: { pixelSize: 12, color: Cesium.Color.BLUE, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
  truck: { pixelSize: 10, color: Cesium.Color.fromCssColorString('#ff8800'), outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
  bike: { pixelSize: 5, color: Cesium.Color.GREEN, outlineColor: Cesium.Color.WHITE, outlineWidth: 1 },
  van: { pixelSize: 8, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
}

const METRIC_DOT_COLORS: Record<Metric, Cesium.Color> = {
  ghg: Cesium.Color.fromCssColorString('#ef4444'),
  congestion: Cesium.Color.fromCssColorString('#f59e0b'),
  speed: Cesium.Color.fromCssColorString('#22c55e'),
  mode: Cesium.Color.fromCssColorString('#3b82f6'),
}

const DENVER_BOUNDS = { west: -105.2, east: -104.7, south: 39.5, north: 39.95 }
const DENVER_CENTER = { lon: -104.9903, lat: 39.7392 }

let renderCount = 0

const DenverPulseCesiumMap: React.FC<Props> = memo(({
  metric, cesiumEdges, height = '100%',
  trafficSimPositions, trafficSimBoundary,
  dotColorMode = 'mode',
  cameraAltitude = 7000,
}) => {
  renderCount++
  if (renderCount <= 10 || renderCount % 50 === 0) {
    dpLog('MAP:render', `#${renderCount}`, {
      metric,
      edgeKeys: Object.keys(cesiumEdges),
      posCount: trafficSimPositions?.length ?? 0,
      boundary: !!trafficSimBoundary,
      altitude: cameraAltitude,
    })
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const initingRef = useRef(false) // FIX #1: prevent double async init
  const corridorPrimitivesRef = useRef<Map<string, Cesium.Polyline>>(new Map())
  const polylineCollectionRef = useRef<Cesium.PolylineCollection | null>(null)
  const boundaryPolylineRef = useRef<Cesium.Polyline | null>(null) // FIX #2: polyline instead of Entity polygon
  const boundaryCollectionRef = useRef<Cesium.PolylineCollection | null>(null)
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [cameraLocked, setCameraLocked] = useState(false)
  // Stored zone fly-to destination — set when boundary arrives, used by button
  const zoneFlyDestRef = useRef<{ lon: number; lat: number; alt: number } | null>(null)

  // Initialize Cesium viewer
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return
    // FIX #1: guard against StrictMode double-mount async race
    if (initingRef.current) return
    initingRef.current = true

    Cesium.Ion.defaultAccessToken = ION_TOKEN

    dpLog('MAP:init', 'starting viewer init')
    let cancelled = false

    const initViewer = async () => {
      if (!containerRef.current) return

      let baseLayer: Cesium.ImageryLayer | undefined
      let imagerySource = 'unknown'
      try {
        dpLog('MAP:imagery', 'requesting Ion World Imagery ROAD...')
        const imageryProvider = await Cesium.createWorldImageryAsync({
          style: Cesium.IonWorldImageryStyle.ROAD,
        })
        if (cancelled) return // component unmounted during await
        baseLayer = new Cesium.ImageryLayer(imageryProvider)
        imagerySource = 'ion-road'
        dpLog('MAP:imagery', 'Ion imagery OK')
      } catch (err) {
        if (cancelled) return
        dpLog('MAP:imagery', 'Ion FAILED, falling back to OSM', err)
        baseLayer = Cesium.ImageryLayer.fromProviderAsync(
          Promise.resolve(new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            credit: '© OpenStreetMap contributors',
            tileWidth: 256, tileHeight: 256,
            minimumLevel: 0, maximumLevel: 19,
          }))
        )
        imagerySource = 'osm-fallback'
      }

      if (cancelled || !containerRef.current) return

      dpLog('MAP:viewer', 'creating Cesium.Viewer...', { imagerySource })
      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayer,
        baseLayerPicker: false, navigationHelpButton: false, sceneModePicker: false,
        geocoder: false, homeButton: false, fullscreenButton: false,
        animation: false, timeline: false, infoBox: false, selectionIndicator: false,
      })
      viewerRef.current = viewer
      dpLog('MAP:viewer', 'viewer created OK')

      // Performance: cap resolution, disable expensive effects
      viewer.resolutionScale = 1.0
      viewer.scene.fog.enabled = false
      viewer.scene.globe.showGroundAtmosphere = false
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false

      // Center on Denver
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(DENVER_CENTER.lon, DENVER_CENTER.lat, cameraAltitude),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      })
      dpLog('MAP:camera', `setView at altitude=${cameraAltitude}m`)

      // Disable double-click zoom
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      )

      // Mouse move → lat/lon
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

      // Draw corridors using PolylineCollection (primitive — NO geometry workers)
      dpLog('MAP:corridors', 'adding PolylineCollection...')
      const plc = viewer.scene.primitives.add(new Cesium.PolylineCollection()) as Cesium.PolylineCollection
      polylineCollectionRef.current = plc

      for (const [name, coords] of Object.entries(CORRIDOR_DEFS)) {
        const positions = Cesium.Cartesian3.fromDegreesArray(coords)
        const polyline = plc.add({
          positions,
          width: 3,
          material: Cesium.Material.fromType('Color', {
            color: Cesium.Color.fromCssColorString(corridorCssColor(metric, 0.7)),
          }),
        })
        corridorPrimitivesRef.current.set(name, polyline)
      }

      // FIX #2: Pre-create boundary PolylineCollection (will be used for zone outlines)
      const blc = viewer.scene.primitives.add(new Cesium.PolylineCollection()) as Cesium.PolylineCollection
      boundaryCollectionRef.current = blc

      dpLog('MAP:corridors', `${Object.keys(CORRIDOR_DEFS).length} corridors added`)
      dpLog('MAP:init', 'viewer init COMPLETE')
    }

    initViewer()

    return () => {
      cancelled = true
      dpLog('MAP:cleanup', 'destroying viewer')
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.entities.removeAll()
        viewerRef.current.destroy()
        viewerRef.current = null
      }
      corridorPrimitivesRef.current.clear()
      polylineCollectionRef.current = null
      boundaryCollectionRef.current = null
      boundaryPolylineRef.current = null
      initingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // No auto-fly on altitude change — user controls camera manually via buttons

  // Update corridor colors — PolylineCollection material updates (no geometry pipeline)
  const prevMetricRef = useRef(metric)
  const prevEdgesRef = useRef(cesiumEdges)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    if (metric === prevMetricRef.current && cesiumEdges === prevEdgesRef.current) return
    prevMetricRef.current = metric
    prevEdgesRef.current = cesiumEdges

    const hasEdges = Object.keys(cesiumEdges).length > 0
    dpLog('MAP:corridors:update', `metric=${metric}`, hasEdges ? 'visible' : 'hidden')

    // Hide corridors when in zone mode (no edges passed)
    if (polylineCollectionRef.current) {
      polylineCollectionRef.current.show = hasEdges
    }

    if (hasEdges) {
      for (const [name] of Object.entries(CORRIDOR_DEFS)) {
        const polyline = corridorPrimitivesRef.current.get(name)
        if (!polyline) continue
        const value = cesiumEdges[name] ?? 0.7
        polyline.material = Cesium.Material.fromType('Color', {
          color: Cesium.Color.fromCssColorString(corridorCssColor(metric, value)),
        })
      }
    }
  }, [metric, cesiumEdges])

  // Vehicle rendering — PointPrimitiveCollection (GPU-batched, no geometry workers)
  const pointCollectionRef = useRef<Cesium.PointPrimitiveCollection | null>(null)
  const vehicleUpdateCount = useRef(0)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!trafficSimPositions || trafficSimPositions.length === 0) {
      if (pointCollectionRef.current) {
        pointCollectionRef.current.removeAll()
        dpLog('MAP:vehicles', 'cleared all points (no positions)')
      }
      return
    }

    vehicleUpdateCount.current++
    const shouldLog = vehicleUpdateCount.current <= 5 || vehicleUpdateCount.current % 20 === 0

    if (shouldLog) {
      dpLog('MAP:vehicles', `update #${vehicleUpdateCount.current}`, {
        count: trafficSimPositions.length,
        pcExists: !!pointCollectionRef.current,
        pcLength: pointCollectionRef.current?.length ?? 0,
      })
    }

    const t0 = performance.now()

    // Lazily create collection
    if (!pointCollectionRef.current) {
      dpLog('MAP:vehicles', 'creating PointPrimitiveCollection')
      pointCollectionRef.current = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection()
      ) as Cesium.PointPrimitiveCollection
    }

    const pc = pointCollectionRef.current
    const len = trafficSimPositions.length

    for (let i = 0; i < len; i++) {
      const p = trafficSimPositions[i]
      const config = VEHICLE_POINT_CONFIGS[p.mode] || VEHICLE_POINT_CONFIGS.car
      const color = dotColorMode === 'metric'
        ? METRIC_DOT_COLORS[metric] ?? config.color
        : config.color
      const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, 0)

      if (i < pc.length) {
        const existing = pc.get(i)
        existing.position = pos
        existing.color = color
        existing.pixelSize = config.pixelSize
      } else {
        pc.add({ position: pos, pixelSize: config.pixelSize, color, outlineColor: config.outlineColor, outlineWidth: config.outlineWidth })
      }
    }
    while (pc.length > len) {
      pc.remove(pc.get(pc.length - 1))
    }

    if (shouldLog) {
      dpLog('MAP:vehicles', `update #${vehicleUpdateCount.current} took ${(performance.now() - t0).toFixed(1)}ms, pcLength=${pc.length}`)
    }
  }, [trafficSimPositions, dotColorMode, metric])

  // Track whether we've ever had a boundary
  const hadBoundaryRef = useRef(false)

  // FIX #2: Boundary outline using PolylineCollection (NO Entity = NO geometry workers)
  useEffect(() => {
    const viewer = viewerRef.current
    const blc = boundaryCollectionRef.current
    if (!viewer || viewer.isDestroyed() || !blc) return

    // Remove old boundary polyline
    if (boundaryPolylineRef.current) {
      blc.remove(boundaryPolylineRef.current)
      boundaryPolylineRef.current = null
    }

    if (!trafficSimBoundary || trafficSimBoundary.length === 0) {
      hadBoundaryRef.current = false
      zoneFlyDestRef.current = null
      // Unlock camera when zone is deselected
      viewer.scene.screenSpaceCameraController.enableInputs = true
      setCameraLocked(false)
      return
    }

    hadBoundaryRef.current = true

    // Simplify boundary: take every Nth point to keep under 50 vertices
    let coords = trafficSimBoundary
    if (coords.length > 50) {
      const step = Math.ceil(coords.length / 50)
      coords = coords.filter((_, i) => i % step === 0)
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push(coords[0])
      }
    }

    dpLog('MAP:boundary', `adding polyline outline, ${coords.length} coords (simplified from ${trafficSimBoundary.length})`)

    const flat: number[] = []
    for (const coord of coords) {
      flat.push(coord[0], coord[1])
    }
    if (flat.length >= 4 && (flat[0] !== flat[flat.length - 2] || flat[1] !== flat[flat.length - 1])) {
      flat.push(flat[0], flat[1])
    }

    const positions = Cesium.Cartesian3.fromDegreesArray(flat)
    const polyline = blc.add({
      positions,
      width: 2,
      material: Cesium.Material.fromType('Color', {
        color: Cesium.Color.CYAN.withAlpha(0.8),
      }),
    })
    boundaryPolylineRef.current = polyline

    // Compute and store fly-to destination for the manual "Fly to zone" button.
    // No auto-fly — camera stays where the user left it.
    const lons = trafficSimBoundary.map(c => c[0])
    const lats = trafficSimBoundary.map(c => c[1])
    const west = Math.min(...lons)
    const east = Math.max(...lons)
    const south = Math.min(...lats)
    const north = Math.max(...lats)
    if (
      west >= DENVER_BOUNDS.west && east <= DENVER_BOUNDS.east &&
      south >= DENVER_BOUNDS.south && north <= DENVER_BOUNDS.north
    ) {
      const centerLon = (west + east) / 2
      const centerLat = (south + north) / 2
      const spanMetres = Math.max((east - west) * 111320, (north - south) * 110540)
      const altitudeM = Math.max(spanMetres * 1.2, 2000)
      zoneFlyDestRef.current = { lon: centerLon, lat: centerLat, alt: altitudeM }
      dpLog('MAP:boundary', `zone dest stored: center (${centerLon.toFixed(4)},${centerLat.toFixed(4)}) alt=${altitudeM.toFixed(0)}m`)
      // Lock camera first, then fly — so the lock holds even if user touches the map
      // during the animation (which would otherwise cancel the complete callback)
      viewer.scene.screenSpaceCameraController.enableInputs = false
      setCameraLocked(true)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, altitudeM),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 1.5,
      })
    }
  }, [trafficSimBoundary, cameraAltitude])

  // Camera control helpers
  const toggleLock = () => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    const newLocked = !cameraLocked
    viewer.scene.screenSpaceCameraController.enableInputs = !newLocked
    setCameraLocked(newLocked)
  }

  const zoomIn = () => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.4)
  }
  const zoomOut = () => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5)
  }
  const resetCamera = () => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(DENVER_CENTER.lon, DENVER_CENTER.lat, 7000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 1.2,
    })
  }
  const flyToZone = () => {
    const viewer = viewerRef.current
    const dest = zoneFlyDestRef.current
    if (!viewer || viewer.isDestroyed() || !dest) return
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(dest.lon, dest.lat, dest.alt),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
      duration: 1.5,
    })
  }

  const camBtnStyle: React.CSSProperties = {
    width: 32, height: 32,
    background: 'rgba(15,23,42,0.85)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none',
  }

  return (
    <div style={{ width: '100%', height, position: 'relative', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Camera controls */}
      <div style={{
        position: 'absolute', right: 10, top: 10,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10,
      }}>
        <button style={camBtnStyle} onClick={zoomIn} title="Zoom in">+</button>
        <button style={camBtnStyle} onClick={zoomOut} title="Zoom out">−</button>
        <button style={{ ...camBtnStyle, fontSize: 12, marginTop: 4 }} onClick={resetCamera} title="Reset to Denver overview">⌂</button>
        {trafficSimBoundary && trafficSimBoundary.length > 0 && (
          <button
            style={{ ...camBtnStyle, fontSize: 11, marginTop: 4, width: 'auto', padding: '0 8px', whiteSpace: 'nowrap' }}
            onClick={flyToZone}
            title="Fly to selected zone"
          >
            ⊙ Zone
          </button>
        )}
        <button
          style={{
            ...camBtnStyle,
            fontSize: 13,
            marginTop: 4,
            background: cameraLocked ? 'rgba(37,99,235,0.9)' : 'rgba(15,23,42,0.85)',
            borderColor: cameraLocked ? 'rgba(147,197,253,0.4)' : 'rgba(255,255,255,0.15)',
          }}
          onClick={toggleLock}
          title={cameraLocked ? 'Unlock camera (allow pan/zoom)' : 'Lock camera (freeze position)'}
        >
          {cameraLocked ? '🔒' : '🔓'}
        </button>
      </div>

      {mouseCoords && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '4px 8px',
          fontSize: 10, color: '#fff', fontFamily: 'monospace', zIndex: 10, pointerEvents: 'none',
        }}>
          {mouseCoords.lat.toFixed(5)}°N, {mouseCoords.lon.toFixed(5)}°W
        </div>
      )}
    </div>
  )
})

export default DenverPulseCesiumMap
