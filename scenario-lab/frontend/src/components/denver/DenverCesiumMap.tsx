import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import * as Cesium from 'cesium'
import type { DenverState } from './DenverApp'

const ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzU1YzQzMC0xYzYxLTQwZTAtYTNiMi0wZGM4MmQ0OGNhZWEiLCJpZCI6MzQ3OTY1LCJpYXQiOjE3NTk4MjI5NjN9.SyVlQADR9sojgRpFNUPjRFZajsCWXRWRwEUyJ9_pU1s'

// SVG data URIs — Cesium billboard.image must be a URL/canvas/data-URI, not an emoji string
const BUS_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' +
  '<circle cx="11" cy="11" r="9" fill="#0078d4" stroke="#fff" stroke-width="1.5"/>' +
  '<text x="11" y="15" font-size="11" font-family="sans-serif" text-anchor="middle" fill="#fff" font-weight="bold">B</text>' +
  '</svg>'
)}`

const BUS_ICON_YELLOW = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' +
  '<circle cx="11" cy="11" r="9" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>' +
  '<text x="11" y="15" font-size="11" font-family="sans-serif" text-anchor="middle" fill="#fff" font-weight="bold">B</text>' +
  '</svg>'
)}`

// Denver city corridors — approximate WGS84 polyline coordinates
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

function corridorColor(value: number): Cesium.Color {
  if (value < 0.4) return Cesium.Color.fromCssColorString('#22c55e').withAlpha(0.8)
  if (value < 0.7) return Cesium.Color.fromCssColorString('#f59e0b').withAlpha(0.8)
  return Cesium.Color.fromCssColorString('#ef4444').withAlpha(0.8)
}

interface DenverCesiumMapProps {
  layers: DenverState['mapLayers']
  opacity: number
  intensity: DenverState['mapIntensity']
  gpsFrame: { buses: { id: string; lat: number; lon: number; bearing: number }[] } | null
  scenarioOverlay: Record<string, number> | null
  compareView: DenverState['compareView']
  compareACorridors: Record<string, number> | null
  compareBCorridors: Record<string, number> | null
  highlightDataSource: string | null
  onViewerReady?: (viewer: Cesium.Viewer) => void
}

export interface DenverCesiumMapHandle {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
}

interface BusTooltip {
  busId: string
  x: number
  y: number
}

const DenverCesiumMap = forwardRef<DenverCesiumMapHandle, DenverCesiumMapProps>(function DenverCesiumMap({
  layers,
  opacity,
  intensity,
  gpsFrame,
  scenarioOverlay,
  compareView,
  compareACorridors,
  compareBCorridors,
  highlightDataSource,
  onViewerReady,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const busEntityMap = useRef<Map<string, Cesium.Entity>>(new Map())
  const corridorPrimitivesRef = useRef<Map<string, Cesium.Entity>>(new Map())
  const pulseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Pre-allocated pulse color — mutate alpha only, never recreate in the hot loop (Bug 3 fix)
  const pulseColorRef = useRef<Cesium.Color>(Cesium.Color.fromCssColorString('#0078d4').clone())
  const pulseMaterialRef = useRef<Cesium.ColorMaterialProperty>(
    new Cesium.ColorMaterialProperty(pulseColorRef.current)
  )
  const [busTooltip, setBusTooltip] = useState<BusTooltip | null>(null)

  void opacity
  void intensity

  // Expose zoom/reset controls to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const viewer = viewerRef.current
      if (!viewer) return
      const camera = viewer.camera
      camera.zoomIn(camera.positionCartographic.height * 0.4)
    },
    zoomOut: () => {
      const viewer = viewerRef.current
      if (!viewer) return
      const camera = viewer.camera
      camera.zoomOut(camera.positionCartographic.height * 0.6)
    },
    resetView: () => {
      const viewer = viewerRef.current
      if (!viewer) return
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-104.9903, 39.7392, 25000),
        duration: 1.2,
      })
    },
  }), [])

  // Initialize Cesium viewer once
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    Cesium.Ion.defaultAccessToken = ION_TOKEN

    // Bug 1 fix: omit terrainProvider (avoid deprecated EllipsoidTerrainProvider pattern)
    // Bug 2 fix: pass OSM as baseLayer in constructor using the 1.107+ async factory API
    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Promise.resolve(new Cesium.UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: '© OpenStreetMap contributors',
          // OSM tiles are 256×256 — tell Cesium explicitly so it requests
          // the correct zoom levels and doesn't under-sample at high zoom
          tileWidth: 256,
          tileHeight: 256,
          minimumLevel: 0,
          maximumLevel: 19,
        }))
      ),
      baseLayerPicker: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      geocoder: false,
      homeButton: false,
      fullscreenButton: false,
      animation: false,
      timeline: false,
      infoBox: false,
      selectionIndicator: false,
    })

    // Center on Denver
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-104.9903, 39.7392, 25000),
      duration: 0,
    })

    // Draw initial corridors
    Object.entries(CORRIDORS).forEach(([name, positions]) => {
      const entity = viewer.entities.add({
        id: `corridor-${name}`,
        polyline: {
          positions,
          width: 3,
          material: new Cesium.ColorMaterialProperty(corridorColor(0.7)),
          clampToGround: true,
        },
      })
      corridorPrimitivesRef.current.set(name, entity)
    })

    // Bus click tooltip
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    clickHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = viewer.scene.pick(event.position)
      if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
        const entityId: string = picked.id.id as string
        if (entityId.startsWith('bus-')) {
          setBusTooltip({ busId: entityId.replace('bus-', ''), x: event.position.x, y: event.position.y })
          return
        }
      }
      setBusTooltip(null)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    viewerRef.current = viewer
    onViewerReady?.(viewer)

    return () => {
      clickHandler.destroy()
      viewer.destroy()
      viewerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update bus entities when GPS frame changes
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !gpsFrame || !layers.bus) return

    const busIcon = highlightDataSource === 'bus_gps' ? BUS_ICON_YELLOW : BUS_ICON
    const seen = new Set<string>()

    gpsFrame.buses.forEach(bus => {
      seen.add(bus.id)
      const pos = Cesium.Cartesian3.fromDegrees(bus.lon, bus.lat, 0)
      const existing = busEntityMap.current.get(bus.id)
      if (existing) {
        existing.position = new Cesium.ConstantPositionProperty(pos)
        if (existing.billboard) {
          existing.billboard.image = new Cesium.ConstantProperty(busIcon)
        }
      } else {
        const entity = viewer.entities.add({
          id: `bus-${bus.id}`,
          position: pos,
          billboard: {
            image: busIcon,
            width: 22,
            height: 22,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
          },
        })
        busEntityMap.current.set(bus.id, entity)
      }
    })

    // Remove stale bus entities not in this frame
    busEntityMap.current.forEach((entity, id) => {
      if (!seen.has(id)) {
        viewer.entities.remove(entity)
        busEntityMap.current.delete(id)
      }
    })
  }, [gpsFrame, layers.bus, highlightDataSource])

  // Toggle bus visibility
  useEffect(() => {
    busEntityMap.current.forEach(entity => {
      entity.show = layers.bus
    })
  }, [layers.bus])

  // Update corridor colors based on active overlay / compare view
  useEffect(() => {
    if (!viewerRef.current) return

    Object.entries(CORRIDORS).forEach(([name]) => {
      const entity = corridorPrimitivesRef.current.get(name)
      if (!entity?.polyline) return

      let value = 0.7
      if (scenarioOverlay?.[name] !== undefined) {
        value = scenarioOverlay[name]
      } else if (compareView === 'A' && compareACorridors?.[name] !== undefined) {
        value = compareACorridors[name]
      } else if (compareView === 'B' && compareBCorridors?.[name] !== undefined) {
        value = compareBCorridors[name]
      } else if (compareView === 'diff' && compareACorridors && compareBCorridors) {
        const diff = (compareBCorridors[name] ?? 0.7) - (compareACorridors[name] ?? 0.7)
        value = diff < -0.05 ? 0.1 : diff > 0.05 ? 0.9 : 0.5
      }

      entity.polyline.material = new Cesium.ColorMaterialProperty(corridorColor(value))

      if (highlightDataSource === 'road_network') {
        // Assign the shared pulse material — alpha is driven by the pulse interval
        entity.polyline.material = pulseMaterialRef.current
      }
    })
  }, [scenarioOverlay, compareView, compareACorridors, compareBCorridors, highlightDataSource])

  // Road network pulse animation — Bug 3 fix: mutate pre-allocated Color, never new() in the loop
  useEffect(() => {
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current)
      pulseIntervalRef.current = null
    }
    if (highlightDataSource !== 'road_network') return

    let pulseOpacity = 0.5
    let dir = 1
    pulseIntervalRef.current = setInterval(() => {
      pulseOpacity += dir * 0.05
      if (pulseOpacity >= 1.0) dir = -1
      if (pulseOpacity <= 0.5) dir = 1
      // Mutate the pre-allocated color — no GC pressure
      pulseColorRef.current.alpha = pulseOpacity
    }, 50)

    return () => {
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current)
    }
  }, [highlightDataSource])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {busTooltip && (
        <div style={{
          position: 'absolute',
          left: busTooltip.x + 12,
          top: busTooltip.y - 8,
          background: 'var(--den-panel)',
          border: '1px solid var(--den-border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--den-text)',
          pointerEvents: 'none',
          zIndex: 100,
          minWidth: 140,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Bus {busTooltip.busId}</div>
          <div style={{ color: 'var(--den-text-muted)' }}>
            Route: RTD-{(parseInt(busTooltip.busId) % 50) + 1}
          </div>
          <div style={{ color: 'var(--den-warning)' }}>
            Delay: {(parseInt(busTooltip.busId) % 5) + 1} min
          </div>
        </div>
      )}
    </div>
  )
})

export default DenverCesiumMap
