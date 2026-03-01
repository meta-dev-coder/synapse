import React from 'react'

export interface ColDef {
  key: string
  label: string
  format?: (v: unknown, row: Record<string, unknown>) => string
  align?: 'left' | 'right'
  redWhenTrue?: string
}

interface Props {
  columns: ColDef[]
  rows: Record<string, unknown>[]
}

const PerLaneTable: React.FC<Props> = ({ columns, rows }) => {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          background: '#06192e',
        }}
      >
        <thead>
          <tr style={{ background: '#5577aa' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '5px 8px',
                  color: '#e0e0e0',
                  fontWeight: 700,
                  textAlign: col.align ?? 'right',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid #1a3a60',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const isClosed = row['is_closed'] === true
            return (
              <tr
                key={rowIdx}
                style={{
                  background: isClosed ? 'rgba(200,50,50,0.08)' : 'transparent',
                  borderBottom: '1px solid #1a3a60',
                }}
              >
                {columns.map((col) => {
                  const val = row[col.key]
                  const isRed = col.redWhenTrue ? Boolean(row[col.redWhenTrue]) : false
                  const displayVal = col.format ? col.format(val, row) : String(val ?? '—')
                  return (
                    <td
                      key={col.key}
                      style={{
                        padding: '5px 8px',
                        textAlign: col.align ?? 'right',
                        color: isRed ? '#e74c3c' : '#ccd8e8',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {displayVal}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default PerLaneTable
