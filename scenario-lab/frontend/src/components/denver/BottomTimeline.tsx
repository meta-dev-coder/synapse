import type { DenverState, Action } from './DenverApp'
import React from 'react'

interface BottomTimelineProps {
  state: Pick<DenverState, 'gpsPlaying' | 'gpsSpeed' | 'gpsFrameIndex' | 'gpsFrames'>
  dispatch: React.Dispatch<Action>
}

export default function BottomTimeline({ state, dispatch }: BottomTimelineProps) {
  const { gpsPlaying, gpsSpeed, gpsFrameIndex, gpsFrames } = state
  const currentFrame = gpsFrames[gpsFrameIndex]
  const isLooping = gpsFrameIndex === 0 && gpsPlaying && gpsFrames.length > 0

  function formatTs(ts: string): string {
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return ts
    }
  }

  return (
    <div style={{
      height: 56,
      background: 'var(--den-panel)',
      borderTop: '1px solid var(--den-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 12,
      fontFamily: 'var(--den-font)',
    }}>
      {/* Play / Pause */}
      <button
        onClick={() => dispatch({ type: 'SET_GPS_PLAYING', value: !gpsPlaying })}
        style={{
          background: 'var(--den-primary)',
          border: 'none',
          color: '#fff',
          padding: '5px 14px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 13,
          minWidth: 76,
        }}
      >
        {gpsPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(gpsFrames.length - 1, 0)}
        value={gpsFrameIndex}
        onChange={e => dispatch({ type: 'SET_GPS_FRAME', index: Number(e.target.value) })}
        style={{ flex: 1, accentColor: 'var(--den-primary)' }}
      />

      {/* Timestamp */}
      <span style={{ fontSize: 12, color: 'var(--den-text-muted)', minWidth: 130 }}>
        {currentFrame ? formatTs(currentFrame.ts) : 'No GPS data'}
      </span>

      {/* Looping indicator */}
      {isLooping && (
        <span style={{
          fontSize: 11,
          color: 'var(--den-warning)',
          background: 'rgba(245,158,11,0.12)',
          padding: '2px 8px',
          borderRadius: 4,
        }}>
          ↺ Looping
        </span>
      )}

      {/* Speed pills */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([1, 5, 10] as const).map(speed => (
          <button
            key={speed}
            onClick={() => dispatch({ type: 'SET_GPS_SPEED', value: speed })}
            style={{
              background: gpsSpeed === speed ? 'var(--den-primary)' : 'var(--den-surface)',
              border: '1px solid var(--den-border)',
              color: gpsSpeed === speed ? '#fff' : 'var(--den-text-muted)',
              padding: '3px 9px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              transition: 'background 200ms ease, color 200ms ease',
            }}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Frame counter */}
      <span style={{ fontSize: 11, color: 'var(--den-text-muted)', minWidth: 60, textAlign: 'right' }}>
        {gpsFrames.length > 0 ? `${gpsFrameIndex + 1} / ${gpsFrames.length}` : '0 / 0'}
      </span>
    </div>
  )
}
