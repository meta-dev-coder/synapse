"""
N8N Workflow Deployment Script
===============================
Creates (or updates) the 5 Scenario Lab simulation workflows on the N8N instance.

Usage:
    N8N_API_KEY=<your-key> python3 deploy_workflows.py

Environment variables:
    N8N_API_KEY   — N8N API key (required)
    N8N_BASE_URL  — N8N instance base URL (default: https://sdna.app.n8n.cloud)
    PYTHON_BACKEND_URL — EC2 backend URL (default: http://54.89.6.51:8999)
"""

import json
import os
import sys
import uuid
import urllib.request
import urllib.error

N8N_BASE_URL = os.environ.get("N8N_BASE_URL", "https://sdna.app.n8n.cloud")
PYTHON_BACKEND_URL = os.environ.get("PYTHON_BACKEND_URL", "http://54.89.6.51:8999")
N8N_API_KEY = os.environ.get("N8N_API_KEY", "")

if not N8N_API_KEY:
    print("ERROR: N8N_API_KEY environment variable is not set.")
    sys.exit(1)


def n8n_request(method: str, path: str, body=None) -> dict:
    url = f"{N8N_BASE_URL}/api/v1{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "X-N8N-API-KEY": N8N_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        print(f"  HTTP {e.code} on {method} {url}: {body_text[:300]}")
        raise


def build_workflow(scenario: str, python_url: str) -> dict:
    """Build a 3-node N8N workflow definition for a single scenario."""
    return {
        "name": f"synapse-simulate-{scenario}",
        "nodes": [
            {
                "id": f"webhook-{scenario}",
                "name": "Webhook",
                "type": "n8n-nodes-base.webhook",
                "typeVersion": 1,
                "webhookId": str(uuid.uuid4()),
                "position": [250, 300],
                "parameters": {
                    "httpMethod": "POST",
                    "path": f"simulate-{scenario}",
                    "responseMode": "lastNode",
                    "options": {},
                },
            },
            {
                "id": f"http-{scenario}",
                "name": "Call Python Backend",
                "type": "n8n-nodes-base.httpRequest",
                "typeVersion": 4,
                "position": [470, 300],
                "parameters": {
                    "method": "POST",
                    "url": f"{python_url}/api/v1/simulate/{scenario}",
                    "sendBody": True,
                    "specifyBody": "json",
                    "jsonBody": "={{ $json.body }}",
                    "options": {
                        "timeout": 90000,
                        "response": {
                            "response": {
                                "fullResponse": False,
                            }
                        },
                    },
                },
            },
            {
                "id": f"respond-{scenario}",
                "name": "Respond to Webhook",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1,
                "position": [690, 300],
                "parameters": {
                    "options": {},
                },
            },
        ],
        "connections": {
            "Webhook": {
                "main": [[{"node": "Call Python Backend", "type": "main", "index": 0}]]
            },
            "Call Python Backend": {
                "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
            },
        },
        "settings": {
            "executionOrder": "v1",
        },
    }


SCENARIOS = ["toll", "corridor", "emission", "evasion", "comparison"]


def get_existing_workflows() -> dict[str, str]:
    """Return {name: id} for all existing workflows."""
    data = n8n_request("GET", "/workflows?limit=100")
    return {w["name"]: w["id"] for w in data.get("data", [])}


def deploy():
    print(f"Connecting to N8N at {N8N_BASE_URL} ...")
    existing = get_existing_workflows()
    print(f"Found {len(existing)} existing workflows.")

    for scenario in SCENARIOS:
        wf_name = f"synapse-simulate-{scenario}"
        wf_def = build_workflow(scenario, PYTHON_BACKEND_URL)

        if wf_name in existing:
            wf_id = existing[wf_name]
            print(f"  Updating  {wf_name} (id={wf_id}) ...", end=" ")
            n8n_request("PUT", f"/workflows/{wf_id}", wf_def)
        else:
            print(f"  Creating  {wf_name} ...", end=" ")
            result = n8n_request("POST", "/workflows", wf_def)
            wf_id = result["id"]

        # Activate the workflow
        try:
            n8n_request("POST", f"/workflows/{wf_id}/activate")
            print(f"active  ->  {N8N_BASE_URL}/webhook/simulate-{scenario}")
        except Exception:
            print(f"WARNING: Could not activate {wf_name}. Activate manually in the N8N UI.")

    print("\nDone. Webhook URLs:")
    for scenario in SCENARIOS:
        print(f"  POST {N8N_BASE_URL}/webhook/simulate-{scenario}")


if __name__ == "__main__":
    deploy()
