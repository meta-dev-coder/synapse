import React from 'react'
import SliderInput from '../ui/SliderInput'

interface Props {
  simDuration: number
  onSimDurationChange: (v: number) => void
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#e94560',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 10,
}

const SettingsScenario: React.FC<Props> = ({ simDuration, onSimDurationChange }) => {
  return (
    <div>
      <div
        style={{
          background: '#0a2744',
          border: '1px solid #1a3a60',
          borderRadius: 5,
          padding: '8px 12px',
          marginBottom: 18,
          fontSize: 11,
          color: '#7799bb',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: '#ccd8e8' }}>Global Simulation Settings</strong>
        <br />
        These settings apply to all scenario runs. The simulation duration controls
        how long each backend simulation takes — useful for setting demo pacing.
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Simulation Timing</div>
        <SliderInput
          label="Simulation Duration"
          min={10}
          max={60}
          step={5}
          value={simDuration}
          onChange={onSimDurationChange}
          formatValue={(v) => `${v}s`}
        />
        <div
          style={{
            fontSize: 11,
            color: '#556677',
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          Controls how long each "Run Simulation" call takes end-to-end.
          The log panel shows 6 steps evenly distributed across this duration.
          <br />
          Recommended: <strong style={{ color: '#7799bb' }}>30s</strong> for demos,
          <strong style={{ color: '#7799bb' }}> 10s</strong> for development.
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionLabelStyle}>Architecture</div>
        <div
          style={{
            background: '#060d14',
            border: '1px solid #1a3a60',
            borderRadius: 5,
            padding: '10px 14px',
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#7799bb',
            lineHeight: 1.8,
          }}
        >
          <div style={{ color: '#ccd8e8', marginBottom: 6, fontWeight: 700 }}>Data Flow</div>
          <div>Frontend (React)</div>
          <div style={{ color: '#556677' }}>  ↓ POST /webhook/simulate-&#123;scenario&#125;</div>
          <div style={{ color: '#e94560' }}>N8N Workflow (sdna.app.n8n.cloud)</div>
          <div style={{ color: '#556677' }}>  ↓ POST /api/v1/simulate/&#123;scenario&#125;</div>
          <div>Python FastAPI (EC2 · 54.89.6.51:8999)</div>
          <div style={{ color: '#556677', marginTop: 8, fontSize: 10 }}>
            Configurable: change the HTTP Request node URL in N8N to point
            at any simulation engine without modifying the frontend.
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsScenario
