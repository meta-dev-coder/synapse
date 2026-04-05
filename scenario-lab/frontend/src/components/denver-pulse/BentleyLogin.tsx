import React, { useState, useEffect } from 'react'

export type DenverRole = 'policy' | 'emergency'

interface Props {
  onLogin: (role: DenverRole) => void
  onBack: () => void
}

// ── Shared styles ────────────────────────────────────────────────────────────

const pill = (color: string, bg: string, border: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 10, fontWeight: 600,
  color, background: bg, border: `1px solid ${border}`,
  padding: '3px 10px', borderRadius: 99,
})

const checkItem = (
  <span style={{ width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#10b981', borderRadius: '50%', flexShrink: 0, marginRight: 6 }}>
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M1.5 4L3 5.5L6.5 2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </span>
)

// ── Auth Overlay — two-phase animated step progress ──────────────────────────

type StepStatus = 'done' | 'active' | 'pending'

const PHASE1_STEPS = [
  'Connecting to Bentley Identity',
  'Verifying user credentials',
  'Fetching digital twin access',
]
const PHASE2_STEPS = [
  'Loading iTwin project',
  'Syncing infrastructure data',
  'Preparing simulation environment',
]

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    )
  }
  if (status === 'active') {
    return (
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: '2.5px solid rgba(96,165,250,0.3)',
        borderTop: '2.5px solid #60a5fa',
        animation: 'bentleySpinAnim 0.85s linear infinite',
      }} />
    )
  }
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      border: '1.5px solid #d1d5db',
    }} />
  )
}

function AuthOverlay({ name, roleLabel, role }: {
  name: string; roleLabel: string; role: DenverRole
}) {
  // stepIndex 0..5: 0-2 = phase 1 steps, 3-5 = phase 2 steps
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex(prev => Math.min(prev + 1, 5))
    }, 720)
    return () => clearInterval(id)
  }, [])

  const phase = stepIndex < 3 ? 1 : 2
  const localStep = stepIndex < 3 ? stepIndex : stepIndex - 3
  const steps = phase === 1 ? PHASE1_STEPS : PHASE2_STEPS
  const completedSteps = Math.min(localStep, 3)

  const accentColor = role === 'emergency' ? '#f87171' : '#60a5fa'
  const initials = role === 'emergency' ? 'SJ' : 'SC'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 55%, #ecfdf5 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      gap: 20,
    }}>
      {/* User pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 99, padding: '6px 14px 6px 8px',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: role === 'emergency' ? 'rgba(239,68,68,0.2)' : 'rgba(37,99,235,0.3)',
          border: `1.5px solid ${accentColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: accentColor,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{name}</span>
        <span style={{ fontSize: 11, color: '#d1d5db' }}>·</span>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{roleLabel}</span>
      </div>

      {/* Card */}
      <div style={{
        width: 420, maxWidth: 'calc(100vw - 32px)',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16, padding: 28,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Phase badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
          borderRadius: 99, padding: '3px 10px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.08em' }}>
            PHASE {phase} OF 2
          </span>
        </div>

        {/* Title & subtitle */}
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 4, lineHeight: 1.3 }}>
          {phase === 1 ? 'Authenticating with Bentley iTwin' : 'Initializing Digital Twin Environment'}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
          {phase === 1
            ? 'Verifying identity and access permissions…'
            : 'Loading Denver mobility data and infrastructure model'}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#e5e7eb', marginBottom: 20 }} />

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((label, i) => {
            const status: StepStatus = i < localStep ? 'done' : i === localStep ? 'active' : 'pending'
            return (
              <div key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0' }}>
                  <StepIcon status={status} />
                  <span style={{
                    fontSize: 13,
                    fontWeight: status === 'active' ? 600 : 400,
                    color: status === 'done'
                      ? '#4b5563'
                      : status === 'active'
                        ? '#111827'
                        : '#9ca3af',
                    transition: 'color 0.3s',
                  }}>
                    {label}
                  </span>
                </div>
                {/* Connector line between steps */}
                {i < steps.length - 1 && (
                  <div style={{ marginLeft: 10, width: 1, height: 16, background: '#e5e7eb' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: '#e5e7eb', borderRadius: 99, marginTop: 20, marginBottom: 18, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(completedSteps / 3) * 100}%`,
            background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
            borderRadius: 99,
            transition: 'width 0.6s ease',
          }} />
        </div>

        {/* Footer notice */}
        {phase === 1 ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize: 11, color: '#92400e', fontWeight: 500 }}>
              Do not close this window
            </span>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            <span style={{ fontSize: 11, color: '#047857', fontWeight: 500 }}>
              Powered by Bentley iTwin + Cesium visualization
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bentley logo mark ────────────────────────────────────────────────────────

function BentleyB({ size = 10 }: { size?: number }) {
  return (
    <div style={{
      width: size + 4, height: size + 4, borderRadius: 3, flexShrink: 0,
      background: 'linear-gradient(135deg, #0e1f3a 0%, #1a3a6b 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ color: '#fff', fontWeight: 800, fontSize: size, lineHeight: 1 }}>B</span>
    </div>
  )
}

// ── Role Card ────────────────────────────────────────────────────────────────

interface RoleCardProps {
  icon: React.ReactNode
  accentColor: string
  accentBg: string
  accentBorder: string
  roleTag: string
  avatarSrc: string
  name: string
  orgLabel: string
  accessItems: string[]
  btnLabel: string
  onClick: () => void
}

function RoleCard({
  icon, accentColor, accentBg, accentBorder, roleTag,
  avatarSrc, name, orgLabel, accessItems, btnLabel, onClick,
}: RoleCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: '#fff',
        border: hovered ? `1px solid #93c5fd` : '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        cursor: 'pointer',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? '0 12px 32px -6px rgba(15,23,42,0.14)'
          : '0 4px 12px -2px rgba(15,23,42,0.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10,
          background: accentBg, border: `1px solid ${accentBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={pill(accentColor, accentBg, accentBorder)}>{roleTag}</span>
      </div>

      {/* Avatar + name */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f3f4f6',
      }}>
        <img
          src={avatarSrc}
          alt={name}
          style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${accentBorder}`, objectFit: 'cover', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{orgLabel}</div>
        </div>
      </div>

      {/* Access list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20, flex: 1 }}>
        {accessItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#374151' }}>
            {checkItem}{item}
          </div>
        ))}
      </div>

      {/* CTA */}
      <button style={{
        width: '100%', padding: '10px 0',
        background: hovered ? '#1d4ed8' : '#2563eb',
        color: '#fff', fontWeight: 600, fontSize: 13,
        border: 'none', borderRadius: 7, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'background 0.15s',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
        </svg>
        {btnLabel}
      </button>

      {/* SSO tag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 }}>
        <BentleyB size={8} />
        <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>via Bentley iTwin SSO</span>
      </div>
    </div>
  )
}

// ── Trust badge ──────────────────────────────────────────────────────────────

function TrustBadge({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: '12px 8px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9',
    }}>
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, color: '#374151', textAlign: 'center', lineHeight: 1.3 }}>{title}</span>
      <span style={{ fontSize: 9, color: '#9ca3af' }}>{sub}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

const BentleyLogin: React.FC<Props> = ({ onLogin, onBack }) => {
  const [authState, setAuthState] = useState<{ name: string; label: string; role: DenverRole } | null>(null)

  function handleRoleSelect(role: DenverRole) {
    const info = role === 'policy'
      ? { name: 'Sarah Chen', label: 'Policy Analyst · Denver DOTI', role }
      : { name: 'Sarah Jenkins', label: 'Emergency Manager · Denver OEM', role }
    setAuthState(info)
    setTimeout(() => onLogin(role), 4600)
  }

  return (
    <div style={{
      minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 55%, #ecfdf5 100%)',
    }}>
      {/* Spinner keyframes injected via <style> */}
      <style>{`
        @keyframes bentleySpinAnim { to { transform: rotate(360deg); } }
        @keyframes bentleyFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes bentleyPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .bl-fade { animation: bentleyFadeUp 0.5s ease forwards; }
        .bl-fade-d1 { animation: bentleyFadeUp 0.5s 0.1s ease forwards; opacity:0; }
        .bl-fade-d2 { animation: bentleyFadeUp 0.5s 0.22s ease forwards; opacity:0; }
        .bl-fade-d3 { animation: bentleyFadeUp 0.5s 0.34s ease forwards; opacity:0; }
        .bl-pulse-dot { animation: bentleyPulse 2s ease-in-out infinite; }
      `}</style>

      {/* Auth overlay */}
      {authState && <AuthOverlay name={authState.name} roleLabel={authState.label} role={authState.role} />}

      {/* Bentley top bar */}
      <div style={{
        background: 'linear-gradient(90deg, #0e1f3a 0%, #1a3a6b 60%, #1d4ed8 100%)',
        padding: '7px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 22, height: 22, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 11 }}>B</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 500, letterSpacing: 0.3 }}>
              Bentley Systems · iTwin Platform
            </span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>|</span>
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 500 }}>
            Enterprise Digital Infrastructure Partner
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="bl-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: 500 }}>
            Secure · ISO 27001 · SOC 2 Type II
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 16px', minHeight: 'calc(100vh - 36px)',
      }}>

        {/* Back button */}
        <div className="bl-fade" style={{ width: '100%', maxWidth: 680, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6,
              color: '#6b7280', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
            }}
          >
            ← Back
          </button>
        </div>

        {/* Branding */}
        <div className="bl-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          {/* Logos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {/* SuperSim */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px -2px rgba(15,23,42,0.15)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: -0.5 }}>SuperSim</span>
            </div>

            {/* × divider */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 1, height: 20, background: '#d1d5db' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', background: '#fff', border: '1px solid #e5e7eb', padding: '1px 5px', borderRadius: 99 }}>×</span>
              <div style={{ width: 1, height: 20, background: '#d1d5db' }} />
            </div>

            {/* Bentley */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #0e1f3a 0%, #1a3a6b 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px -2px rgba(15,23,42,0.15)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>B</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>Bentley Systems</div>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>iTwin Platform</div>
              </div>
            </div>
          </div>

          {/* Partnership badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#fff', border: '1px solid #dbeafe',
            borderRadius: 99, padding: '6px 14px', marginBottom: 16,
            boxShadow: '0 2px 8px -2px rgba(15,23,42,0.08)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8' }}>
              Strategic Technology Partnership · Denver Urban Mobility Initiative
            </span>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', textAlign: 'center', letterSpacing: -0.5, margin: '0 0 8px' }}>
            Secure Access Portal
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', maxWidth: 420, lineHeight: 1.6, margin: 0 }}>
            Enterprise identity and access managed by Bentley iTwin.
            Select your role to authenticate and enter your workspace.
          </p>
        </div>

        {/* Role cards */}
        <div className="bl-fade-d1" style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 680, marginBottom: 20 }}>
          <RoleCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            }
            accentColor="#1d4ed8"
            accentBg="#eff6ff"
            accentBorder="#bfdbfe"
            roleTag="POLICY"
            avatarSrc="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=40&h=40&q=80"
            name="Sarah Chen"
            orgLabel="Policy Analyst · Denver DOTI"
            accessItems={[
              'Live Dashboard & Mobility KPIs',
              'Scenario Simulation & Policy Modelling',
              'GHG Emissions & Mode Share Analysis',
              'Saved Scenarios & Comparison Reports',
            ]}
            btnLabel="Sign in as Policy Analyst"
            onClick={() => handleRoleSelect('policy')}
          />
          <RoleCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
              </svg>
            }
            accentColor="#dc2626"
            accentBg="#fef2f2"
            accentBorder="#fecaca"
            roleTag="OPERATIONS"
            avatarSrc="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=40&h=40&q=80"
            name="Sarah Jenkins"
            orgLabel="Emergency Manager · Denver OEM"
            accessItems={[
              'Live Operations & Real-time Alerts',
              'Emergency Response Simulation',
              'Incident Routing & Zone Management',
              'Event Logs & Incident Compare',
            ]}
            btnLabel="Sign in as Emergency Manager"
            onClick={() => handleRoleSelect('emergency')}
          />
        </div>

        {/* Security trust strip */}
        <div className="bl-fade-d2" style={{
          width: '100%', maxWidth: 680,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: 16, marginBottom: 20,
          boxShadow: '0 4px 12px -2px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #0e1f3a, #1a3a6b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>Secured by Bentley iTwin Infrastructure</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>Enterprise-grade identity, access control and audit logging</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <TrustBadge
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
              title="End-to-end Encryption"
              sub="TLS 1.3 / AES-256"
            />
            <TrustBadge
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>}
              title="ISO 27001 Certified"
              sub="Bentley Systems"
            />
            <TrustBadge
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>}
              title="SOC 2 Type II"
              sub="Annual audit"
            />
            <TrustBadge
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>}
              title="Zero-Trust RBAC"
              sub="Role-based access"
            />
          </div>
        </div>

        {/* Feature pills */}
        <div className="bl-fade-d3" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          {[
            { label: 'Real-time mobility insights', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
            { label: 'Scenario-based policy simulation', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
            { label: 'City-scale digital twin', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
            { label: 'AI-powered scenario modelling', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
          ].map(({ label, color, bg, border }) => (
            <span key={label} style={pill(color, bg, border)}>{label}</span>
          ))}
        </div>

        {/* Footer */}
        <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>
          SuperSim v2.1 · Denver Urban Mobility Initiative · Powered by Bentley iTwin Platform
        </p>
      </div>
    </div>
  )
}

export default BentleyLogin
