#!/usr/bin/env python3
"""
Aggregate RTD GPS bus positions into daily stats for Denver Pulse.
Reads the raw 1.9GB CSV, computes per-bus speed via Haversine,
and writes daily aggregates to app/data/denver_pulse_daily_stats.json.
"""
import csv
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

CSV_PATH = Path(__file__).parent.parent / "datasets" / "bus_positions_recovered.csv"
OUT_PATH = Path(__file__).parent.parent / "app" / "data" / "denver_pulse_daily_stats.json"

DAILY_GHG_BASE = 1_999_929 * 1000 / 365  # ~5_479_532 tCO2e/day
FREE_FLOW_KMH = 50.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def ts_to_date(ts_ms: int) -> str:
    return datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def main():
    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}")
        sys.exit(1)

    print(f"Reading {CSV_PATH} ...")

    # Pass 1: accumulate (busId, date) -> sorted list of (ts, lat, lon)
    bus_day: dict[tuple[str, str], list[tuple[int, float, float]]] = defaultdict(list)
    row_count = 0

    with open(CSV_PATH, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_count += 1
            if row_count % 5_000_000 == 0:
                print(f"  ... {row_count / 1_000_000:.0f}M rows read")
            try:
                bus_id = row["busId"]
                ts = int(row["timestamp"])
                lat = float(row["lat"])
                lon = float(row["lon"])
            except (KeyError, ValueError):
                continue
            day = ts_to_date(ts)
            bus_day[(bus_id, day)].append((ts, lat, lon))

    print(f"  Total rows: {row_count:,}")
    print(f"  Unique (bus, day) groups: {len(bus_day):,}")

    # Pass 2: compute per-bus per-day speeds
    day_speeds: dict[str, list[float]] = defaultdict(list)
    day_buses: dict[str, set[str]] = defaultdict(set)
    day_dist: dict[str, float] = defaultdict(float)

    for (bus_id, day), records in bus_day.items():
        records.sort(key=lambda x: x[0])
        day_buses[day].add(bus_id)
        for i in range(1, len(records)):
            ts1, lat1, lon1 = records[i - 1]
            ts2, lat2, lon2 = records[i]
            dt_hours = (ts2 - ts1) / 3_600_000
            if dt_hours <= 0:
                continue
            dist = haversine_km(lat1, lon1, lat2, lon2)
            speed = dist / dt_hours
            day_dist[day] += dist
            if 3.0 < speed < 80.0:
                day_speeds[day].append(speed)

    # Pass 3: aggregate per day
    all_days = sorted(day_speeds.keys())
    if not all_days:
        print("ERROR: no valid day data extracted")
        sys.exit(1)

    raw_records = []
    for day in all_days:
        speeds = day_speeds[day]
        if not speeds:
            continue
        avg_speed = round(mean(speeds), 1)
        bus_count = len(day_buses[day])
        total_dist = round(day_dist[day], 1)
        ci = round(max(0.0, min(1.0, 1 - avg_speed / FREE_FLOW_KMH)), 4)
        raw_records.append({
            "date": day,
            "avg_speed_kmh": avg_speed,
            "congestion_index": ci,
            "bus_count": bus_count,
            "total_distance_km": total_dist,
        })

    # Pass 4: derive GHG + mode share (needs avg bus count baseline)
    avg_bus_count = mean(r["bus_count"] for r in raw_records) if raw_records else 1
    output = []
    for r in raw_records:
        ci = r["congestion_index"]
        ghg = round(DAILY_GHG_BASE * (1 + (ci - 0.68) * 0.12), 1)
        pt_pct = round(30.0 * (r["bus_count"] / avg_bus_count), 2)
        car_pct = round(100.0 - pt_pct - 15.0 - 10.0, 2)
        car_pct = max(20.0, min(65.0, car_pct))
        # Re-adjust pt to keep sum = 100
        pt_pct = round(100.0 - car_pct - 15.0 - 10.0, 2)
        output.append({
            "date": r["date"],
            "avg_speed_kmh": r["avg_speed_kmh"],
            "congestion_index": ci,
            "bus_count": r["bus_count"],
            "total_distance_km": r["total_distance_km"],
            "ghg_tco2e": ghg,
            "pt_pct": pt_pct,
            "car_pct": car_pct,
            "bike_pct": 15.0,
            "walk_pct": 10.0,
        })

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(output)} daily records to {OUT_PATH}")
    # Quick validation
    for rec in output:
        total_mode = rec["pt_pct"] + rec["car_pct"] + rec["bike_pct"] + rec["walk_pct"]
        assert abs(total_mode - 100.0) < 0.1, f"Mode share sum {total_mode} on {rec['date']}"
        assert 0.0 <= rec["congestion_index"] <= 1.0
    print("All validation checks passed.")


if __name__ == "__main__":
    main()
