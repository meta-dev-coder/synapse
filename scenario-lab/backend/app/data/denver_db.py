"""
SQLite persistence for saved Denver scenarios.
DB file: scenario-lab/backend/scenarios.db (auto-created on first use).
"""
import json
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
        CREATE TABLE IF NOT EXISTS scenarios (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            inputs      TEXT NOT NULL,
            results     TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def save_scenario(id: str, name: str, inputs: dict, results: dict) -> None:
    from datetime import datetime, timezone
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO scenarios (id, name, created_at, inputs, results) VALUES (?, ?, ?, ?, ?)",
        (id, name, datetime.now(timezone.utc).isoformat(), json.dumps(inputs), json.dumps(results)),
    )
    conn.commit()
    conn.close()


def list_scenarios() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, created_at, inputs, results FROM scenarios ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "created_at": r["created_at"],
            "inputs": json.loads(r["inputs"]),
            "results": json.loads(r["results"]),
        }
        for r in rows
    ]


def get_scenario(id: str) -> Optional[dict]:
    conn = get_conn()
    row = conn.execute(
        "SELECT id, name, created_at, inputs, results FROM scenarios WHERE id = ?", (id,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "created_at": row["created_at"],
        "inputs": json.loads(row["inputs"]),
        "results": json.loads(row["results"]),
    }


def delete_scenario(id: str) -> None:
    conn = get_conn()
    conn.execute("DELETE FROM scenarios WHERE id = ?", (id,))
    conn.commit()
    conn.close()
