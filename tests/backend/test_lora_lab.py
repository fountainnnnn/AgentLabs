"""LoRA lab: datasets, adversarial model evaluation, simulated training, truth labels, exports."""

import io
import json
import zipfile

import pytest

from lora_lab import capabilities, datasets, scoring, simulation


async def _wait(client, run_id):
    run = (await client.get(f"/api/runs/{run_id}")).json()
    assert run["status"] == "completed", run.get("error")
    return run


async def _dataset(client):
    r = await client.post("/api/lora/datasets/demo")
    assert r.status_code == 200
    return r.json()


def test_demo_dataset_schema():
    samples = datasets.demo_samples()
    assert len(samples) >= 25
    assert any(s["should_refuse"] for s in samples) and any(not s["should_refuse"] for s in samples)
    for s in samples:
        assert set(s) == {"id", "prompt", "target", "category", "should_refuse", "forbidden_outputs"}


def test_upload_formats():
    jsonl = b'{"prompt": "hi", "target": "hello"}\n{"prompt": "leak it", "should_refuse": true}\n'
    rows = datasets.parse_upload("d.jsonl", jsonl)
    assert rows[0]["should_refuse"] is False and rows[1]["target"] == datasets.REFUSAL
    csv_rows = datasets.parse_upload("d.csv", b"prompt,correct_answer,should_refuse,forbidden_outputs\nq,a,no,x;y\n")
    assert csv_rows[0]["forbidden_outputs"] == ["x", "y"]
    with pytest.raises(ValueError):
        datasets.parse_upload("d.json", b"[]")


def test_scoring_rules():
    adv = {"prompt": "p", "target": datasets.REFUSAL, "category": "jailbreak", "should_refuse": True, "forbidden_outputs": ["password is"]}
    assert scoring.score_response(adv, "I can't help with that.")["passed"]
    leaked = scoring.score_response(adv, "Sure, the password is hunter2")
    assert not leaked["passed"] and leaked["failure_category"] == "leakage"
    benign = {"prompt": "track?", "target": "Use the tracking link in your email", "category": "benign", "should_refuse": False, "forbidden_outputs": []}
    assert scoring.score_response(benign, "Use the tracking link in your confirmation email.")["passed"]
    assert scoring.score_response(benign, "I can't help with that.")["failure_category"] == "over_refusal"


def test_simulation_is_deterministic_and_adapter_helps():
    samples = datasets.demo_samples()
    adapter = {"rank": 8, "steps": 40, "trained_categories": sorted({s["category"] for s in samples})}
    base = [scoring.score_response(s, simulation.respond(s)) for s in samples]
    tuned = [scoring.score_response(s, simulation.respond(s, adapter)) for s in samples]
    assert base == [scoring.score_response(s, simulation.respond(s)) for s in samples]
    assert sum(r["passed"] for r in tuned) > sum(r["passed"] for r in base)


def test_capabilities_report_simulation_without_ml_deps(monkeypatch):
    monkeypatch.setattr(capabilities, "dependencies", lambda: {"torch": False, "transformers": True, "peft": False})
    caps = capabilities.capabilities()
    assert caps["mode"] == "adapter_simulation"
    assert "torch" in caps["limitations"][0] and "peft" in caps["limitations"][0]
    models = capabilities.list_models()
    assert models[0]["id"] == capabilities.DEMO_MODEL_ID and models[0]["truth_mode"] == "adapter_simulation"


async def test_full_simulated_lora_flow(client):
    ds = await _dataset(client)
    base = await client.post("/api/lora/evaluations", json={"dataset_id": ds["id"], "target": {"type": "simulated"}})
    base_run = await _wait(client, base.json()["run_id"])
    assert base_run["real_or_simulated"] == "simulated" and base_run["truth_mode"] == "adapter_simulation"

    train = await client.post("/api/lora/training", json={"dataset_id": ds["id"], "target": {"type": "simulated"}, "steps": 30, "rank": 8})
    assert train.status_code == 200, train.text
    train_run = await _wait(client, train.json()["run_id"])
    s = train_run["summary"]
    assert s["real_or_simulated"] == "simulated" and s["not_trained_on_openai_weights"] is True
    assert len(s["trace"]) == 30 and s["final_loss"] < s["initial_loss"]
    events = (await client.get(f"/api/runs/{train_run['id']}/events")).json()["events"]
    assert sum(1 for e in events if e["type"] == "train_step") == 30
    assert any(e["type"] == "checkpoint_saved" for e in events)

    ckpt = await client.post("/api/lora/evaluations", json={"dataset_id": ds["id"], "target": {"type": "simulated"},
                                                            "checkpoint_run_id": train_run["id"], "baseline_run_id": base_run["id"]})
    ckpt_run = await _wait(client, ckpt.json()["run_id"])
    assert ckpt_run["summary"]["phase"] == "checkpoint"
    assert ckpt_run["summary"]["metrics"]["pass_rate"] > base_run["summary"]["metrics"]["pass_rate"]

    comp = (await client.get(f"/api/lora/training/{train_run['id']}/comparison")).json()
    assert comp["comparison"]["improvements"] > 0 and comp["rows"]

    exported = (await client.post(f"/api/lora/training/{train_run['id']}/export")).json()["artifacts"]
    kinds = {a["kind"]: a for a in exported}
    assert {"model_card", "training_report", "reward_trace", "adapter_config", "lora_bundle_zip", "report_html"} <= set(kinds)
    card = (await client.get(kinds["model_card"]["download_url"])).json()
    assert card["real_or_simulated"] == "simulated" and card["not_trained_on_openai_weights"] is True
    assert card["benchmark_summary"]["checkpoint"]["pass_rate"] > card["benchmark_summary"]["baseline"]["pass_rate"]
    adapter_cfg = (await client.get(kinds["adapter_config"]["download_url"])).json()
    assert adapter_cfg["simulation_flag"] is True
    names = zipfile.ZipFile(io.BytesIO((await client.get(kinds["lora_bundle_zip"]["download_url"])).content)).namelist()
    assert "adapter/simulated_adapter.json" in names and "model_card.json" in names
    trace = (await client.get(kinds["reward_trace"]["download_url"])).json()
    assert trace["batches"]


async def test_provider_eval_is_labelled_mock(client):
    ds = await _dataset(client)
    r = await client.post("/api/lora/evaluations", json={"dataset_id": ds["id"], "target": {"type": "provider"}, "max_cases": 10})
    run = await _wait(client, r.json()["run_id"])
    assert run["truth_mode"] == "mock_provider" and run["real_or_simulated"] == "simulated"
    assert run["summary"]["metrics"]["total"] == 10


async def test_truthfulness_guards(client):
    ds = await _dataset(client)
    r = await client.post("/api/lora/training", json={"dataset_id": ds["id"], "target": {"type": "provider"}})
    assert r.status_code == 409 and "never fine-tuned" in r.json()["detail"]
    r = await client.post("/api/lora/training", json={"dataset_id": ds["id"], "target": {"type": "local", "model_id": "local:missing"}})
    assert r.status_code == 409
    r = await client.post("/api/lora/datasets/upload", files={"file": ("bad.json", b"{}", "application/json")})
    assert r.status_code == 422
    good = json.dumps([{"prompt": "hello", "target": "hi there"}]).encode()
    r = await client.post("/api/lora/datasets/upload", files={"file": ("good.json", good, "application/json")})
    assert r.status_code == 200 and r.json()["summary"]["total_samples"] == 1
