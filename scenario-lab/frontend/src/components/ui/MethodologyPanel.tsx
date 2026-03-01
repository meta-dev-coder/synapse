import React, { useState } from 'react'

interface Props {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

const MethodologyPanel: React.FC<Props> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      style={{
        border: '1px solid #1a3a60',
        borderRadius: 5,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          background: '#0a2744',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 11, color: '#5577aa', fontWeight: 700, lineHeight: 1 }}>
          {open ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#8899aa',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {title}
        </span>
      </button>

      {open && (
        <div
          style={{
            background: '#061525',
            padding: '10px 12px',
            fontSize: 11,
            color: '#7799bb',
            lineHeight: 1.7,
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default MethodologyPanel
