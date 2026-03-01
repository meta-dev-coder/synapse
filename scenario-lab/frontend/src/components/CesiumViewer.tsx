import React, { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import type { RampType, ViewMode } from '../App'
import laneGeometry from '../data/laneGeometry.json'

// Ion access token — required for 3D Tileset and Cesium World Terrain
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzU1YzQzMC0xYzYxLTQwZTAtYTNiMi0wZGM4MmQ0OGNhZWEiLCJpZCI6MzQ3OTY1LCJpYXQiOjE3NTk4MjI5NjN9.SyVlQADR9sojgRpFNUPjRFZajsCWXRWRwEUyJ9_pU1s'

// ─── Color ramp utility ───────────────────────────────────────────────────────

interface ColorStop {
  t: number
  r: number
  g: number
  b: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateStops(stops: ColorStop[], value: number): Cesium.Color {
  const clamped = Math.max(0, Math.min(1, value))
  if (stops.length === 0) return Cesium.Color.WHITE

  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i]
    const s1 = stops[i + 1]
    if (clamped >= s0.t && clamped <= s1.t) {
      const localT = (clamped - s0.t) / (s1.t - s0.t)
      return new Cesium.Color(
        lerp(s0.r, s1.r, localT) / 255,
        lerp(s0.g, s1.g, localT) / 255,
        lerp(s0.b, s1.b, localT) / 255,
        1.0
      )
    }
  }
  const last = stops[stops.length - 1]
  return new Cesium.Color(last.r / 255, last.g / 255, last.b / 255, 1.0)
}

export function scalarToColor(value: number, ramp: string): Cesium.Color {
  switch (ramp) {
    case 'traffic': {
      const stops: ColorStop[] = [
        { t: 0.00, r: 74,  g: 144, b: 226 },
        { t: 0.50, r: 80,  g: 200, b: 80  },
        { t: 0.75, r: 255, g: 165, b: 0   },
        { t: 1.00, r: 220, g: 50,  b: 50  },
      ]
      return interpolateStops(stops, value)
    }
    case 'emission': {
      const stops: ColorStop[] = [
        { t: 0.00, r: 144, g: 238, b: 144 },
        { t: 0.33, r: 255, g: 255, b: 0   },
        { t: 0.66, r: 255, g: 140, b: 0   },
        { t: 1.00, r: 139, g: 0,   b: 0   },
      ]
      return interpolateStops(stops, value)
    }
    case 'risk':
    case 'congestion': {
      const stops: ColorStop[] = [
        { t: 0.00, r: 80,  g: 200, b: 80  },
        { t: 0.50, r: 255, g: 230, b: 50  },
        { t: 1.00, r: 220, g: 50,  b: 50  },
      ]
      return interpolateStops(stops, value)
    }
    default:
      return Cesium.Color.WHITE
  }
}

// ─── Lane default colors ──────────────────────────────────────────────────────

function laneTypeColor(laneType: string): Cesium.Color {
  switch (laneType) {
    case 'HOV_EXPRESS': return Cesium.Color.fromCssColorString('#4A90E2')
    case 'ETC':         return Cesium.Color.fromCssColorString('#7ED321')
    case 'CASH':        return Cesium.Color.fromCssColorString('#E85D4A')
    default:            return Cesium.Color.fromCssColorString('#888888')
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoFeature {
  type: string
  id: string
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: number[][] | number[][][]
  }
}

interface GeoCollection {
  type: string
  features: GeoFeature[]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  heatmap: Record<string, number>
  rampType: RampType
  viewMode: ViewMode
}

const CesiumViewer: React.FC<Props> = ({ heatmap, rampType, viewMode }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const laneEntitiesRef = useRef<Record<string, Cesium.Entity>>({})
  const allPolylineEntitiesRef = useRef<Cesium.Entity[]>([])
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)

  // ── Initialize Viewer once ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    })

    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
    )

    viewerRef.current = viewer

    // ── Load lane geometry ──────────────────────────────────────────────────
    const geo = laneGeometry as GeoCollection
    const laneEntities: Record<string, Cesium.Entity> = {}
    const allPolylines: Cesium.Entity[] = []

    for (const feature of geo.features) {
      const props = feature.properties
      const geomType = feature.geometry.type

      if (geomType === 'LineString') {
        const coords = feature.geometry.coordinates as number[][]
        const positions = coords.map(([lng, lat, alt]) =>
          Cesium.Cartesian3.fromDegrees(lng, lat, alt ?? 12)
        )
        const laneId = (props.lane_id as string) ?? feature.id
        const laneType = (props.lane_type as string) ?? 'DEFAULT'
        const isDiversion = (props.type as string) === 'diversion_route'
        const width = isDiversion ? 2 : 4

        const entity = viewer.entities.add({
          id: feature.id,
          name: (props.lane_label as string) ?? (props.name as string) ?? feature.id,
          polyline: {
            positions,
            width,
            material: new Cesium.ColorMaterialProperty(laneTypeColor(laneType)),
            clampToGround: false,
          },
        })

        allPolylines.push(entity)
        if (props.lane_id) laneEntities[laneId] = entity
      }
    }

    laneEntitiesRef.current = laneEntities
    allPolylineEntitiesRef.current = allPolylines

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(4.895, 52.375, 600),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration: 2,
    })

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  // ── Switch between lane-lines and Ion 3D Tileset ──────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const showLines = viewMode === 'lines'

    // Toggle polyline entity visibility
    for (const entity of allPolylineEntitiesRef.current) {
      entity.show = showLines
    }

    if (viewMode === 'model') {
      // Remove previous tileset if any
      if (tilesetRef.current) {
        viewer.scene.primitives.remove(tilesetRef.current)
        tilesetRef.current = null
      }

      // Switch to Cesium World Terrain
      Cesium.CesiumTerrainProvider.fromIonAssetId(1).then((terrainProvider) => {
        if (!viewer || viewer.isDestroyed()) return
        viewer.terrainProvider = terrainProvider
        viewer.scene.globe.depthTestAgainstTerrain = true
      }).catch(console.error)

      // Load Ion 3D Tileset
      Cesium.Cesium3DTileset.fromIonAssetId(4059590).then(async (tileset) => {
        if (!viewer || viewer.isDestroyed()) return
        viewer.scene.primitives.add(tileset)
        tilesetRef.current = tileset

        // Apply Ion default style if defined
        const extras = tileset.asset.extras
        if (
          Cesium.defined(extras) &&
          Cesium.defined((extras as Record<string, unknown>).ion) &&
          Cesium.defined(((extras as Record<string, unknown>).ion as Record<string, unknown>).defaultStyle)
        ) {
          tileset.style = new Cesium.Cesium3DTileStyle(
            ((extras as Record<string, unknown>).ion as Record<string, unknown>).defaultStyle as Record<string, unknown>
          )
        }

        await viewer.zoomTo(tileset)
      }).catch(console.error)

    } else {
      // Remove tileset when switching back to lines
      if (tilesetRef.current) {
        viewer.scene.primitives.remove(tilesetRef.current)
        tilesetRef.current = null
      }

      // Restore flat ellipsoid terrain and imagery
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
      viewer.scene.globe.depthTestAgainstTerrain = false

      // Fly back to corridor overview
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(4.895, 52.375, 600),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
        duration: 2,
      })
    }
  }, [viewMode])

  // ── Update lane colors when heatmap changes ───────────────────────────────
  useEffect(() => {
    const laneEntities = laneEntitiesRef.current
    const geo = laneGeometry as GeoCollection

    for (const feature of geo.features) {
      if (feature.geometry.type !== 'LineString') continue
      const laneId = (feature.properties.lane_id as string) ?? null
      if (!laneId) continue

      const entity = laneEntities[laneId]
      if (!entity || !entity.polyline) continue

      const heatValue = heatmap[laneId]
      let color: Cesium.Color

      if (heatValue !== undefined && rampType) {
        color = scalarToColor(heatValue, rampType)
      } else {
        const laneType = (feature.properties.lane_type as string) ?? 'DEFAULT'
        color = laneTypeColor(laneType)
      }

      entity.polyline.material = new Cesium.ColorMaterialProperty(color)
    }
  }, [heatmap, rampType])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
    />
  )
}

export default CesiumViewer
