"""Real LoRA path. Runs only when torch/transformers/peft are installed and
AGENTLABS_TEST_MODEL_PATH points at a small local Hugging Face model (e.g. sshleifer/tiny-gpt2)."""

import os

import pytest

from lora_lab import capabilities

MODEL_PATH = os.environ.get("AGENTLABS_TEST_MODEL_PATH", "")
pytestmark = [
    pytest.mark.real_ml,
    pytest.mark.skipif(not (capabilities.deps_ready() and MODEL_PATH and capabilities.is_model_dir(__import__("pathlib").Path(MODEL_PATH))),
                       reason="needs torch/transformers/peft and AGENTLABS_TEST_MODEL_PATH"),
]


async def test_real_training_and_eval(client):
    models = (await client.get("/api/lora/models")).json()["models"]
    local = next(m for m in models if m["source"] == "local_path" and m["available"])
    assert local["truth_mode"] == "real_local_model"
    ds = (await client.post("/api/lora/datasets/demo")).json()
    target = {"type": "local", "model_id": local["id"]}
    base = (await client.post("/api/lora/evaluations", json={"dataset_id": ds["id"], "target": target, "max_cases": 6})).json()
    train = (await client.post("/api/lora/training", json={"dataset_id": ds["id"], "target": target, "steps": 4, "batch_size": 2, "rank": 4})).json()
    run = (await client.get(f"/api/runs/{train['run_id']}")).json()
    assert run["status"] == "completed", run["error"]
    assert run["real_or_simulated"] == "real" and run["summary"]["trainable_params"] > 0
    ckpt = (await client.post("/api/lora/evaluations", json={"dataset_id": ds["id"], "target": target, "max_cases": 6,
                                                             "checkpoint_run_id": train["run_id"], "baseline_run_id": base["run_id"]})).json()
    ck = (await client.get(f"/api/runs/{ckpt['run_id']}")).json()
    assert ck["status"] == "completed", ck["error"]
    assert ck["real_or_simulated"] == "real"
    arts = (await client.post(f"/api/lora/training/{train['run_id']}/export")).json()["artifacts"]
    card = next(a for a in arts if a["kind"] == "model_card")
    assert card["real_or_simulated"] == "real"
