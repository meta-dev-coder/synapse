import { useRef, useEffect, useState, useCallback } from 'react'
import type { TrafficSimVehicle } from './api'

import { dpLog } from './dpLog'

interface VehicleState {
  id: string
  mode: string
  path: number[][]  // [[lon,lat], ...]
  speed: number
  edgeIndex: number
  progress: number  // 0-1 within current edge
}

export interface VehiclePosition {
  lon: number
  lat: number
  mode: string
}

interface UseTrafficSimLoopResult {
  positions: VehiclePosition[]
  mergeVehicles: (newVehicles: TrafficSimVehicle[]) => void
}

const REPATH_THRESHOLD = 30

export default function useTrafficSimLoop(
  vehicles: TrafficSimVehicle[] | null,
  playing: boolean,
  speedMultiplier: number,
  onNeedRepath: (count: number) => void,
): UseTrafficSimLoopResult {
  const statesRef = useRef<VehicleState[]>([])
  const rafRef = useRef<number>(0)
  const exhaustedRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const lastEmitRef = useRef<number>(0)
  const [positions, setPositions] = useState<VehiclePosition[]>([])
  const onNeedRepathRef = useRef(onNeedRepath)
  onNeedRepathRef.current = onNeedRepath

  // Throttle: only push positions to React every 200ms (5fps) instead of every rAF (60fps)
  const EMIT_INTERVAL_MS = 500

  // Convert incoming vehicles to VehicleState[]
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) {
      dpLog('LOOP:vehicles', 'cleared (no vehicles)')
      statesRef.current = []
      exhaustedRef.current = 0
      setPositions([])
      return
    }
    dpLog('LOOP:vehicles', `loaded ${vehicles.length} vehicles, avgPathLen=${Math.round(vehicles.reduce((s, v) => s + v.path.length, 0) / vehicles.length)}`)
    statesRef.current = vehicles.map(v => ({
      id: v.id,
      mode: v.mode,
      path: v.path,
      speed: v.speed,
      edgeIndex: 0,
      progress: Math.random(),
    }))
  }, [vehicles])

  // Merge new vehicles from repath into running state
  const mergeVehicles = useCallback((newVehicles: TrafficSimVehicle[]) => {
    const newStates = newVehicles.map(v => ({
      id: v.id,
      mode: v.mode,
      path: v.path,
      speed: v.speed,
      edgeIndex: 0,
      progress: Math.random(),
    }))
    statesRef.current = [...statesRef.current, ...newStates]
    exhaustedRef.current = Math.max(0, exhaustedRef.current - newVehicles.length)
  }, [])

  // Animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return
    }

    lastTimeRef.current = 0
    let tickCount = 0
    let emitCount = 0

    const tick = (timestamp: number) => {
      tickCount++
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const dt = (timestamp - lastTimeRef.current) / 1000 // seconds
      lastTimeRef.current = timestamp

      const states = statesRef.current
      let exhaustedThisFrame = 0
      const nextPositions: VehiclePosition[] = []

      for (let i = states.length - 1; i >= 0; i--) {
        const s = states[i]
        if (s.edgeIndex >= s.path.length - 1) {
          // Already exhausted, remove
          states.splice(i, 1)
          exhaustedThisFrame++
          continue
        }

        // Advance progress: speed is in arbitrary units, scale by dt and multiplier
        // Speed values from backend are ~0.002-0.004; multiply by 150 so vehicles
        // traverse an edge in ~1-2 seconds at 1x speed
        s.progress += s.speed * dt * speedMultiplier * 150

        // Move to next edge(s) if needed
        while (s.progress >= 1 && s.edgeIndex < s.path.length - 1) {
          s.progress -= 1
          s.edgeIndex++
        }

        if (s.edgeIndex >= s.path.length - 1) {
          states.splice(i, 1)
          exhaustedThisFrame++
          continue
        }

        // Interpolate position
        const p1 = s.path[s.edgeIndex]
        const p2 = s.path[s.edgeIndex + 1]
        const lon = p1[0] + (p2[0] - p1[0]) * s.progress
        const lat = p1[1] + (p2[1] - p1[1]) * s.progress
        nextPositions.push({ lon, lat, mode: s.mode })
      }

      if (exhaustedThisFrame > 0) {
        exhaustedRef.current += exhaustedThisFrame
      }

      // Batch repath request
      if (exhaustedRef.current >= REPATH_THRESHOLD) {
        const count = exhaustedRef.current
        exhaustedRef.current = 0
        dpLog('LOOP:repath', `threshold hit: ${count} exhausted, requesting repath`)
        onNeedRepathRef.current(count)
      }

      // Throttle React state updates to avoid excessive re-renders and GC pressure
      if (timestamp - lastEmitRef.current >= EMIT_INTERVAL_MS) {
        lastEmitRef.current = timestamp
        emitCount++
        if (emitCount <= 5 || emitCount % 20 === 0) {
          dpLog('LOOP:emit', `#${emitCount} positions=${nextPositions.length} active=${states.length} exhaustedPending=${exhaustedRef.current} ticks=${tickCount}`)
        }
        setPositions(nextPositions)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speedMultiplier])

  return { positions, mergeVehicles }
}

export { type VehicleState }
export { useTrafficSimLoop }
