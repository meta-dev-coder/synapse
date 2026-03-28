import React, { useReducer, useEffect } from 'react'
import LoginScreen from './LoginScreen'
import GlobalLayout from './GlobalLayout'
import DashboardScreen from './screens/DashboardScreen'
import { NewScenarioNav, NewScenarioRightPanel } from './screens/NewScenarioScreen'
import ScenariosScreen from './screens/ScenariosScreen'
import DataSourcesScreen from './screens/DataSourcesScreen'
import { CompareNav, CompareRightPanel, type CompareResult } from './screens/CompareScreen'

type Screen = 'dashboard' | 'new_scenario' | 'scenarios' | 'data_sources' | 'compare'
type Role = 'policy_analyst' | 'operations_manager' | 'executive'

interface GpsBus {
  id: string
  lat: number
  lon: number
  bearing: number
}

interface GpsFrame {
  t: number
  ts: string
  buses: GpsBus[]
}

interface ScenarioInputs {
  ev_adoption_pct: number
  mode_shift_pct: number
  bus_efficiency_pct: number
  bike_lanes: boolean
}

interface ScenarioResult {
  co2_reduction_mt: number
  co2_reduction_pct: number
  net_zero_gap_remaining_mt: number
  new_mode_split: Record<string, number>
  new_ev_fleet_pct: number
  traffic_improvement_pct: number
  bus_delay_reduction_pct: number
  cesium_layer_data: {
    emission_intensity: number
    traffic_density: number
    corridors: Record<string, number>
  }
  [key: string]: unknown
}

interface BaselineMetrics {
  total_onroad_co2e_mt: number
  fleet_bev_pct: number
  mode_split: Record<string, number>
  net_zero_gap_mt: number
  annual_vmt_miles: number
  transit_co2e_mt: number
  transport_share_pct: number
  congestion_index: number
  avg_bus_delay_min: number
}

interface SavedScenario {
  id: string
  name: string
  created_at: string
  inputs: ScenarioInputs
  results: ScenarioResult
}

interface DenverState {
  loggedIn: boolean
  user: { name: string; role: Role } | null
  screen: Screen
  mapLayers: {
    traffic: boolean
    emissions: boolean
    bus: boolean
    corridors: boolean
    roads: boolean
    stops: boolean
    intersections: boolean
    ev_stations: boolean
  }
  timeFilter: 'peak' | 'midday' | 'evening' | 'full_day'
  dayRange: 'today' | '7d' | '30d'
  mapOpacity: number
  mapIntensity: 'low' | 'medium' | 'high'
  gpsPlaying: boolean
  gpsSpeed: 1 | 5 | 10
  gpsFrameIndex: number
  gpsFrames: GpsFrame[]
  savedScenarios: SavedScenario[]
  selectedScenarioId: string | null
  compareAId: string | null
  compareBId: string | null
  compareView: 'A' | 'B' | 'diff'
  selectedDataSourceId: string | null
  activeInputs: ScenarioInputs
  activeResult: ScenarioResult | null
  baseline: BaselineMetrics | null
}

type Action =
  | { type: 'LOGIN'; user: { name: string; role: Role } }
  | { type: 'LOGOUT' }
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'TOGGLE_LAYER'; layer: keyof DenverState['mapLayers'] }
  | { type: 'SET_TIME_FILTER'; value: DenverState['timeFilter'] }
  | { type: 'SET_DAY_RANGE'; value: DenverState['dayRange'] }
  | { type: 'SET_MAP_OPACITY'; value: number }
  | { type: 'SET_MAP_INTENSITY'; value: DenverState['mapIntensity'] }
  | { type: 'SET_GPS_PLAYING'; value: boolean }
  | { type: 'SET_GPS_SPEED'; value: 1 | 5 | 10 }
  | { type: 'SET_GPS_FRAME'; index: number }
  | { type: 'ADVANCE_GPS_FRAME' }
  | { type: 'SET_GPS_FRAMES'; frames: GpsFrame[] }
  | { type: 'SET_SAVED_SCENARIOS'; scenarios: SavedScenario[] }
  | { type: 'ADD_SAVED_SCENARIO'; scenario: SavedScenario }
  | { type: 'DELETE_SAVED_SCENARIO'; id: string }
  | { type: 'SELECT_SCENARIO'; id: string | null }
  | { type: 'SET_COMPARE_A'; id: string | null }
  | { type: 'SET_COMPARE_B'; id: string | null }
  | { type: 'SET_COMPARE_VIEW'; view: 'A' | 'B' | 'diff' }
  | { type: 'SELECT_DATA_SOURCE'; id: string | null }
  | { type: 'SET_ACTIVE_INPUTS'; inputs: Partial<ScenarioInputs> }
  | { type: 'SET_ACTIVE_RESULT'; result: ScenarioResult | null }
  | { type: 'SET_BASELINE'; baseline: BaselineMetrics }

const initialState: DenverState = {
  loggedIn: false,
  user: null,
  screen: 'dashboard',
  mapLayers: {
    traffic: true,
    emissions: false,
    bus: true,
    corridors: false,
    roads: true,
    stops: false,
    intersections: false,
    ev_stations: false,
  },
  timeFilter: 'peak',
  dayRange: '30d',
  mapOpacity: 0.8,
  mapIntensity: 'medium',
  gpsPlaying: false,
  gpsSpeed: 1,
  gpsFrameIndex: 0,
  gpsFrames: [],
  savedScenarios: [],
  selectedScenarioId: null,
  compareAId: null,
  compareBId: null,
  compareView: 'diff',
  selectedDataSourceId: null,
  activeInputs: { ev_adoption_pct: 0, mode_shift_pct: 0, bus_efficiency_pct: 0, bike_lanes: false },
  activeResult: null,
  baseline: null,
}

function reducer(state: DenverState, action: Action): DenverState {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, loggedIn: true, user: action.user }
    case 'LOGOUT':
      return { ...initialState }
    case 'SET_SCREEN':
      return { ...state, screen: action.screen }
    case 'TOGGLE_LAYER':
      return { ...state, mapLayers: { ...state.mapLayers, [action.layer]: !state.mapLayers[action.layer] } }
    case 'SET_TIME_FILTER':
      return { ...state, timeFilter: action.value }
    case 'SET_DAY_RANGE':
      return { ...state, dayRange: action.value }
    case 'SET_MAP_OPACITY':
      return { ...state, mapOpacity: action.value }
    case 'SET_MAP_INTENSITY':
      return { ...state, mapIntensity: action.value }
    case 'SET_GPS_PLAYING':
      return { ...state, gpsPlaying: action.value }
    case 'SET_GPS_SPEED':
      return { ...state, gpsSpeed: action.value }
    case 'SET_GPS_FRAME':
      return { ...state, gpsFrameIndex: action.index }
    case 'ADVANCE_GPS_FRAME':
      return {
        ...state,
        gpsFrameIndex: state.gpsFrameIndex >= state.gpsFrames.length - 1
          ? 0
          : state.gpsFrameIndex + 1,
      }
    case 'SET_GPS_FRAMES':
      return { ...state, gpsFrames: action.frames }
    case 'SET_SAVED_SCENARIOS':
      return { ...state, savedScenarios: action.scenarios }
    case 'ADD_SAVED_SCENARIO':
      return { ...state, savedScenarios: [action.scenario, ...state.savedScenarios] }
    case 'DELETE_SAVED_SCENARIO':
      return { ...state, savedScenarios: state.savedScenarios.filter(s => s.id !== action.id) }
    case 'SELECT_SCENARIO':
      return { ...state, selectedScenarioId: action.id }
    case 'SET_COMPARE_A':
      return { ...state, compareAId: action.id }
    case 'SET_COMPARE_B':
      return { ...state, compareBId: action.id }
    case 'SET_COMPARE_VIEW':
      return { ...state, compareView: action.view }
    case 'SELECT_DATA_SOURCE':
      return { ...state, selectedDataSourceId: action.id }
    case 'SET_ACTIVE_INPUTS':
      return { ...state, activeInputs: { ...state.activeInputs, ...action.inputs } }
    case 'SET_ACTIVE_RESULT':
      return { ...state, activeResult: action.result }
    case 'SET_BASELINE':
      return { ...state, baseline: action.baseline }
    default:
      return state
  }
}

const API = 'http://localhost:8000/api/v1/denver'

interface DenverAppProps {
  onBack: () => void
}

export default function DenverApp({ onBack }: DenverAppProps) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [compareResult, setCompareResult] = useReducerCompareState()

  // GPS tick
  useEffect(() => {
    if (!state.gpsPlaying || state.gpsFrames.length === 0) return
    const interval = setInterval(() => {
      dispatch({ type: 'ADVANCE_GPS_FRAME' })
    }, 2000 / state.gpsSpeed)
    return () => clearInterval(interval)
  }, [state.gpsPlaying, state.gpsSpeed, state.gpsFrames.length])

  // Fetch GPS frames on login
  useEffect(() => {
    if (!state.loggedIn || state.gpsFrames.length > 0) return
    fetch(`${API}/gps/positions`)
      .then(r => r.json())
      .then(d => dispatch({ type: 'SET_GPS_FRAMES', frames: d.frames }))
      .catch(err => console.warn('GPS frames unavailable:', err))
  }, [state.loggedIn, state.gpsFrames.length])

  if (!state.loggedIn) {
    return <LoginScreen onLogin={(user) => dispatch({ type: 'LOGIN', user })} />
  }

  // Screen-specific right panel and nav expansion
  const { rightPanel, navExpansion } = getScreenContent(state, dispatch, compareResult, setCompareResult)

  return (
    <GlobalLayout
      state={state}
      dispatch={dispatch}
      onBack={onBack}
      apiBase={API}
      rightPanel={rightPanel}
      navExpansion={navExpansion}
    />
  )
}

function useReducerCompareState(): [CompareResult | null, (r: CompareResult) => void] {
  const [v, setV] = React.useState<CompareResult | null>(null)
  return [v, setV]
}

function getScreenContent(
  state: DenverState,
  dispatch: React.Dispatch<Action>,
  compareResult: CompareResult | null,
  setCompareResult: (r: CompareResult) => void,
): { rightPanel: React.ReactNode; navExpansion: React.ReactNode } {
  switch (state.screen) {
    case 'dashboard':
      return {
        rightPanel: <DashboardScreen state={state} dispatch={dispatch} />,
        navExpansion: null,
      }
    case 'new_scenario':
      return {
        rightPanel: <NewScenarioRightPanel state={state} />,
        navExpansion: <NewScenarioNav state={state} dispatch={dispatch} />,
      }
    case 'scenarios':
      return {
        rightPanel: <ScenariosScreen state={state} dispatch={dispatch} />,
        navExpansion: null,
      }
    case 'data_sources':
      return {
        rightPanel: <DataSourcesScreen state={state} dispatch={dispatch} />,
        navExpansion: null,
      }
    case 'compare':
      return {
        rightPanel: <CompareRightPanel state={state} compareResult={compareResult} dispatch={dispatch} />,
        navExpansion: <CompareNav state={state} dispatch={dispatch} onCompare={setCompareResult} />,
      }
    default:
      return { rightPanel: null, navExpansion: null }
  }
}

export type { DenverState, Action, GpsFrame, GpsBus, ScenarioInputs, ScenarioResult, BaselineMetrics, SavedScenario, Role, Screen }
