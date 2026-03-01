export interface Asset {
  id: string
  name: string
  type: string
  manufacturer: string
  installation_date: string
  lifecycle_years: number
  last_inspection: string
  warranty_status: 'Active' | 'Expired' | 'Expiring Soon'
  // Operational mock values
  vehicles_per_hr: number
  design_capacity_veh_hr: number
  error_events_30d: number
  uptime_pct: number
  operating_temp_c: number
  environmental_exposure: number  // 0–1
  weather_intensity: number       // 0–1
  exposure_factor: number         // 0–1
}

export interface HealthResult {
  healthScore: number
  risk: 'Green' | 'Amber' | 'Red'
  rul: number
  failProb30d: number
  urgency: 'Immediate' | 'Scheduled' | 'Routine'
  ageIndex: number
  loadIndex: number
  envIndex: number
  faultIndex: number
}

export function computeHealthScore(asset: Asset, today: Date = new Date()): HealthResult {
  const ageYrs = (today.getTime() - new Date(asset.installation_date).getTime()) / (365.25 * 86400 * 1000)
  const ageIndex = Math.min(1, ageYrs / asset.lifecycle_years)

  const loadIndex = Math.min(1, asset.vehicles_per_hr / asset.design_capacity_veh_hr)

  const envIndex = Math.min(1, asset.weather_intensity * asset.exposure_factor)

  const faultIndex = Math.min(1, asset.error_events_30d / 30)

  const degradation = 0.35 * ageIndex + 0.25 * loadIndex + 0.20 * envIndex + 0.20 * faultIndex
  const healthScore = Math.round((1 - degradation) * 100)

  const rul = asset.lifecycle_years - ageYrs
  const failProb30d = Math.round(degradation * 40)

  const risk: 'Green' | 'Amber' | 'Red' =
    healthScore > 75 ? 'Green' : healthScore >= 50 ? 'Amber' : 'Red'

  const urgency: 'Immediate' | 'Scheduled' | 'Routine' =
    risk === 'Red' ? 'Immediate' : risk === 'Amber' ? 'Scheduled' : 'Routine'

  return { healthScore, risk, rul, failProb30d, urgency, ageIndex, loadIndex, envIndex, faultIndex }
}

export const ASSETS: Asset[] = [
  {
    id: 'GANTRY-01',
    name: 'Toll Gantry 01',
    type: 'Toll Gantry',
    manufacturer: 'Kapsch',
    installation_date: '2018-04-15',
    lifecycle_years: 20,
    last_inspection: '2025-11-10',
    warranty_status: 'Active',
    vehicles_per_hr: 2350,
    design_capacity_veh_hr: 4200,
    error_events_30d: 2,
    uptime_pct: 99.1,
    operating_temp_c: 34,
    environmental_exposure: 0.3,
    weather_intensity: 0.35,
    exposure_factor: 0.4,
  },
  {
    id: 'CAM-ANPR-01',
    name: 'ANPR Camera 01',
    type: 'ANPR Camera',
    manufacturer: 'Genetec',
    installation_date: '2020-07-20',
    lifecycle_years: 8,
    last_inspection: '2025-09-05',
    warranty_status: 'Expiring Soon',
    vehicles_per_hr: 2350,
    design_capacity_veh_hr: 4200,
    error_events_30d: 5,
    uptime_pct: 97.8,
    operating_temp_c: 38,
    environmental_exposure: 0.5,
    weather_intensity: 0.4,
    exposure_factor: 0.55,
  },
  {
    id: 'WIM-01',
    name: 'Weigh-in-Motion 01',
    type: 'Weigh-in-Motion',
    manufacturer: 'Kistler',
    installation_date: '2019-02-10',
    lifecycle_years: 15,
    last_inspection: '2025-06-22',
    warranty_status: 'Active',
    vehicles_per_hr: 800,
    design_capacity_veh_hr: 1500,
    error_events_30d: 3,
    uptime_pct: 98.5,
    operating_temp_c: 30,
    environmental_exposure: 0.6,
    weather_intensity: 0.45,
    exposure_factor: 0.5,
  },
  {
    id: 'LOOP-L2-01',
    name: 'Loop Detector L2',
    type: 'Loop Detector',
    manufacturer: 'Reno A&E',
    installation_date: '2017-09-01',
    lifecycle_years: 10,
    last_inspection: '2024-12-15',
    warranty_status: 'Expired',
    vehicles_per_hr: 1550,
    design_capacity_veh_hr: 1800,
    error_events_30d: 18,
    uptime_pct: 91.2,
    operating_temp_c: 42,
    environmental_exposure: 0.75,
    weather_intensity: 0.6,
    exposure_factor: 0.7,
  },
  {
    id: 'CTRL-L3',
    name: 'Lane Controller L3',
    type: 'Lane Controller',
    manufacturer: 'Siemens',
    installation_date: '2021-03-08',
    lifecycle_years: 12,
    last_inspection: '2025-10-18',
    warranty_status: 'Active',
    vehicles_per_hr: 1550,
    design_capacity_veh_hr: 1800,
    error_events_30d: 1,
    uptime_pct: 99.7,
    operating_temp_c: 28,
    environmental_exposure: 0.2,
    weather_intensity: 0.25,
    exposure_factor: 0.3,
  },
  {
    id: 'VMS-NORTH',
    name: 'Variable Message Sign N',
    type: 'Variable Message Sign',
    manufacturer: 'Daktronics',
    installation_date: '2019-06-14',
    lifecycle_years: 12,
    last_inspection: '2025-08-30',
    warranty_status: 'Expiring Soon',
    vehicles_per_hr: 0,
    design_capacity_veh_hr: 1,
    error_events_30d: 4,
    uptime_pct: 96.4,
    operating_temp_c: 40,
    environmental_exposure: 0.65,
    weather_intensity: 0.55,
    exposure_factor: 0.6,
  },
  {
    id: 'WX-STATION',
    name: 'Weather Station',
    type: 'Weather Station',
    manufacturer: 'Vaisala',
    installation_date: '2022-01-25',
    lifecycle_years: 10,
    last_inspection: '2025-12-01',
    warranty_status: 'Active',
    vehicles_per_hr: 0,
    design_capacity_veh_hr: 1,
    error_events_30d: 0,
    uptime_pct: 100,
    operating_temp_c: 25,
    environmental_exposure: 0.8,
    weather_intensity: 0.7,
    exposure_factor: 0.65,
  },
  {
    id: 'PVMT-S1',
    name: 'Pavement Segment 1',
    type: 'Pavement Segment',
    manufacturer: 'N/A',
    installation_date: '2015-11-01',
    lifecycle_years: 25,
    last_inspection: '2024-10-05',
    warranty_status: 'Expired',
    vehicles_per_hr: 4200,
    design_capacity_veh_hr: 6200,
    error_events_30d: 8,
    uptime_pct: 100,
    operating_temp_c: 35,
    environmental_exposure: 0.9,
    weather_intensity: 0.5,
    exposure_factor: 0.85,
  },
  {
    id: 'ECAB-01',
    name: 'Electrical Cabinet 01',
    type: 'Electrical Cabinet',
    manufacturer: 'Schneider',
    installation_date: '2018-08-20',
    lifecycle_years: 20,
    last_inspection: '2025-07-14',
    warranty_status: 'Active',
    vehicles_per_hr: 0,
    design_capacity_veh_hr: 1,
    error_events_30d: 3,
    uptime_pct: 99.4,
    operating_temp_c: 45,
    environmental_exposure: 0.4,
    weather_intensity: 0.3,
    exposure_factor: 0.35,
  },
]
