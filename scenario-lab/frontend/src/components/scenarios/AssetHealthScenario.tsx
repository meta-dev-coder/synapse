import React, { useState } from 'react'
import type { SimulationResult } from '../../App'
import { ASSETS, computeHealthScore, type Asset, type HealthResult } from '../../data/assetInventory'
import MethodologyPanel from '../ui/MethodologyPanel'

interface Props {
  onResult: (result: SimulationResult) => void
}

const TODAY = new Date()

interface AssetWithHealth extends Asset {
  health: HealthResult
}

const ASSETS_WITH_HEALTH: AssetWithHealth[] = ASSETS.map((a) => ({
  ...a,
  health: computeHealthScore(a, TODAY),
}))

function riskColor(risk: 'Green' | 'Amber' | 'Red'): string {
  return risk === 'Green' ? '#27ae60' : risk === 'Amber' ? '#f39c12' : '#e74c3c'
}

function riskEmoji(risk: 'Green' | 'Amber' | 'Red'): string {
  return risk === 'Green' ? '🟢' : risk === 'Amber' ? '🟡' : '🔴'
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#e94560',
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 10,
}

const dataSourceStyle: React.CSSProperties = {
  background: '#0a2744',
  border: '1px solid #1a3a60',
  borderRadius: 5,
  padding: '8px 12px',
  marginBottom: 14,
  fontSize: 11,
  color: '#7799bb',
  lineHeight: 1.6,
}

// ─── Asset list row ───────────────────────────────────────────────────────────

const AssetRow: React.FC<{
  asset: AssetWithHealth
  selected: boolean
  onClick: () => void
}> = ({ asset, selected, onClick }) => {
  const { health } = asset
  const pct = Math.max(0, Math.min(100, health.healthScore))
  const barColor = riskColor(health.risk)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: selected ? '#0f3460' : '#0a2744',
        border: `1px solid ${selected ? '#e94560' : '#1a3a60'}`,
        borderRadius: 5,
        cursor: 'pointer',
        marginBottom: 4,
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 13 }}>{riskEmoji(health.risk)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: selected ? '#e0e0e0' : '#ccd8e8',
            marginBottom: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {asset.id}
        </div>
        <div style={{ position: 'relative', height: 5, background: '#1a3a60', borderRadius: 3 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${pct}%`,
              background: barColor,
              borderRadius: 3,
              transition: 'width 0.3s',
            }}
          />
        </div>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: barColor,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {pct}%
      </span>
    </button>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

const DetailPanel: React.FC<{ asset: AssetWithHealth }> = ({ asset }) => {
  const { health } = asset

  const metaRow = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#5577aa' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#ccd8e8', fontWeight: 600 }}>{value}</span>
    </div>
  )

  const warrantyColor =
    asset.warranty_status === 'Active'
      ? '#27ae60'
      : asset.warranty_status === 'Expiring Soon'
      ? '#f39c12'
      : '#e74c3c'

  return (
    <div>
      {/* A. Asset Metadata */}
      <div
        style={{
          background: '#0a2744',
          border: '1px solid #1a3a60',
          borderRadius: 5,
          padding: '10px 12px',
          marginBottom: 8,
        }}
      >
        <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>A · Asset Metadata</div>
        {metaRow('ID', asset.id)}
        {metaRow('Type', asset.type)}
        {metaRow('Manufacturer', asset.manufacturer)}
        {metaRow('Installed', asset.installation_date)}
        {metaRow('Lifecycle', `${asset.lifecycle_years} yr`)}
        {metaRow('Last Inspection', asset.last_inspection)}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#5577aa' }}>Warranty</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: warrantyColor }}>
            {asset.warranty_status}
          </span>
        </div>
      </div>

      {/* B. Operational Metrics */}
      <div
        style={{
          background: '#0a2744',
          border: '1px solid #1a3a60',
          borderRadius: 5,
          padding: '10px 12px',
          marginBottom: 8,
        }}
      >
        <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>B · Operational Metrics</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
            padding: '8px 10px',
            background: '#061525',
            borderRadius: 4,
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700, color: riskColor(health.risk) }}>
            {health.healthScore}%
          </span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: riskColor(health.risk) }}>
              {riskEmoji(health.risk)} {health.risk}
            </div>
            <div style={{ fontSize: 10, color: '#5577aa' }}>{health.urgency}</div>
          </div>
        </div>
        {metaRow('Operating Temp', `${asset.operating_temp_c}°C`)}
        {metaRow('Uptime', `${asset.uptime_pct.toFixed(1)}%`)}
        {metaRow('Errors (30d)', `${asset.error_events_30d}`)}
        {metaRow(
          'Load Factor',
          asset.design_capacity_veh_hr > 1
            ? `${((asset.vehicles_per_hr / asset.design_capacity_veh_hr) * 100).toFixed(0)}%`
            : 'N/A'
        )}
        {metaRow('Env Exposure', asset.environmental_exposure.toFixed(2))}
      </div>

      {/* C. Predictions */}
      <div
        style={{
          background: '#0a2744',
          border: '1px solid #1a3a60',
          borderRadius: 5,
          padding: '10px 12px',
          marginBottom: 8,
        }}
      >
        <div style={{ ...sectionLabelStyle, marginBottom: 8 }}>C · Predictions</div>
        {metaRow('Remaining Useful Life', `${Math.max(0, health.rul).toFixed(1)} yr`)}
        {metaRow(
          'Failure Probability (30d)',
          `${Math.min(99, health.failProb30d)}%`
        )}
        {metaRow('Recommended Action', health.urgency)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const AssetHealthScenario: React.FC<Props> = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedAsset = selectedId
    ? ASSETS_WITH_HEALTH.find((a) => a.id === selectedId) ?? null
    : null

  return (
    <div>
      {/* Data Sources */}
      <div style={dataSourceStyle}>
        <strong style={{ color: '#ccd8e8' }}>Data Sources:</strong> 9 representative toll-site assets
        · POC — mocked operational telemetry
        <br />
        Health scores computed from age, load, environmental stress, and fault rate indices.
      </div>

      {/* Asset list */}
      <div style={{ ...sectionLabelStyle }}>Asset Inventory</div>
      <div style={{ marginBottom: 16 }}>
        {ASSETS_WITH_HEALTH.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            selected={selectedId === asset.id}
            onClick={() => setSelectedId(selectedId === asset.id ? null : asset.id)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selectedAsset && (
        <div style={{ marginBottom: 12 }}>
          <div style={sectionLabelStyle}>Asset Health Panel — {selectedAsset.id}</div>
          <DetailPanel asset={selectedAsset} />
        </div>
      )}

      {/* Methodology */}
      <MethodologyPanel title="Health Score Model">
        <pre
          style={{
            margin: 0,
            fontSize: 10,
            lineHeight: 1.6,
            color: '#7799bb',
            whiteSpace: 'pre-wrap',
            fontFamily: 'monospace',
          }}
        >
{`Health Score Model (0–100 scale)

Score = 100 × (1 − Degradation_Composite)

Degradation_Composite =
  0.35 × Age Degradation Index       (Age / Lifecycle)
+ 0.25 × Operational Load Index      (veh/hr ÷ Design Capacity)
+ 0.20 × Environmental Stress Index  (Weather × Exposure Factor)
+ 0.20 × Fault / Error Index         (Errors_30d / 30)

Risk thresholds:
  Green  > 75%  (Routine monitoring)
  Amber  50–75% (Scheduled inspection)
  Red    < 50%  (Immediate action)

RUL = Lifecycle_years − Asset_Age_years
Failure Probability (30d) = Degradation_Composite × 40% (heuristic ceiling)`}
        </pre>
      </MethodologyPanel>
    </div>
  )
}

export default AssetHealthScenario
