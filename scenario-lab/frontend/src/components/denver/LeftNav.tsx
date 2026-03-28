import type { DenverState, Action, Screen } from './DenverApp'

interface NavItem {
  screen: Screen
  label: string
  group: 'core' | 'support' | 'decision'
}

interface LeftNavProps {
  state: DenverState
  dispatch: React.Dispatch<Action>
  expansionContent?: React.ReactNode
}

const GROUP_LABELS: Record<string, string> = {
  core: 'CORE FLOW',
  support: 'SUPPORT',
  decision: 'DECISION',
}

export default function LeftNav({ state, dispatch, expansionContent }: LeftNavProps) {
  const { user, screen } = state
  const isExecutive = user?.role === 'executive'

  const navItems: NavItem[] = [
    { screen: 'dashboard',    label: 'Dashboard',    group: 'core' },
    ...(!isExecutive ? [{ screen: 'new_scenario' as Screen, label: 'New Scenario', group: 'core' as const }] : []),
    { screen: 'scenarios',    label: 'Scenarios',    group: 'core' },
    { screen: 'data_sources', label: 'Data Sources', group: 'support' },
    { screen: 'compare',      label: 'Compare',      group: 'decision' },
  ]

  const groups = ['core', 'support', 'decision'] as const
  const itemsByGroup = groups.reduce((acc, g) => {
    acc[g] = navItems.filter(i => i.group === g)
    return acc
  }, {} as Record<string, NavItem[]>)

  return (
    <div style={{
      width: 220,
      background: 'var(--den-panel)',
      borderRight: '1px solid var(--den-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '12px 8px', flex: 1 }}>
        {groups.map(group => {
          const items = itemsByGroup[group]
          if (!items || items.length === 0) return null
          return (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--den-text-muted)',
                letterSpacing: '0.08em',
                padding: '0 8px 6px',
              }}>
                {GROUP_LABELS[group]}
              </div>
              {items.map(item => (
                <div key={item.screen}>
                  <button
                    onClick={() => dispatch({ type: 'SET_SCREEN', screen: item.screen })}
                    style={{
                      width: '100%',
                      background: screen === item.screen ? 'var(--den-primary)' : 'none',
                      border: 'none',
                      color: screen === item.screen ? '#fff' : 'var(--den-text-muted)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      fontWeight: screen === item.screen ? 600 : 400,
                      transition: 'background 200ms ease, color 200ms ease',
                    }}
                  >
                    {item.label}
                  </button>
                  {screen === item.screen && expansionContent && (
                    <div style={{ padding: '8px 4px 4px' }}>
                      {expansionContent}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div style={{
        borderTop: '1px solid var(--den-border)',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {[
          { icon: '👤', label: 'Profile' },
          { icon: '🔔', label: 'Notifications' },
          { icon: '❓', label: 'Help' },
        ].map(({ icon, label }) => (
          <button
            key={label}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--den-text-muted)',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
