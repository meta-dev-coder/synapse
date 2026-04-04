import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * Auto-cycling index hook for the region alert panel.
 * Advances through `count` items every `intervalMs` ms using rAF for smooth progress.
 * Manual goTo() pauses auto-cycle for 15 s then resumes.
 * pause()/resume() freeze/unfreeze for hover interactions.
 */
export default function useAutoCycle(count: number, intervalMs = 8000) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)  // 0–1 fraction of interval elapsed
  const [paused, setPaused] = useState(false)

  const startRef = useRef<number>(Date.now())
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const indexRef = useRef(0)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const advance = useCallback(() => {
    indexRef.current = (indexRef.current + 1) % Math.max(count, 1)
    setIndex(indexRef.current)
    startRef.current = Date.now()
    setProgress(0)
  }, [count])

  useEffect(() => {
    function tick() {
      if (!pausedRef.current) {
        const elapsed = Date.now() - startRef.current
        const p = Math.min(elapsed / intervalMs, 1)
        setProgress(p)
        if (p >= 1) advance()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [advance, intervalMs])

  const goTo = useCallback((i: number) => {
    indexRef.current = i
    setIndex(i)
    startRef.current = Date.now()
    setProgress(0)
    // Pause for 15 s after manual navigation, then resume
    pausedRef.current = true
    setPaused(true)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false
      setPaused(false)
      resumeTimerRef.current = null
    }, 15000)
  }, [])

  const jumpTo = useCallback((i: number, resumeAfterMs = 4000) => {
    indexRef.current = i
    setIndex(i)
    startRef.current = Date.now()
    setProgress(0)
    pausedRef.current = true
    setPaused(true)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false
      setPaused(false)
      resumeTimerRef.current = null
    }, resumeAfterMs)
  }, [])

  const pause = useCallback(() => {
    pausedRef.current = true
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    // Only resume if not in a manual-pause window
    if (resumeTimerRef.current) return
    pausedRef.current = false
    setPaused(false)
  }, [])

  return { index, progress, paused, goTo, jumpTo, pause, resume }
}
