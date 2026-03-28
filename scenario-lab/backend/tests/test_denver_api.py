"""
Integration tests for the Denver Traffic API.
Run with: cd scenario-lab/backend && python -m pytest tests/test_denver_api.py -v
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

BASE = "/api/v1/denver"


# ---------------------------------------------------------------------------
# 1. Baseline values
# ---------------------------------------------------------------------------

def test_baseline_returns_correct_values():
    resp = client.get(f"{BASE}/baseline")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_onroad_co2e_mt"] == 1_999_929
    assert data["fleet_bev_pct"] == 3.6
    assert data["congestion_index"] == 0.68
    assert data["avg_bus_delay_min"] == 4.2


# ---------------------------------------------------------------------------
# 2. Scenario – all-zero inputs yield zero reduction
# ---------------------------------------------------------------------------

def test_scenario_zero_inputs_returns_zero_reduction():
    payload = {
        "ev_adoption_pct": 0,
        "mode_shift_pct": 0,
        "bus_efficiency_pct": 0,
        "bike_lanes": False,
    }
    resp = client.post(f"{BASE}/scenario/run", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["co2_reduction_mt"] == 0
    assert data["co2_reduction_pct"] == 0


# ---------------------------------------------------------------------------
# 3. Scenario – max inputs yield a large reduction
# ---------------------------------------------------------------------------

def test_scenario_max_inputs_returns_large_reduction():
    payload = {
        "ev_adoption_pct": 30,
        "mode_shift_pct": 15,
        "bus_efficiency_pct": 20,
        "bike_lanes": True,
    }
    resp = client.post(f"{BASE}/scenario/run", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["co2_reduction_pct"] > 5


# ---------------------------------------------------------------------------
# 4. Save, list, and delete a scenario
# ---------------------------------------------------------------------------

def test_save_and_list_scenarios():
    # Run the scenario first to get real results
    run_payload = {
        "ev_adoption_pct": 10,
        "mode_shift_pct": 5,
        "bus_efficiency_pct": 10,
        "bike_lanes": False,
    }
    run_resp = client.post(f"{BASE}/scenario/run", json=run_payload)
    assert run_resp.status_code == 200
    results = run_resp.json()

    # Save the scenario
    save_payload = {
        "name": "Test Scenario",
        "inputs": run_payload,
        "results": results,
    }
    save_resp = client.post(f"{BASE}/scenarios", json=save_payload)
    assert save_resp.status_code == 200
    saved = save_resp.json()
    scenario_id = saved["id"]
    assert saved["name"] == "Test Scenario"

    try:
        # List and confirm it's present
        list_resp = client.get(f"{BASE}/scenarios")
        assert list_resp.status_code == 200
        ids = [s["id"] for s in list_resp.json()]
        assert scenario_id in ids
    finally:
        # Delete it
        del_resp = client.delete(f"{BASE}/scenarios/{scenario_id}")
        assert del_resp.status_code == 200
        assert del_resp.json() == {"ok": True}


# ---------------------------------------------------------------------------
# 5. Compare two scenarios
# ---------------------------------------------------------------------------

def test_compare_returns_winner():
    # Save scenario A (low intervention)
    run_a = client.post(f"{BASE}/scenario/run", json={
        "ev_adoption_pct": 5,
        "mode_shift_pct": 2,
        "bus_efficiency_pct": 5,
        "bike_lanes": False,
    })
    assert run_a.status_code == 200

    # Save scenario B (high intervention)
    run_b = client.post(f"{BASE}/scenario/run", json={
        "ev_adoption_pct": 20,
        "mode_shift_pct": 10,
        "bus_efficiency_pct": 15,
        "bike_lanes": True,
    })
    assert run_b.status_code == 200

    save_a = client.post(f"{BASE}/scenarios", json={
        "name": "Compare A",
        "inputs": {"ev_adoption_pct": 5, "mode_shift_pct": 2, "bus_efficiency_pct": 5, "bike_lanes": False},
        "results": run_a.json(),
    })
    assert save_a.status_code == 200
    id_a = save_a.json()["id"]

    save_b = client.post(f"{BASE}/scenarios", json={
        "name": "Compare B",
        "inputs": {"ev_adoption_pct": 20, "mode_shift_pct": 10, "bus_efficiency_pct": 15, "bike_lanes": True},
        "results": run_b.json(),
    })
    assert save_b.status_code == 200
    id_b = save_b.json()["id"]

    try:
        compare_resp = client.post(f"{BASE}/compare", json={
            "scenario_a_id": id_a,
            "scenario_b_id": id_b,
        })
        assert compare_resp.status_code == 200
        data = compare_resp.json()
        assert data["winner"] in ("A", "B", "tie")
        assert isinstance(data["insights"], list)
    finally:
        client.delete(f"{BASE}/scenarios/{id_a}")
        client.delete(f"{BASE}/scenarios/{id_b}")


# ---------------------------------------------------------------------------
# 6. GPS positions – 100 frames, at least 5 buses per frame
# ---------------------------------------------------------------------------

def test_gps_positions_returns_100_frames():
    resp = client.get(f"{BASE}/gps/positions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["frame_count"] == 100
    assert len(data["frames"][0]["buses"]) > 5
