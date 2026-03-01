"""
Baseline in-memory data constants for the Scenario Lab toll corridor simulation.
Four lanes: L1 (HOV_EXPRESS), L2 (ETC), L3 (ETC), L4 (CASH)
"""

BASELINE_LANES = {
    "L1": {
        "volume_veh_hr": 1020,
        "capacity_veh_hr": 1800,
        "free_flow_travel_time_sec": 90,
        "evasion_rate_pct": 1.2,
        "revenue_usd_hr": 2550,
        "vehicle_volumes": {"car": 612, "truck": 0, "bus": 0, "van": 408},
        "toll_rates_usd": {"car": 2.50, "truck": 0.00, "bus": 0.00, "van": 2.50},
        "ev_fraction_pct": 18,
        "speed_kmh": 88,
    },
    "L2": {
        "volume_veh_hr": 1340,
        "capacity_veh_hr": 1800,
        "free_flow_travel_time_sec": 112,
        "evasion_rate_pct": 3.8,
        "revenue_usd_hr": 5320,
        "vehicle_volumes": {"car": 737, "truck": 335, "bus": 107, "van": 161},
        "toll_rates_usd": {"car": 3.00, "truck": 7.50, "bus": 6.00, "van": 4.00},
        "ev_fraction_pct": 12,
        "speed_kmh": 72,
    },
    "L3": {
        "volume_veh_hr": 1280,
        "capacity_veh_hr": 1800,
        "free_flow_travel_time_sec": 112,
        "evasion_rate_pct": 4.1,
        "revenue_usd_hr": 4960,
        "vehicle_volumes": {"car": 742, "truck": 282, "bus": 115, "van": 141},
        "toll_rates_usd": {"car": 3.00, "truck": 7.50, "bus": 6.00, "van": 4.00},
        "ev_fraction_pct": 10,
        "speed_kmh": 74,
    },
    "L4": {
        "volume_veh_hr": 560,
        "capacity_veh_hr": 800,
        "free_flow_travel_time_sec": 300,
        "evasion_rate_pct": 18.5,
        "revenue_usd_hr": 1990,
        "vehicle_volumes": {"car": 392, "truck": 56, "bus": 28, "van": 84},
        "toll_rates_usd": {"car": 3.50, "truck": 9.00, "bus": 7.00, "van": 5.00},
        "ev_fraction_pct": 3,
        "speed_kmh": 22,
    },
}

BASELINE_TOTALS = {
    "total_volume_veh_hr": 4200,
    "total_revenue_usd_hr": 14820,
    "total_evasion_rate_pct": 7.2,
    "total_CO2_kg_hr": 1842,
    "total_NOx_g_hr": 9240,
    "avg_toll_rate_usd": 3.10,
    "patrol_frequency_normalized": 0.35,
    "detection_accuracy": 0.72,
    "weather_factor": 1.0,
}

# Demand elasticity: % change in volume per % change in toll rate
VEHICLE_ELASTICITY = {"car": -0.45, "truck": -0.20, "bus": -0.10, "van": -0.35}

# CO2 emission factors in grams per vehicle per km
CO2_FACTORS_G_PER_VEH_KM = {"car": 180, "truck": 820, "bus": 650, "van": 300}

# Idle CO2 emissions in grams per vehicle per minute
IDLE_CO2_G_PER_MIN = {"car": 5, "truck": 30, "bus": 25, "van": 10}

# NOx emission factors in milligrams per vehicle per km
NOX_MG_PER_VEH_KM = {"car": 150, "truck": 1200, "bus": 900, "van": 400}

# Speed at which emission factors are calibrated (lowest emission point)
SPEED_OPTIMAL_KMH = {"car": 80, "truck": 75, "bus": 70, "van": 80}

# Evasion elasticity: sensitivity of evasion rate to toll increases
EVASION_ELASTICITY = {"car": 0.35, "truck": 0.15, "bus": 0.08, "van": 0.28}

# Physical corridor length used for emission calculations
CORRIDOR_LENGTH_KM = 2.5
