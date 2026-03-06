const N8N_BASE = import.meta.env.VITE_N8N_BASE_URL ?? 'http://localhost:8000'

export const API = {
  toll:       `${N8N_BASE}/webhook/simulate-toll`,
  corridor:   `${N8N_BASE}/webhook/simulate-corridor`,
  emission:   `${N8N_BASE}/webhook/simulate-emission`,
  evasion:    `${N8N_BASE}/webhook/simulate-evasion`,
  comparison: `${N8N_BASE}/webhook/simulate-comparison`,
}

// Legacy export for any remaining direct references
export const API_BASE = N8N_BASE
