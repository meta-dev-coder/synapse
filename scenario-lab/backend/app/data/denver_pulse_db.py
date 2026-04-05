"""
SQLite persistence for Denver Pulse saved scenarios.
DB file: scenario-lab/backend/scenarios.db (shared with Denver scenarios).
Table: denver_pulse_scenarios
"""
import json
import re
import sqlite3
from pathlib import Path
from typing import Optional

_DB_PATH = Path(__file__).parent.parent.parent / "scenarios.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS denver_pulse_scenarios (
            id               TEXT PRIMARY KEY,
            short_id         TEXT NOT NULL,
            name             TEXT NOT NULL,
            created_at       TEXT NOT NULL,
            scope            TEXT NOT NULL,
            horizon          TEXT NOT NULL,
            policies         TEXT NOT NULL,
            sliders          TEXT NOT NULL,
            simulate_result  TEXT NOT NULL,
            confidence_score REAL NOT NULL,
            assigned_to      TEXT
        )
    """)
    # Migration: add assigned_to to existing tables that predate this column
    existing = {row[1] for row in conn.execute("PRAGMA table_info(denver_pulse_scenarios)")}
    if "assigned_to" not in existing:
        conn.execute("ALTER TABLE denver_pulse_scenarios ADD COLUMN assigned_to TEXT")
    conn.commit()
    conn.close()


def next_short_id() -> str:
    conn = get_conn()
    row = conn.execute(
        "SELECT MAX(short_id) AS max_id FROM denver_pulse_scenarios"
    ).fetchone()
    conn.close()
    max_id = row["max_id"] if row else None
    if max_id is None:
        return "DP-001"
    m = re.search(r"(\d+)$", max_id)
    if m:
        return f"DP-{int(m.group(1)) + 1:03d}"
    return "DP-001"


def save_scenario(
    id: str,
    short_id: str,
    name: str,
    created_at: str,
    scope: str,
    horizon: str,
    policies: list,
    sliders: dict,
    simulate_result: dict,
    confidence_score: float,
) -> None:
    conn = get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO denver_pulse_scenarios
           (id, short_id, name, created_at, scope, horizon, policies, sliders, simulate_result, confidence_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            id, short_id, name, created_at, scope, horizon,
            json.dumps(policies), json.dumps(sliders),
            json.dumps(simulate_result), confidence_score,
        ),
    )
    conn.commit()
    conn.close()


def list_scenarios() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM denver_pulse_scenarios ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]


def get_scenario(id: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM denver_pulse_scenarios WHERE id = ?", (id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return _row_to_dict(row)


def delete_scenario(id: str) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM denver_pulse_scenarios WHERE id = ?", (id,))
    conn.commit()
    conn.close()


def assign_scenario(id: str, agency: str) -> None:
    conn = get_conn()
    conn.execute(
        "UPDATE denver_pulse_scenarios SET assigned_to = ? WHERE id = ?",
        (agency, id),
    )
    conn.commit()
    conn.close()


def _row_to_dict(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "short_id": r["short_id"],
        "name": r["name"],
        "created_at": r["created_at"],
        "scope": r["scope"],
        "horizon": r["horizon"],
        "policies": json.loads(r["policies"]),
        "sliders": json.loads(r["sliders"]),
        "simulate_result": json.loads(r["simulate_result"]),
        "confidence_score": r["confidence_score"],
        "assigned_to": r["assigned_to"],
    }
