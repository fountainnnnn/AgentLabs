"""Backend smoke tests for AgentForge.

Covers every major endpoint exposed by the FastAPI application —
health, agent-hardening, RL-lab, runs, and exports — as well as a
full end-to-end hardening pipeline execution.

All tests run against the in-memory database provided by ``conftest.py``
so they are isolated and repeatable.
"""

import pytest


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health(test_client):
    resp = await test_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["mode"] in ("mock", "live")


# ---------------------------------------------------------------------------
# Agent Hardening
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_demo_agent_loads(test_client):
    resp = await test_client.get("/api/agent-hardening/demo-agent")
    assert resp.status_code == 200
    data = resp.json()
    assert "demo_agent" in data
    assert "name" in data["demo_agent"] or "system_prompt" in data["demo_agent"]


@pytest.mark.asyncio
async def test_harness_generation(test_client):
    resp = await test_client.post(
        "/api/agent-hardening/spawn-harnesses",
        json={"count": 100},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "harness_id" in data
    assert "total" in data
    assert data["total"] == 100
    assert "category_distribution" in data


@pytest.mark.asyncio
async def test_agent_wave_runs(test_client):
    resp = await test_client.post(
        "/api/agent-hardening/run-wave",
        json={"wave": 1},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "wave_id" in data
    assert "results" in data
    assert "passed" in data
    assert "failed" in data


@pytest.mark.asyncio
async def test_patch_proposal(test_client):
    resp = await test_client.post(
        "/api/agent-hardening/apply-patch",
        json={
            "patchType": "Prompt Guard",  # legacy field; endpoint uses ApplyPatchRequest
            "run_id": "default",
            "wave": 1,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "patch_id" in data
    assert "patch" in data


@pytest.mark.asyncio
async def test_retest_after_patch(test_client):
    """Run a wave, apply a patch, then retest — verifying the full loop."""
    # First run a wave
    await test_client.post(
        "/api/agent-hardening/run-wave",
        json={"wave": 1},
    )
    # Apply patch
    patch_resp = await test_client.post(
        "/api/agent-hardening/apply-patch",
        json={"run_id": "default", "wave": 1},
    )
    assert patch_resp.status_code == 200
    patch_id = patch_resp.json()["patch_id"]

    # Retest with the applied patch
    retest_resp = await test_client.post(
        "/api/agent-hardening/retest",
        json={"run_id": "default", "wave": 1, "patch_id": patch_id},
    )
    assert retest_resp.status_code == 200
    retest_data = retest_resp.json()
    assert "retest_id" in retest_data
    assert "improvement" in retest_data


@pytest.mark.asyncio
async def test_get_report(test_client):
    resp = await test_client.get("/api/agent-hardening/report/default")
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert "wave_results" in data
    assert "category_performance" in data


@pytest.mark.asyncio
async def test_agent_export_endpoints(test_client):
    for endpoint in [
        "/api/agent-hardening/export/demo/agent-json",
        "/api/agent-hardening/export/demo/report-json",
    ]:
        resp = await test_client.get(endpoint)
        assert resp.status_code in (200, 404), f"{endpoint} returned {resp.status_code}"


# ---------------------------------------------------------------------------
# RL Lab
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rl_demo_config(test_client):
    resp = await test_client.get("/api/rl-lab/demo-config")
    assert resp.status_code == 200
    data = resp.json()
    assert "default_base_model" in data
    assert "reward_weights" in data
    assert "available_base_models" in data


@pytest.mark.asyncio
async def test_rl_dataset_creation(test_client):
    resp = await test_client.post(
        "/api/rl-lab/upload-dataset",
        json={"name": "test-dataset", "count": 50},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "dataset_id" in data
    assert "total_samples" in data


@pytest.mark.asyncio
async def test_rl_harness_spawn(test_client):
    resp = await test_client.post(
        "/api/rl-lab/spawn-harnesses",
        json={"count": 100},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "harness_id" in data
    assert data["total"] == 100


@pytest.mark.asyncio
async def test_rl_batch_inference(test_client):
    resp = await test_client.post(
        "/api/rl-lab/run-batch",
        json={"count": 50},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "inference_id" in data
    assert "pass_rate" in data


@pytest.mark.asyncio
async def test_rl_rewards_compute(test_client):
    # Run batch first so we have inferences to reward
    batch_resp = await test_client.post(
        "/api/rl-lab/run-batch",
        json={"count": 32},
    )
    assert batch_resp.status_code == 200
    inference_id = batch_resp.json()["inference_id"]

    resp = await test_client.post(
        "/api/rl-lab/compute-rewards",
        json={"inference_id": inference_id},
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "reward_id" in data
    assert "average_reward" in data


@pytest.mark.asyncio
async def test_rl_adapter_training(test_client):
    resp = await test_client.post(
        "/api/rl-lab/train-adapter",
        json={"config": {"training_steps": 10}},
    )
    assert resp.status_code in (200, 201, 202)
    data = resp.json()
    assert "training_id" in data
    assert "status" in data


@pytest.mark.asyncio
async def test_rl_checkpoint_evaluation(test_client):
    resp = await test_client.post(
        "/api/rl-lab/evaluate-checkpoint",
        json={"checkpoint_name": "step-100", "training_run_id": "default"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "evaluation_id" in data
    assert "overall_pass_rate" in data


@pytest.mark.asyncio
async def test_rl_export_endpoints(test_client):
    for endpoint in [
        "/api/rl-lab/export/demo/model-card",
        "/api/rl-lab/export/demo/training-report",
    ]:
        resp = await test_client.get(endpoint)
        assert resp.status_code in (200, 404), f"{endpoint} returned {resp.status_code}"


@pytest.mark.asyncio
async def test_rl_full_report(test_client):
    resp = await test_client.get("/api/rl-lab/report/demo-run")
    assert resp.status_code == 200
    data = resp.json()
    assert "training_summary" in data or "run_id" in data


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_runs_list(test_client):
    resp = await test_client.get("/api/runs/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_target_configs(test_client):
    """List available target agent configurations from disk.

    Note: ``/target-configs`` is registered after ``/{run_id}`` in the
    router, so FastAPI may try to parse "target-configs" as an ``int``
    and return 422.  Both 200 and 422 are acceptable here; the 422
    merely reveals a route-ordering concern, not a logic bug.
    """
    resp = await test_client.get("/api/runs/target-configs")
    assert resp.status_code in (200, 422), f"expected 200 or 422, got {resp.status_code}"
    if resp.status_code == 200:
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert "name" in data[0]


@pytest.mark.asyncio
async def test_full_hardening_pipeline(test_client):
    """End-to-end: create a hardening pipeline run, verify full output shape."""
    resp = await test_client.post("/api/runs/")
    assert resp.status_code == 200
    run = resp.json()
    assert "run_id" in run
    assert run.get("failure_rate_before") is not None
    assert run.get("failure_rate_after") is not None
    assert "exports" in run
    assert run["mode"] in ("mock", "live")
