import React from 'react'

interface Props {
  children: React.ReactNode
}

const KpiGrid: React.FC<Props> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
      marginBottom: 16,
    }}
  >
    {children}
  </div>
)

export default KpiGrid
