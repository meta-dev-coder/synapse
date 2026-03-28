"""
Denver 2024 GHG Inventory baseline constants.
Source: DATASETS.md § Denver 2024 GHG Inventory
All values are annual unless otherwise noted.
"""

# --- On-road vehicle fleet (CDOR 2024) ---
FLEET_SIZE = 574_707
FLEET_GASOLINE_PCT = 82.4
FLEET_BEV_PCT = 3.6
FLEET_PHEV_PCT = 1.8
FLEET_DIESEL_PCT = 2.3
AVG_FLEET_MPG = 28.0

# --- Annual emissions (metric tons CO2e) ---
TOTAL_ONROAD_CO2E_MT = 1_999_929       # on-road combustion + EV electricity
TOTAL_TRANSPORT_CO2E_MT = 3_230_559    # all transport modes (road + aviation + rail)
TRANSIT_CO2E_MT = 36_104               # buses + light rail combined
SCOPE2_EV_CO2E_MT = 60_061             # electricity for EVs (Xcel Energy grid)

# --- Annual VMT (miles) ---
ANNUAL_VMT_MILES = 4_090_000_000       # all vehicle classes combined
BUS_ANNUAL_MILES = 21_000_000          # RTD bus fleet total

# --- Emission factors ---
CO2_FACTOR_GAS_MT_PER_GAL = 0.00878   # gasoline combustion
CO2_FACTOR_DIESEL_MT_PER_GAL = 0.01021
EV_GRID_EF_MT_PER_MWH = 0.388         # Xcel Energy Colorado 2024
EV_EFFICIENCY_KWH_PER_MILE_BEV = 0.32  # average BEV consumption
EV_EFFICIENCY_KWH_PER_MILE_PHEV = 0.70

# --- Demo baseline KPIs ---
MODE_SPLIT = {"car": 70.0, "transit": 20.0, "ev_bike": 10.0}  # % of trips

# --- Net Zero targets ---
NET_ZERO_TARGET_MT = 5_000_000         # Denver 2025 interim target (all scopes)
ACTUAL_TOTAL_CO2E_MT = 6_954_394       # 2024 actual all scopes
NET_ZERO_GAP_MT = ACTUAL_TOTAL_CO2E_MT - NET_ZERO_TARGET_MT   # 1,954,394
TRANSPORT_SHARE_PCT = 36.0             # transport as % of total city emissions
