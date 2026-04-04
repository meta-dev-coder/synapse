import { useState, useEffect, useRef } from 'react'
import { api, DenverPulseAlert, RegionAlertGroup } from './api'

/**
 * Staggered alert feed — ONE card per region per minute, cycling regions 0→1→2→3→4→0→…
 * Per-region pass counter alternates between the 2 backend alert templates.
 * New cards are prepended (most recent at top).
 * Returns groups (merged), alertTick (increments each delivery), latestRegionId.
 */
export default function useRegionAlertFeed(initial: RegionAlertGroup[]): {
  groups: RegionAlertGroup[]
  alertTick: number
  latestRegionId: string | null
} {
  const [extras, setExtras] = useState<Record<string, DenverPulseAlert[]>>({})
  const [alertTick, setAlertTick] = useState(0)
  const [latestRegionId, setLatestRegionId] = useState<string | null>(null)
  const regionCycleRef = useRef(0)
  const tickRef = useRef(0)
  // Per-region pass count — used to alternate between the 2 backend alert templates
  const perRegionPassRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (initial.length === 0) return

    const regionIds = initial.map(g => g.region_id)

    const handle = setInterval(async () => {
      const regionIdx = regionCycleRef.current % regionIds.length
      const regionId = regionIds[regionIdx]
      regionCycleRef.current += 1
      tickRef.current += 1

      try {
        const fetched = await api.getRegionAlertFeed(tickRef.current)
        const match = fetched.find(g => g.region_id === regionId)
        if (!match || match.alerts.length === 0) return

        // Alternate between alert[0] and alert[1] across successive visits to this region
        const pass = perRegionPassRef.current[regionId] ?? 0
        const singleAlert = match.alerts[pass % match.alerts.length]
        perRegionPassRef.current[regionId] = pass + 1

        // Prepend so most recent appears at top
        setExtras(prev => ({
          ...prev,
          [regionId]: [singleAlert, ...(prev[regionId] ?? [])],
        }))
        setLatestRegionId(regionId)
        setAlertTick(t => t + 1)
      } catch {
        // non-critical feed — silently ignore
      }
    }, 60_000)

    return () => clearInterval(handle)
  // Re-arm only if region count changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.length])

  const groups =
    Object.keys(extras).length === 0
      ? initial
      : initial.map(g => {
          const newAlerts = extras[g.region_id]
          if (!newAlerts?.length) return g
          return { ...g, alerts: [...newAlerts, ...g.alerts] }
        })

  return { groups, alertTick, latestRegionId }
}
