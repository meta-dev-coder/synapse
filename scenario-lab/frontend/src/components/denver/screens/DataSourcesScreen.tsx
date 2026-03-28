import { useState, useEffect } from 'react'
import type { DenverState, Action } from '../DenverApp'

const API = 'http://localhost:8000/api/v1/denver'

interface DataSource {
  id: string
  name: string
  status: 'active' | 'missing'
  data_points: number
  coverage: string
  update_frequency?: string
  size_mb?: number | null
}

interface DataSourcesScreenProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
}

function StatusBadge({ status }: { status: 'active' | 'missing' }) {
  const isActive = status === 'active'
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 7px',
      borderRadius: 10,
      background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      color: isActive ? 'var(--den-success)' : 'var(--den-danger)',
      border: `1px solid ${isActive ? 'var(--den-success)' : 'var(--den-danger)'}`,
      letterSpacing: '0.04em',
    }}>
      {isActive ? 'Active' : 'Missing'}
    </span>
  )
}

function PipelineFlow() {
  const stages = ['Source', 'BECS', 'n8n', 'Platform']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {stages.map((stage, i) => (
        <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            padding: '5px 12px',
            background: 'var(--den-panel)',
            border: '1px solid var(--den-border)',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--den-text)',
            whiteSpace: 'nowrap',
          }}>
            {stage}
          </div>
          {i < stages.length - 1 && (
            <span style={{ color: 'var(--den-text-muted)', fontSize: 14 }}>&#8594;</span>
          )}
        </div>
      ))}
    </div>
  )
}

function DetailPanel({ source }: { source: DataSource }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Status', value: source.status === 'active' ? 'Active' : 'Missing' },
    { label: 'Coverage', value: source.coverage },
    { label: 'Data Points', value: source.data_points.toLocaleString() },
    ...(source.update_frequency ? [{ label: 'Update Frequency', value: source.update_frequency }] : []),
    ...(source.size_mb != null ? [{ label: 'Size', value: `${source.size_mb.toFixed(1)} MB` }] : []),
  ]

  return (
    <div style={{
      marginTop: 16,
      padding: 16,
      background: 'var(--den-surface)',
      border: '1px solid var(--den-border)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--den-text)' }}>
        {source.name}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {rows.map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            padding: '5px 0',
            borderBottom: '1px solid var(--den-border)',
          }}>
            <span style={{ color: 'var(--den-text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--den-text)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--den-text-muted)', fontWeight: 600, marginBottom: 6 }}>
        PIPELINE FLOW
      </div>
      <PipelineFlow />
    </div>
  )
}

export default function DataSourcesScreen({ state, dispatch }: DataSourcesScreenProps) {
  const [sources, setSources] = useState<DataSource[]>([])

  useEffect(() => {
    fetch(`${API}/data-sources`)
      .then(r => r.json())
      .then((data: DataSource[]) => setSources(data))
      .catch(err => console.warn('Failed to load data sources:', err))
  }, [])

  const selectedSource = sources.find(s => s.id === state.selectedDataSourceId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--den-text)' }}>
          Data Sources
        </div>

        {sources.length === 0 ? (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--den-text-muted)',
            fontSize: 13,
            border: '1px dashed var(--den-border)',
            borderRadius: 8,
          }}>
            Loading data sources&hellip;
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sources.map(source => {
              const isSelected = source.id === state.selectedDataSourceId
              return (
                <div
                  key={source.id}
                  onClick={() => dispatch({ type: 'SELECT_DATA_SOURCE', id: isSelected ? null : source.id })}
                  style={{
                    padding: '10px 12px',
                    background: isSelected ? 'var(--den-surface)' : 'var(--den-panel)',
                    border: `1px solid ${isSelected ? 'var(--den-primary)' : 'var(--den-border)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'border-color 200ms ease, background 200ms ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--den-text)' }}>{source.name}</div>
                    <StatusBadge status={source.status} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--den-text-muted)' }}>
                    <span>{source.data_points.toLocaleString()} pts</span>
                    <span>{source.coverage}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {selectedSource && <DetailPanel source={selectedSource} />}
      </div>

      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--den-border)',
        fontSize: 11,
        color: 'var(--den-text-muted)',
        background: 'var(--den-panel)',
        flexShrink: 0,
      }}>
        Architecture powered by Bentley Enterprise Connection Services via n8n workflows
      </div>
    </div>
  )
}
