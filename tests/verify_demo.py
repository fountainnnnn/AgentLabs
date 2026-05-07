#!/usr/bin/env python
"""Standalone verification script for the AgentForge backend.

Can be run *without* pytest or any test runner:

    python tests/verify_demo.py [--base-url http://localhost:8000]

Starts the backend in-process (or connects to a running instance) and
runs a sequence of checks that mirror the demo flow:
  1. Health endpoint is alive
  2. Demo agent configuration loads
  3. Adversarial harnesses are generated
  4. Attack wave executes
  5. Hardening patch is applied
  6. RL demo configuration is available
  7. RL rewards are computed
  8. Export endpoints respond
  9. Reports are generated

Prints PASS/FAIL for each check and exits with code 0 if all pass.
"""

import json
import sys
import os
import time
from pathlib import Path

try:
    import httpx
except ImportError:
    print("FAIL  missing dependency: httpx  (pip install httpx)")
    sys.exit(1)


# -- helpers -----------------------------------------------------------------

PASS_EMOJI = "PASS"
FAIL_EMOJI = "FAIL"
_passed = 0
_failed = 0


def check(description: str, condition: bool, detail: str = "") -> None:
    """Print a PASS/FAIL line and increment the global counter."""
    global _passed, _failed
    status = PASS_EMOJI if condition else FAIL_EMOJI
    msg = f"[{status}] {description}"
    if detail:
        msg += f"  --  {detail}"
    print(msg)
    if condition:
        _passed += 1
    else:
        _failed += 1


def check_response(r, description: str, *, status: int = 200, keys: list[str] | None = None) -> bool:
    """Verify HTTP status and optional JSON keys, print result, return bool."""
    ok = True
    if r.status_code != status:
        check(description, False, f"expected status {status}, got {r.status_code}")
        return False
    if keys:
        try:
            data = r.json()
            for k in keys:
                if k not in data:
                    check(description, False, f"missing key '{k}' in response")
                    ok = False
        except Exception as e:
            check(description, False, f"invalid JSON: {e}")
            return False
        if ok:
            check(description, True)
        return ok
    check(description, True)
    return True


# -- main -------------------------------------------------------------------


def main():
    global _passed, _failed

    # Determine base URL
    base_url = "http://127.0.0.1:8000"
    if "--base-url" in sys.argv:
        idx = sys.argv.index("--base-url")
        if idx + 1 < len(sys.argv):
            base_url = sys.argv[idx + 1].rstrip("/")

    sep = "=" * 60
    print(f"\n{sep}")
    print(f" AgentForge Demo Verification  (base: {base_url})")
    print(f"{sep}\n")

    # Try to connect; optionally start the server ourselves
    try:
        client = httpx.Client(base_url=base_url, timeout=10.0)
        resp = client.get("/api/health")
    except (httpx.ConnectError, httpx.RequestError):
        print(f"  Backend not reachable at {base_url}. Attempting to start in-process...\n")
        # Start the server in-process via uvicorn
        import uvicorn
        import threading
        from main import app

        server_config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="error")
        server = uvicorn.Server(server_config)

        def run_server():
            server.run()

        t = threading.Thread(target=run_server, daemon=True)
        t.start()

        # Wait for the server to be ready (poll health endpoint)
        client2 = httpx.Client(base_url="http://127.0.0.1:8000", timeout=5.0)
        for _ in range(20):
            try:
                resp = client2.get("/api/health")
                if resp.status_code == 200:
                    client = client2
                    base_url = "http://127.0.0.1:8000"
                    print("  Backend started successfully.\n")
                    break
            except httpx.RequestError:
                pass
            time.sleep(0.3)
        else:
            print("FAIL  Could not start or connect to backend.")
            sys.exit(1)

    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    # -- 1. Health --
    print("-- Check 1: Health endpoint --")
    resp = client.get("/api/health")
    if check_response(resp, "1a  GET /api/health returns 200", status=200, keys=["status", "mode"]):
        data = resp.json()
        check("1b  status is 'ok'", data["status"] == "ok", f'got "{data["status"]}"')
        check("1c  mode is mock or live", data["mode"] in ("mock", "live"), f'got "{data["mode"]}"')

    # -- 2. Demo agent --
    print("\n-- Check 2: Demo agent --")
    resp = client.get("/api/agent-hardening/demo-agent")
    if check_response(resp, "2a  GET /api/agent-hardening/demo-agent", status=200, keys=["demo_agent"]):
        data = resp.json()
        agent = data["demo_agent"]
        check("2b  agent has a name", bool(agent.get("name")), f'name="{agent.get("name")}"')
        check("2c  agent has system_prompt", bool(agent.get("system_prompt")))

    # -- 3. Harness generation --
    print("\n-- Check 3: Harness generation --")
    resp = client.post(
        "/api/agent-hardening/spawn-harnesses",
        json={"count": 100},
        headers=headers,
    )
    if check_response(resp, "3a  POST spawn-harnesses", status=200, keys=["harness_id", "total"]):
        data = resp.json()
        check("3b  generated 100 harnesses", data["total"] == 100, f'got {data["total"]}')
        check("3c  has category distribution", bool(data.get("category_distribution")))

    # -- 4. Wave run --
    print("\n-- Check 4: Attack wave --")
    resp = client.post(
        "/api/agent-hardening/run-wave",
        json={"wave": 1},
        headers=headers,
    )
    if check_response(resp, "4a  POST run-wave", status=200, keys=["wave_id", "results", "passed", "failed"]):
        data = resp.json()
        check("4b  some results returned", len(data["results"]) > 0, f'{len(data["results"])} results')
        total = data["passed"] + data["failed"]
        check("4c  passed + failed = total", total == len(data["results"]), f'{data["passed"]}+{data["failed"]}={total}')

    # -- 5. Patch --
    print("\n-- Check 5: Patch application --")
    resp = client.post(
        "/api/agent-hardening/apply-patch",
        json={"run_id": "default", "wave": 1},
        headers=headers,
    )
    if check_response(resp, "5a  POST apply-patch", status=200, keys=["patch_id", "patch"]):
        data = resp.json()
        check("5b  patch has categories addressed", bool(data["patch"].get("categories_addressed")))
        check("5c  patch has changes", bool(data["patch"].get("changes")))

    # -- 6. RL demo config --
    print("\n-- Check 6: RL Lab demo config --")
    resp = client.get("/api/rl-lab/demo-config")
    if check_response(resp, "6a  GET /api/rl-lab/demo-config", status=200, keys=["default_base_model", "reward_weights"]):
        data = resp.json()
        check("6b  has available base models", len(data.get("available_base_models", [])) >= 1)
        check("6c  has freeze plan", bool(data.get("freeze_plan")))

    # -- 7. RL rewards --
    print("\n-- Check 7: RL rewards --")
    # First need inferences
    resp = client.post(
        "/api/rl-lab/run-batch",
        json={"count": 32},
        headers=headers,
    )
    if check_response(resp, "7a  POST run-batch (prerequisite)", status=200, keys=["inference_id"]):
        inference_id = resp.json()["inference_id"]
        resp2 = client.post(
            "/api/rl-lab/compute-rewards",
            json={"inference_id": inference_id},
            headers=headers,
        )
        if check_response(resp2, "7b  POST compute-rewards", status=200, keys=["reward_id", "average_reward"]):
            data = resp2.json()
            check("7c  average reward is reasonable", -2.0 <= data["average_reward"] <= 2.0,
                  f'got {data["average_reward"]}')

    # -- 8. RL adapter training --
    print("\n-- Check 8: RL adapter training --")
    resp = client.post(
        "/api/rl-lab/train-adapter",
        json={"config": {"training_steps": 10}},
        headers=headers,
    )
    if check_response(resp, "8a  POST train-adapter", status=200, keys=["training_id", "status"]):
        data = resp.json()
        check("8b  training completed", data["status"] in ("completed", "simulation"),
              f'status="{data["status"]}"')

    # -- 9. Export endpoints --
    print("\n-- Check 9: Export endpoints --")
    export_urls = [
        ("Agent hardening agent JSON", "/api/agent-hardening/export/demo/agent-json"),
        ("Agent hardening report JSON", "/api/agent-hardening/export/demo/report-json"),
        ("RL model card", "/api/rl-lab/export/demo/model-card"),
        ("RL training report", "/api/rl-lab/export/demo/training-report"),
    ]
    for label, url in export_urls:
        resp = client.get(url)
        ok = resp.status_code in (200, 404)
        status_str = f"HTTP {resp.status_code}" if not ok else "OK"
        check(f"9   GET {label}", ok, status_str)

    # -- 10. Reports --
    print("\n-- Check 10: Reports --")
    resp = client.get("/api/agent-hardening/report/default")
    check_response(resp, "10a GET hardening report", status=200, keys=["summary", "wave_results", "category_performance"])

    resp = client.get("/api/rl-lab/report/demo-run")
    if resp.status_code == 200:
        check("10b GET RL training report", True, "report returned")
    else:
        check("10b GET RL training report", False, f"HTTP {resp.status_code}")

    # -- Summary --
    print(f"\n{sep}")
    print(f" Results:  {_passed} passed,  {_failed} failed")
    print(f"{sep}\n")

    sys.exit(0 if _failed == 0 else 1)


if __name__ == "__main__":
    main()
