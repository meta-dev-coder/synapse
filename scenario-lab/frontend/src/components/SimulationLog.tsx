import React, { useEffect, useRef, useState } from 'react'

const LOG_STEPS = [
  'Connecting to data source...',
  'Downloading sensor & transaction data...',
  'Preprocessing data (noise removal, normalisation, outlier filtering)...',
  'Running simulation on NB lanes (NB-L1 → NB-L4)...',
  'Running simulation on SB lanes (SB-L1 → SB-L4)...',
  'Computing aggregates, KPIs, and heatmap scalars...',
]

interface Props {
  isRunning: boolean
  simDuration: number
}

const SpinnerChar: React.FC = () => {
  const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % chars.length), 80)
    return () => clearInterval(t)
  }, [])
  return <span style={{ display: 'inline-block', width: 12 }}>{chars[i]}</span>
}

const SimulationLog: React.FC<Props> = ({ isRunning, simDuration }) => {
  const [visibleSteps, setVisibleSteps] = useState(0)
  const [isDone, setIsDone] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasRunningRef = useRef(false)

  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true
      setVisibleSteps(1)
      setIsDone(false)
      const stepMs = (simDuration / LOG_STEPS.length) * 1000
      intervalRef.current = setInterval(() => {
        setVisibleSteps((prev) => Math.min(prev + 1, LOG_STEPS.length))
      }, stepMs)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (wasRunningRef.current) {
        setVisibleSteps(LOG_STEPS.length)
        setIsDone(true)
        wasRunningRef.current = false
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning])

  if (visibleSteps === 0 && !isDone) return null

  return (
    <div
      style={{
        background: '#060d14',
        border: '1px solid #1a3a60',
        borderRadius: 5,
        padding: '10px 14px',
        marginBottom: 12,
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.9,
      }}
    >
      {LOG_STEPS.map((step, i) => {
        const isCompleted = isDone || i < visibleSteps - 1
        const isCurrent = !isDone && i === visibleSteps - 1
        const isPending = !isDone && i >= visibleSteps

        if (isPending) return null

        return (
          <div
            key={i}
            style={{
              color: isCompleted ? '#27ae60' : isCurrent ? '#f39c12' : '#3a5570',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isCurrent ? <SpinnerChar /> : <span style={{ display: 'inline-block', width: 12 }}>✓</span>}
            {step}
          </div>
        )
      })}

      {isDone && (
        <div
          style={{
            color: '#27ae60',
            fontWeight: 700,
            borderTop: '1px solid #1a3a60',
            marginTop: 6,
            paddingTop: 6,
          }}
        >
          <span style={{ display: 'inline-block', width: 12 }}>✓</span>{' '}
          Simulation complete
        </div>
      )}
    </div>
  )
}

export default SimulationLog
