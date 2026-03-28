"""
Preprocess raw bus GPS CSV into a 100-frame stratified sample JSON.

Pass 1: stream the CSV to collect all unique timestamps.
Pass 2: stream again to collect bus positions for selected timestamps.

CSV schema: busId, bearing, lat, lon, timestamp  (timestamp = Unix ms)
"""

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# CSV lives in datasets/ alongside the output; script is in scripts/
CSV_PATH = Path(__file__).parent.parent / "datasets" / "bus_positions_recovered.csv"
OUTPUT_PATH = Path(__file__).parent.parent / "datasets" / "bus_positions_sample.json"

CHUNK_SIZE = 100_000
RUSH_HOURS = {7, 8, 16, 17}
RUSH_TARGET = 40
OFFPEAK_TARGET = 60
TOTAL_TARGET = 100


def evenly_spaced(items: list, n: int) -> list:
    """Return n evenly-spaced items from a sorted list (inclusive endpoints)."""
    if len(items) <= n:
        return items[:]
    if n == 1:
        return [items[0]]
    step = (len(items) - 1) / (n - 1)
    return [items[round(i * step)] for i in range(n)]


def main() -> None:
    if not CSV_PATH.exists():
        print(f"ERROR: CSV not found at {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    # ------------------------------------------------------------------
    # Pass 1 — collect unique timestamps
    # ------------------------------------------------------------------
    print("Reading timestamps...")
    unique_ts: set[int] = set()

    with CSV_PATH.open(newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)  # skip header

        # Identify column indices defensively
        try:
            ts_col = header.index("timestamp")
        except ValueError:
            print(f"ERROR: 'timestamp' column not found. Header: {header}", file=sys.stderr)
            sys.exit(1)

        row_buf: list = []
        for row in reader:
            try:
                unique_ts.add(int(row[ts_col]))
            except (ValueError, IndexError):
                continue
            row_buf.append(None)  # just counting; no storage
            if len(row_buf) >= CHUNK_SIZE:
                row_buf.clear()

    all_ts = sorted(unique_ts)
    print(f"  Found {len(all_ts):,} unique timestamps across the file.")

    # ------------------------------------------------------------------
    # Stratified selection
    # ------------------------------------------------------------------
    rush_ts: list[int] = []
    offpeak_ts: list[int] = []

    for ts in all_ts:
        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        if dt.hour in RUSH_HOURS:
            rush_ts.append(ts)
        else:
            offpeak_ts.append(ts)

    n_rush = min(RUSH_TARGET, len(rush_ts))
    n_offpeak = min(OFFPEAK_TARGET, len(offpeak_ts))

    # Fill remainder into other bucket if one is short
    shortfall = TOTAL_TARGET - n_rush - n_offpeak
    if shortfall > 0:
        if len(rush_ts) < RUSH_TARGET and len(offpeak_ts) > n_offpeak:
            n_offpeak = min(len(offpeak_ts), n_offpeak + shortfall)
        elif len(offpeak_ts) < OFFPEAK_TARGET and len(rush_ts) > n_rush:
            n_rush = min(len(rush_ts), n_rush + shortfall)

    selected_rush = evenly_spaced(rush_ts, n_rush)
    selected_offpeak = evenly_spaced(offpeak_ts, n_offpeak)

    print(f"Selected {len(selected_rush)} rush-hour + {len(selected_offpeak)} off-peak frames")

    selected_set: set[int] = set(selected_rush) | set(selected_offpeak)

    # ------------------------------------------------------------------
    # Pass 2 — collect bus positions for selected timestamps
    # ------------------------------------------------------------------
    print("Collecting bus positions for selected frames...")

    # Identify all column indices
    with CSV_PATH.open(newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)

    try:
        bus_col = header.index("busId")
        bearing_col = header.index("bearing")
        lat_col = header.index("lat")
        lon_col = header.index("lon")
        ts_col = header.index("timestamp")
    except ValueError as exc:
        print(f"ERROR: missing column — {exc}", file=sys.stderr)
        sys.exit(1)

    frames_data: dict[int, list[dict]] = {ts: [] for ts in selected_set}

    with CSV_PATH.open(newline="") as fh:
        reader = csv.reader(fh)
        next(reader)  # skip header

        row_buf = []
        for row in reader:
            try:
                ts = int(row[ts_col])
            except (ValueError, IndexError):
                continue

            if ts in selected_set:
                try:
                    frames_data[ts].append({
                        "id": row[bus_col],
                        "lat": round(float(row[lat_col]), 6),
                        "lon": round(float(row[lon_col]), 6),
                        "bearing": int(float(row[bearing_col])),
                    })
                except (ValueError, IndexError):
                    continue

            row_buf.append(None)
            if len(row_buf) >= CHUNK_SIZE:
                row_buf.clear()

    # ------------------------------------------------------------------
    # Build output
    # ------------------------------------------------------------------
    print("Writing output...")

    frames = []
    for ts in sorted(selected_set):
        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        frames.append({
            "t": ts,
            "ts": dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "buses": frames_data[ts],
        })

    output = {
        "frame_count": len(frames),
        "frames": frames,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w") as out:
        json.dump(output, out, separators=(",", ":"))

    print(f"Done. Wrote {len(frames)} frames to {OUTPUT_PATH}")
    print(f"  Sample: frame 0 has {len(frames[0]['buses'])} buses at t={frames[0]['t']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
