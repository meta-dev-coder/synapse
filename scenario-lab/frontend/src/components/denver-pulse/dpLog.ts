/**
 * Denver Pulse debug logger.
 * Writes to browser console AND sends to backend via sendBeacon.
 * Backend writes to .logs/frontend.log so we can read it even when browser is frozen.
 *
 * sendBeacon is fire-and-forget — it queues even if the main thread is blocked.
 */

const _t0 = performance.now()
const LOG_ENDPOINT = (
  (import.meta.env.VITE_DENVER_API_BASE as string | undefined)
    ?.replace('/api/v1/denver', '/api/v1/denver-pulse') ?? 'http://localhost:8000/api/v1/denver-pulse'
) + '/log'

// Buffer log lines and flush every 200ms or when buffer hits 10 lines
let _buffer: string[] = []
let _flushTimer: ReturnType<typeof setTimeout> | null = null

function _flush() {
  if (_buffer.length === 0) return
  const lines = _buffer
  _buffer = []
  try {
    navigator.sendBeacon(
      LOG_ENDPOINT,
      new Blob([JSON.stringify({ lines })], { type: 'application/json' }),
    )
  } catch {
    // sendBeacon can fail silently if page is unloading, that's fine
  }
}

function _scheduleFlush() {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    _flush()
  }, 200)
}

export function dpLog(tag: string, ...args: unknown[]) {
  const elapsed = ((performance.now() - _t0) / 1000).toFixed(2)
  const argsStr = args.map(a => {
    if (a === null || a === undefined) return String(a)
    if (typeof a === 'object') {
      try { return JSON.stringify(a) } catch { return String(a) }
    }
    return String(a)
  }).join(' ')
  const line = `[DP:${tag}] +${elapsed}s ${argsStr}`

  // Also log to console (in case it's accessible)
  console.log(line)

  // Buffer for backend
  _buffer.push(line)
  if (_buffer.length >= 10) {
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null }
    _flush()
  } else {
    _scheduleFlush()
  }
}

// Flush on page unload
window.addEventListener('beforeunload', _flush)
