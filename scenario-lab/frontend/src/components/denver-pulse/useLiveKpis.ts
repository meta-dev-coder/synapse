import { useState, useEffect } from 'react'
import { DenverPulseKPIs } from './api'

// Returns a multiplier of (1 ± range), e.g. range=0.005 → ±0.5%
function jitter(range: number): number {
  return 1 + (Math.random() * 2 - 1) * range
}

const FIELDS = ['ghg_tco2e', 'congestion_pct', 'avg_speed_kmh', 'mode_share'] as const
type FlashField = typeof FIELDS[number] | null

/**
 * Applies a small live random walk to each KPI, cycling one field per tick.
 * initial KPIs are locked at first render — no dependency on prop changes.
 */
export default function useLiveKpis(initial: DenverPulseKPIs, intervalMs = 2000) {
  const [kpis, setKpis] = useState<DenverPulseKPIs>(initial)
  const [flashField, setFlashField] = useState<FlashField>(null)

  useEffect(() => {
    let i = 0

    const id = setInterval(() => {
      const field = FIELDS[i % FIELDS.length]
      i++

      // Flash the card briefly
      setFlashField(field)
      const clearFlash = setTimeout(() => setFlashField(null), 600)

      setKpis(prev => {
        switch (field) {
          case 'ghg_tco2e':
            return { ...prev, ghg_tco2e: Math.round(prev.ghg_tco2e * jitter(0.005)) }

          case 'congestion_pct':
            return {
              ...prev,
              congestion_pct: parseFloat(
                Math.max(10, Math.min(85, prev.congestion_pct * jitter(0.01))).toFixed(1)
              ),
            }

          case 'avg_speed_kmh':
            return {
              ...prev,
              avg_speed_kmh: parseFloat(
                Math.max(10, Math.min(80, prev.avg_speed_kmh * jitter(0.008))).toFixed(1)
              ),
            }

          case 'mode_share': {
            // Shift car ±0.3 pp, redistribute remainder proportionally so sum stays 100%
            const carDelta = (Math.random() * 2 - 1) * 0.3
            const car = parseFloat(
              Math.max(20, Math.min(90, prev.mode_share.car + carDelta)).toFixed(2)
            )
            const oldRem = 100 - prev.mode_share.car
            const newRem = 100 - car
            const scale = oldRem > 0 ? newRem / oldRem : 1
            return {
              ...prev,
              mode_share: {
                car,
                pt:   parseFloat(Math.max(0, prev.mode_share.pt   * scale).toFixed(2)),
                bike: parseFloat(Math.max(0, prev.mode_share.bike * scale).toFixed(2)),
                walk: parseFloat(Math.max(0, prev.mode_share.walk * scale).toFixed(2)),
              },
            }
          }

          default:
            return prev
        }
      })

      return () => clearTimeout(clearFlash)
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs]) // intentionally excludes `initial` — locks to first fetch value

  return { kpis, flashField }
}
