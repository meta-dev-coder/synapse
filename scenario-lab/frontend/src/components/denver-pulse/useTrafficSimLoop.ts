import { useRef, useEffect, useState, useCallback } from 'react'
import type { TrafficSimVehicle } from './api'

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

const REPATH_THRESHOLD = 5

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
  const [positions, setPositions] = useState<VehiclePosition[]>([])
  const onNeedRepathRef = useRef(onNeedRepath)
  onNeedRepathRef.current = onNeedRepath

  // Convert incoming vehicles to VehicleState[]
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) {
      statesRef.current = []
      exhaustedRef.current = 0
      setPositions([])
      return
    }
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

    const tick = (timestamp: number) => {
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
        s.progress += s.speed * dt * speedMultiplier * 0.3

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
        onNeedRepathRef.current(count)
      }

      setPositions(nextPositions)
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
