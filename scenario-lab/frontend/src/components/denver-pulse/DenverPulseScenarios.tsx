import React, { useState, useEffect } from 'react'
import { api, DenverPulseSavedScenario, DenverPulseCompareResponse } from './api'
import DenverPulseMethodologyModal from './DenverPulseMethodologyModal'

const COMPARE_COLORS = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ef4444']

interface ScenariosProps {
  onLoadScenario?: (scenario: DenverPulseSavedScenario) => void
}

const DenverPulseScenarios: React.FC<ScenariosProps> = ({ onLoadScenario }) => {
  const [scenarios, setScenarios] = useState<DenverPulseSavedScenario[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [compareView, setCompareView] = useState(false)
  const [compareData, setCompareData] = useState<DenverPulseCompareResponse | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    api.listScenarios().then(data => {
      setScenarios(data)
      setLoading(false)
    }).catch(() => {
      setFetchError(true)
      setLoading(false)
    })
  }, [])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCompare = async () => {
    setCompareLoading(true)
    try {
      const data = await api.compareScenarios({ scenario_ids: [...selectedIds] })
      setCompareData(data)
      setCompareView(true)
    } finally {
      setCompareLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!compareData) return
    try {
      const blob = await api.exportComparison({ scenario_ids: [...selectedIds], format: 'pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'scenario-comparison.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setDownloadError('Download failed. Please try again.')
      setTimeout(() => setDownloadError(null), 4000)
    }
  }

  const fmtValue = (v: number | undefined, unit: string) => {
    if (v == null) return '—'
    const formatted = Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v.toFixed(1)
    return `${formatted}${unit}`
  }

  const scoreColor = (score: number) => score >= 80 ? '#059669' : score >= 60 ? '#f97316' : '#ef4444'

  // ─── Sub-view 1: Scenarios Table ──────────────────────────────────
  if (!compareView) {
    return (
      <div style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', padding: 16, gap: 12, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Saved Scenarios</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
              Select 2 or more scenarios to compare them side-by-side
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedIds.size > 0 && (
              <span
                style={{
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                {selectedIds.size} selected
              </span>
            )}
            <button
              onClick={handleCompare}
              disabled={selectedIds.size < 2 || compareLoading}
              style={{
                background: selectedIds.size >= 2 ? '#111827' : '#e5e7eb',
                color: selectedIds.size >= 2 ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: selectedIds.size >= 2 ? 'pointer' : 'not-allowed',
                opacity: compareLoading ? 0.7 : 1,
              }}
            >
              {compareLoading ? 'Loading...' : 'Compare'}
            </button>
          </div>
        </div>

        {/* Table card */}
        <div
          style={{
            flex: 1,
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              Loading scenarios...
            </div>
          ) : fetchError ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 32 }}>{'\u26A0\uFE0F'}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#dc2626' }}>Failed to load scenarios</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Check that the backend is running and try again</span>
            </div>
          ) : scenarios.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 32 }}>{'\uD83D\uDCC1'}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No scenarios saved yet</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Run a simulation and save it to see it here</span>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 2, borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ width: 40, padding: '10px 8px', textAlign: 'center' }} />
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Scenario ID</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Name</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Policies Applied</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Saved By</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Saved At</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Status</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#6b7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(s => {
                    const selected = selectedIds.has(s.id)
                    return (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: selected ? '#eff6ff' : undefined,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => {
                          if (!selected) (e.currentTarget as HTMLElement).style.background = '#f8fafc'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = selected ? '#eff6ff' : ''
                        }}
                        onClick={() => toggleSelect(s.id)}
                      >
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(s.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {s.short_id}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: 500, color: '#111827' }}>{s.name}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {s.policies.map(p => (
                              <span
                                key={p}
                                style={{
                                  background: '#f3f4f6',
                                  color: '#4b5563',
                                  fontSize: 10,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', color: '#6b7280' }}>{s.saved_by}</td>
                        <td style={{ padding: '10px 8px', color: '#6b7280', fontSize: 11 }}>
                          {new Date(s.created_at).toLocaleDateString()}{' '}
                          {new Date(s.created_at).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            style={{
                              background: '#d1fae5',
                              color: '#047857',
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            Ready
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => onLoadScenario?.(s)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginRight: 8,
                            }}
                          >
                            Load
                          </button>
                          <button
                            onClick={() => window.open(api.exportScenarioUrl(s.id, 'pdf'), '_blank')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#6b7280',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Sub-view 2: Comparison View ──────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setCompareView(false)}
            style={{
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              color: '#4b5563',
              cursor: 'pointer',
            }}
          >
            {'\u2190'} Back to Scenarios
          </button>
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Scenario Comparison</span>
          {compareData && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
              {compareData.scenarios.map((sc, i) => (
                <span
                  key={sc.id}
                  style={{
                    background: `${COMPARE_COLORS[i % COMPARE_COLORS.length]}18`,
                    color: COMPARE_COLORS[i % COMPARE_COLORS.length],
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: `1px solid ${COMPARE_COLORS[i % COMPARE_COLORS.length]}44`,
                  }}
                >
                  {sc.short_id}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDownloadReport}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            Download Report
          </button>
          <button
            onClick={() => setMethodologyOpen(true)}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            View Full Details
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: '#f9fafb' }}>
        {compareData && (
          <>
            {/* 1. KPI Comparison */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>{'\uD83D\uDCCA'}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>KPI Comparison</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {compareData.kpi_rows.map(row => (
                  <div
                    key={row.label}
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      {row.label}
                    </div>
                    {compareData.scenarios.map((sc, i) => {
                      const val = row.values[sc.id]
                      const baseline = compareData.scenarios[0]
                      const baseVal = row.values[baseline.id]
                      const diff = val - baseVal
                      const isGood = row.lower_better ? diff <= 0 : diff >= 0
                      const valColor = i === 0 ? '#374151' : isGood ? '#059669' : '#ef4444'
                      return (
                        <div key={sc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: COMPARE_COLORS[i % COMPARE_COLORS.length],
                            }}
                          >
                            {sc.short_id}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: valColor }}>
                            {fmtValue(val, row.unit)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Parameter + Policy row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Parameter Comparison */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Parameter Comparison</div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280', fontWeight: 600 }}>Parameter</th>
                        {compareData.scenarios.map((sc, i) => (
                          <th
                            key={sc.id}
                            style={{
                              textAlign: 'right',
                              padding: '8px',
                              fontWeight: 600,
                              color: COMPARE_COLORS[i % COMPARE_COLORS.length],
                            }}
                          >
                            {sc.short_id}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.param_rows.map(row => (
                        <tr key={row.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px', fontWeight: 500, color: '#374151' }}>
                            {row.label} <span style={{ color: '#9ca3af', fontSize: 10 }}>{row.unit}</span>
                          </td>
                          {compareData.scenarios.map(sc => (
                            <td key={sc.id} style={{ padding: '8px', textAlign: 'right', color: '#111827', fontWeight: 500 }}>
                              {row.values[sc.id]?.toFixed?.(1) ?? row.values[sc.id]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Policy Breakdown */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Policy Breakdown</div>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '8px', color: '#6b7280', fontWeight: 600 }}>Policy</th>
                        {compareData.scenarios.map((sc, i) => (
                          <th
                            key={sc.id}
                            style={{
                              textAlign: 'center',
                              padding: '8px',
                              fontWeight: 600,
                              color: COMPARE_COLORS[i % COMPARE_COLORS.length],
                            }}
                          >
                            {sc.short_id}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.policy_rows.map(row => {
                        const vals = compareData.scenarios.map(sc => row.values[sc.id])
                        const differs = vals.some(v => v !== vals[0])
                        return (
                          <tr
                            key={row.policy_id}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              background: differs ? '#fefce8' : undefined,
                            }}
                          >
                            <td style={{ padding: '8px', fontWeight: 500, color: '#374151' }}>{row.label}</td>
                            {compareData.scenarios.map(sc => (
                              <td key={sc.id} style={{ padding: '8px', textAlign: 'center', fontSize: 14 }}>
                                {row.values[sc.id] ? (
                                  <span style={{ color: '#059669', fontWeight: 700 }}>{'\u2713'}</span>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>{'\u2014'}</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 3. Confidence Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {compareData.confidence_cards.map((card, i) => {
                const color = COMPARE_COLORS[i % COMPARE_COLORS.length]
                const sc = scoreColor(card.score)
                return (
                  <div
                    key={card.short_id}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: 16,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span
                        style={{
                          background: `${color}18`,
                          color,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          border: `1px solid ${color}44`,
                        }}
                      >
                        {card.short_id}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{card.name}</span>
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: sc, marginBottom: 8 }}>
                      {card.score}
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
                      <div
                        style={{
                          width: `${card.score}%`,
                          height: '100%',
                          background: sc,
                          borderRadius: 4,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{card.policy_count} policies applied</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Live sensor baseline</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Horizon: {card.horizon}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <DenverPulseMethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />

      {/* Download error toast */}
      {downloadError && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#dc2626', color: '#fff',
          padding: '12px 16px', borderRadius: 6,
          zIndex: 60, fontSize: 13, fontWeight: 500,
        }}>
          {downloadError}
        </div>
      )}
    </div>
  )
}

export default DenverPulseScenarios
