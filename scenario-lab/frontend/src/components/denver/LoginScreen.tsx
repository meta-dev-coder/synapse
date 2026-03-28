import { useState } from 'react'
import type { Role } from './DenverApp'

interface LoginScreenProps {
  onLogin: (user: { name: string; role: Role }) => void
}

const DEMO_ROLES: { name: string; role: Role; label: string }[] = [
  { name: 'Alex Chen', role: 'policy_analyst', label: 'Policy Analyst' },
  { name: 'Jordan Lee', role: 'operations_manager', label: 'Operations Manager' },
  { name: 'Sam Rivera', role: 'executive', label: 'Executive' },
]

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--den-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--den-font)',
    }}>
      <div style={{
        background: 'var(--den-panel)',
        border: '1px solid var(--den-border)',
        borderRadius: 12,
        padding: '40px 36px',
        width: 380,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <div>
          <h1 style={{ color: 'var(--den-text)', margin: 0, fontSize: 22, fontWeight: 700 }}>
            Synapse | Denver
          </h1>
          <p style={{ color: 'var(--den-text-muted)', margin: '4px 0 0', fontSize: 13 }}>
            Transportation Policy Decision Platform
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              background: 'var(--den-surface)',
              border: '1px solid var(--den-border)',
              borderRadius: 6,
              color: 'var(--den-text)',
              padding: '10px 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              background: 'var(--den-surface)',
              border: '1px solid var(--den-border)',
              borderRadius: 6,
              color: 'var(--den-text)',
              padding: '10px 12px',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => onLogin({ name: 'User', role: 'policy_analyst' })}
            style={{
              background: 'var(--den-primary)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              padding: '10px',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Sign In
          </button>
        </div>

        <div>
          <p style={{ color: 'var(--den-text-muted)', fontSize: 12, margin: '0 0 10px', textAlign: 'center' }}>
            Quick Demo Access
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_ROLES.map(({ name, role, label }) => (
              <button
                key={role}
                onClick={() => onLogin({ name, role })}
                style={{
                  background: 'var(--den-surface)',
                  border: '1px solid var(--den-border)',
                  borderRadius: 6,
                  color: 'var(--den-text)',
                  padding: '9px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 200ms ease',
                }}
              >
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ color: 'var(--den-text-muted)', marginLeft: 8 }}>{name}</span>
              </button>
            ))}
          </div>
        </div>

        <p style={{ color: 'var(--den-text-muted)', fontSize: 11, textAlign: 'center', margin: 0, borderTop: '1px solid var(--den-border)', paddingTop: 16 }}>
          Powered by Bentley Enterprise Connection Services
        </p>
      </div>
    </div>
  )
}
