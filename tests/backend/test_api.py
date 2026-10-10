"""Health, listing and error handling."""


async def test_healthz(client):
    assert (await client.get("/healthz")).json() == {"status": "ok"}


async def test_health_reports_offline_defaults(client):
    body = (await client.get("/api/health")).json()
    assert body["product"] == "AgentLabs"
    assert body["llm"]["provider"] == "mock" and body["llm"]["live"] is False
    assert body["lora_mode"] in {"adapter_simulation", "real_local_model"}


async def test_demo_agent_and_lists(client):
    demo = (await client.get("/api/hardening/demo-agent")).json()
    assert demo["name"] == "RefundBot-3000" and sum(demo["attack_library"].values()) == 200
    assert (await client.get("/api/hardening/agents")).json()["agents"][0]["source"] == "demo"
    assert "models" in (await client.get("/api/lora/models")).json()
    assert "runs" in (await client.get("/api/runs")).json()


async def test_not_found(client):
    assert (await client.get("/api/runs/run_missing")).status_code == 404
    assert (await client.get("/api/artifacts/art_missing/download")).status_code == 404
    assert (await client.get("/api/lora/datasets/ds_missing")).status_code == 404
