import React, { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMzU1YzQzMC0xYzYxLTQwZTAtYTNiMi0wZGM4MmQ0OGNhZWEiLCJpZCI6MzQ3OTY1LCJpYXQiOjE3NTk4MjI5NjN9.SyVlQADR9sojgRpFNUPjRFZajsCWXRWRwEUyJ9_pU1s'

const CesiumViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false, geocoder: false, homeButton: false,
      sceneModePicker: false, navigationHelpButton: false,
      animation: false, timeline: false, fullscreenButton: false,
      infoBox: false, selectionIndicator: false,
    })
    viewerRef.current = viewer

    Cesium.CesiumTerrainProvider.fromIonAssetId(1).then((terrain) => {
      if (!viewer || viewer.isDestroyed()) return
      viewer.terrainProvider = terrain
      viewer.scene.globe.depthTestAgainstTerrain = true
    }).catch(console.error)

    Cesium.Cesium3DTileset.fromIonAssetId(4059590).then(async (tileset) => {
      if (!viewer || viewer.isDestroyed()) return
      viewer.scene.primitives.add(tileset)
      const extras = tileset.asset.extras
      if (Cesium.defined(extras) &&
          Cesium.defined((extras as Record<string, unknown>).ion) &&
          Cesium.defined(((extras as Record<string, unknown>).ion as Record<string, unknown>).defaultStyle)) {
        tileset.style = new Cesium.Cesium3DTileStyle(
          ((extras as Record<string, unknown>).ion as Record<string, unknown>).defaultStyle as Record<string, unknown>
        )
      }
      await viewer.zoomTo(tileset)
    }).catch(console.error)

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
}

export default CesiumViewer
