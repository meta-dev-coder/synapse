// Denver Pulse — API client + TypeScript interfaces
// All API calls hit http://localhost:8000/api/v1/denver-pulse

const BASE = (import.meta.env.VITE_DENVER_API_BASE as string | undefined)?.replace('/api/v1/denver', '/api/v1/denver-pulse') ?? 'http://localhost:8000/api/v1/denver-pulse'

// ---------------------------------------------------------------------------
// Interfaces (shared contract with backend Pydantic schemas)
// ---------------------------------------------------------------------------

export interface DenverPulseSliders {
  traffic_vol_idx: number
  road_capacity_idx: number
  speed_kmh: number
  emission_idx: number
  ev_share_pct: number
  car_pct: number
  pt_pct: number
  bike_pct: number
  walk_pct: number
}

export interface DenverPulseKPIs {
  ghg_tco2e: number
  congestion_pct: number
  avg_speed_kmh: number
  mode_share: { car: number; pt: number; bike: number; walk: number }
}

export interface DenverPulseDeltas {
  ghg_tco2e_delta: number
  congestion_pct_delta: number
  avg_speed_kmh_delta: number
  mode_share_delta: { car: number; pt: number; bike: number; walk: number }
}

export interface DenverPulseCesiumEdges {
  baseline: Record<string, number>
  scenario: Record<string, number>
}

export interface DenverPulseSimulateRequest {
  policies: string[]
  scope: string
  horizon: string
  sliders: DenverPulseSliders
}

export interface DenverPulseSimulateResponse {
  baseline: DenverPulseKPIs
  scenario: DenverPulseKPIs
  deltas: DenverPulseDeltas
  confidence_score: number
  cesium_edges: DenverPulseCesiumEdges
}

export interface DenverPulseAlert {
  level: 'red' | 'orange' | 'green' | 'blue' | 'yellow'
  title: string
  description: string
  timestamp: string
}

export interface DenverPulseTrends {
  labels: string[]
  emissions: number[]
  car_pct: number[]
  pt_pct: number[]
  bike_pct: number[]
  walk_pct: number[]
}

export interface DenverPulseDashboardResponse {
  kpis: DenverPulseKPIs
  kpi_trends: Record<string, number>
  trends_7d: DenverPulseTrends
  trends_30d: DenverPulseTrends
  trends_ytd: DenverPulseTrends
  alerts: DenverPulseAlert[]
  cesium_edges: Record<string, Record<string, number>>
}

export interface DenverPulseSaveRequest {
  name: string
  scope: string
  horizon: string
  policies: string[]
  sliders: DenverPulseSliders
  simulate_result: DenverPulseSimulateResponse
}

export interface DenverPulseSavedScenario {
  id: string
  short_id: string
  name: string
  created_at: string
  saved_by: string
  scope: string
  horizon: string
  policies: string[]
  sliders: DenverPulseSliders
  simulate_result: DenverPulseSimulateResponse
  confidence_score: number
}

export interface DenverPulseCompareResponse {
  scenarios: DenverPulseSavedScenario[]
  kpi_rows: Array<{ label: string; unit: string; lower_better: boolean; values: Record<string, number> }>
  param_rows: Array<{ label: string; key: string; unit: string; values: Record<string, number> }>
  policy_rows: Array<{ policy_id: string; label: string; values: Record<string, boolean> }>
  confidence_cards: Array<{ short_id: string; name: string; score: number; horizon: string; policy_count: number }>
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Denver Pulse API ${res.status}: ${path} — ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const api = {
  getDashboard: () =>
    req<DenverPulseDashboardResponse>('/dashboard'),

  simulate: (body: DenverPulseSimulateRequest) =>
    req<DenverPulseSimulateResponse>('/simulate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listScenarios: () =>
    req<DenverPulseSavedScenario[]>('/scenarios'),

  saveScenario: (body: DenverPulseSaveRequest) =>
    req<DenverPulseSavedScenario>('/scenarios', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteScenario: (id: string) =>
    req<{ ok: boolean }>(`/scenarios/${id}`, { method: 'DELETE' }),

  compareScenarios: (body: { scenario_ids: string[] }) =>
    req<DenverPulseCompareResponse>('/scenarios/compare', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  exportScenarioUrl: (id: string, format: 'csv' | 'pdf') =>
    `${BASE}/scenarios/${id}/export?format=${format}`,

  exportComparison: (body: { scenario_ids: string[]; format: string }) =>
    fetch(`${BASE}/scenarios/compare/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => {
      if (!r.ok) throw new Error(`Export failed: ${r.status}`)
      return r.blob()
    }),

  getTrafficDots: () =>
    req<TrafficSimInitResponse>('/traffic-dots'),

  repathTrafficDots: (body: { count: number }) =>
    req<{ vehicles: TrafficSimVehicle[] }>('/traffic-dots/repath', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

// ---------------------------------------------------------------------------
// Traffic Sim interfaces
// ---------------------------------------------------------------------------

export interface NeighborhoodInfo {
  id: string
  name: string
  typology: string | null
  area_km2: number
}

export interface TrafficSimVehicle {
  id: string
  mode: string  // car, truck, van, bus, bike
  path: number[][]  // [[lon, lat], ...]
  speed: number
}

export interface TrafficSimInitResponse {
  boundary: number[][]  // [[lon, lat], ...] polygon ring
  vehicles: TrafficSimVehicle[]
  stats: { vehicle_count: number; area_km2: number; modes: Record<string, number> }
}

// ---------------------------------------------------------------------------
// Traffic Sim API client
// ---------------------------------------------------------------------------

const TRAFFIC_SIM_BASE = (import.meta.env.VITE_DENVER_API_BASE as string | undefined)?.replace('/api/v1/denver', '/api/v1/denver/traffic-sim') ?? 'http://localhost:8000/api/v1/denver/traffic-sim'

async function reqTrafficSim<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${TRAFFIC_SIM_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Traffic Sim API ${res.status}: ${path} — ${text}`)
  }
  return res.json() as Promise<T>
}

export const trafficSimApi = {
  getNeighborhoods: () =>
    reqTrafficSim<NeighborhoodInfo[]>('/neighborhoods'),

  initTrafficSim: (body: { neighborhood_id: string }) =>
    reqTrafficSim<TrafficSimInitResponse>('/init', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  repathVehicles: (body: { neighborhood_id: string; count: number }) =>
    reqTrafficSim<{ vehicles: TrafficSimVehicle[] }>('/repath', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
