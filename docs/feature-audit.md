# AgentLabs feature audit

This audit covers the two codebases that were merged into AgentLabs and the state of every
feature after the merge.

- **TARGET**: this repository, previously "AgentForge" (FastAPI backend in `backend/`, Vite/React
  frontend in `agentforge-react/`, now `frontend/`).
- **SOURCE**: the old hackathon "AgentLabs LoRA Lab" (a LoRA-only fork of the same frontend, plus
  `backend/main.py` and `backend/lora_engine.py`). Read only; nothing was copied from its committed
  runtime artifacts (`backend/.models`, `.agentlabs` datasets, `__pycache__`).

Status legend: **works** (exercised end to end), **broken**, **stub** (endpoint or UI exists but
returns canned data), **simulated-only** (labelled or unlabelled simulation with no real path),
**dead** (code not reachable from the app).

## 1. Inventory before the merge

### TARGET (AgentForge)

| Feature | Where | Status | Evidence |
| --- | --- | --- | --- |
| README | `README.md` | broken | Described a Next.js app in `frontend/` with `/arena`, `/replay` routes that did not exist; the real UI was Vite in `agentforge-react/`. |
| Hardening pipeline (attack, verify, patch, retest) | `backend/services/hardening_pipeline.py`, `/api/runs` | works, limited | Ran 3 waves x 4 seed attacks against a keyword mock; patches only recognised by the mock via hard-coded phrases. Not used by the UI. |
| Deterministic verifier | `backend/services/verifier.py` | works, buggy | Secret check split secret sentences into words, so any reply containing "refund" or "internal" failed. Unparseable amounts counted as 0. |
| OpenAI / mock switch | `backend/services/openai_service.py` | works | Switched to live automatically whenever `OPENAI_API_KEY` was set; no base-URL support. |
| `/api/agent-hardening/*` endpoints | `backend/routes/agent_hardening.py` | stub | `run-wave` used `random.random()` pass/fail, `report` and `export/*` returned hard-coded numbers and a placeholder runner that always said "processed within policy". |
| `/api/rl-lab/*` endpoints | `backend/routes/rl_lab.py`, `backend/rl_lab/*` (21 modules) | stub / simulated-only | Random failures, simulated training; about 15 `rl_lab` modules never imported. |
| Harness kernel, core, agent_hardening packages | `backend/harness_core`, `backend/core`, `backend/agent_hardening` | dead | Not imported by `main.py`; only two schema files were touched by tests. |
| Agent Hardening page | `agentforge-react/src/pages/AgentHardeningPage.tsx` | simulated-only | No `fetch` call; outcomes chosen client-side from mock data; export buttons downloaded hand-written JSON labelled `demo_simulation`. |
| RL Lab page | `agentforge-react/src/pages/RLLabPage.tsx` | simulated-only | Client-side timers incremented reward numbers. |
| Reports / Exports pages | `agentforge-react/src/pages/*` | simulated-only | Rendered static mock data. |
| API client | `agentforge-react/src/lib/api.ts` | broken, dead | Called endpoints that did not exist (`/agent-hardening/demo`, `/rl-lab/batch`); imported by nothing. |
| PixiJS battle arena | `agentforge-react/src/components/arena/PixiArena*.tsx` | works (visual only) | Animated attacks from mock state. |
| Unused frontend code | about 55 files (`components/ops`, `components/rl-lab`, `lib/machines`, `lib/exportClient.ts` ...) | dead | Not reachable from `main.tsx`. |
| Backend tests | `tests/backend` | broken | 20 of 53 errored (missing `greenlet`); passing tests exercised the random stubs. |
| Playwright tests | `tests/playwright` | broken | Expected the AgentForge mock UI on port 3000; no backend. |
| Hygiene | repo root | broken | 25 MB of unused reference images and sprite sheets, duplicated `assets/`, image-generation prompt files, Windows-only `run.bat`. |

### SOURCE (old AgentLabs LoRA Lab)

| Feature | Where | Status | Evidence |
| --- | --- | --- | --- |
| Truth modes (`real_capable` / `simulation`) | `backend/main.py` `runtime_info()` | works | Detected torch/transformers/peft/accelerate. |
| Synthetic and uploaded datasets | `/api/lora/datasets/*` | works | 5 templated categories; JSON/JSONL upload. |
| Baseline and checkpoint evaluation | `/api/lora/eval/*` | simulated-only | `score_samples` added a fixed `+0.18` improvement; no model was queried. |
| Training job | `/api/lora/train` | simulated-only | Even with a real model the job ran the simulated curve and was labelled `real_capable_simulated_loop`. |
| Real LoRA engine | `backend/lora_engine.py`, `/api/lora/real/*` | works, flawed | Real GPT-2 LoRA via `Trainer`; crashed on import without torch; sampling with `random` noise in the scorer, and "passed" meant "LoRA score beat base by 0.02". |
| LoRA workbench page | `src/pages/RLLabPage.tsx` | partly simulated | Called the API but also incremented rewards on timers; the PDF export fell back to a hard-coded "presentation" report with invented outputs. |
| Arena | `src/components/arena/*` | works (visual only) | Newer arena revision (fixed attack counter, flipped sprites, better layout). |
| Exports | `/api/lora/exports` | works | JSON with `real_or_simulated` and `not_base_model_weights`. |

## 2. Final status after the merge

All features live in one app and share one runs model (`runs`, `run_events`, `case_results`,
`patches`, `artifacts`, `datasets`, `agent_configs`).

| Feature | Where | Final status | How it was verified |
| --- | --- | --- | --- |
| LLM provider abstraction (mock default, OpenAI-compatible via env incl. OpenRouter/DeepSeek base URL) | `backend/llm/provider.py`, `backend/llm/mock_agent.py` | works (mock); live path unverified | `test_provider_and_wrapper.py`; no paid calls were made, so the live provider is exercised only through construction and config tests. |
| Agent upload (agent.json, paste) with validation | `routes/hardening.py`, `services/target_agent.py` | works | API tests and UI. Secrets are never returned by the API. |
| Harness generation (200 seed attacks, 10 families, deterministic per seed) | `services/harness.py`, `seed_attacks.py` | works | `test_hardening_loop.py::test_run_is_deterministic` |
| Deterministic verifiers (11 rules) | `services/verifier.py` | works | `test_verifiers.py` (one test per verifier) |
| Wrapper guards: tool gate (fail closed), output filters (literal, secret redaction) | `services/target_agent.py`, `security.py` | works | `test_security.py` |
| Patcher (prompt guards, tool policy, output filters; optional LLM refinement in live mode) | `services/patcher.py` | works (template); LLM refinement unverified | `test_patcher.py` |
| Retest and pre/post comparison, final v0-vs-final regression suite | `services/hardening_pipeline.py`, `services/reports.py` | works | `test_hardening_loop.py` |
| Hardening exports: agent.json, report.json, report.html, runner.py, bundle.zip | `services/exporter.py`, `services/runner_template.py` | works | Bundle unzipped in tests; `runner.py --self-test` runs offline. |
| Battle arena driven by real run events | `frontend/src/lib/arenaPlayback.ts`, `usePlayback.ts`, `components/arena/*` | works | Vitest reducer tests; Playwright run; manual browser check. Every animated hit or block is a `case_result` event. |
| LoRA lab capabilities / truth modes | `backend/lora_lab/capabilities.py` | works | `test_lora_lab.py` |
| Datasets (curated demo, JSON/JSONL/CSV upload) | `backend/lora_lab/datasets.py` | works | `test_lora_lab.py` |
| Adversarial model evaluation (simulated model, local HF model, or LLM provider) | `backend/lora_lab/service.py`, `scoring.py` | works (simulated, local tiny-gpt2, mock provider) | `test_lora_lab.py`, `test_real_lora.py` |
| LoRA training: simulated | `backend/lora_lab/simulation.py` | works, labelled `simulated` | `test_lora_lab.py` |
| LoRA training: real (torch + peft + local model) | `backend/lora_lab/engine.py` | works on CPU with `sshleifer/tiny-gpt2` | `test_real_lora.py` with `AGENTLABS_TEST_MODEL_PATH` (skipped otherwise) |
| Checkpoint evaluation and baseline-vs-checkpoint comparison | `lora_lab/service.py`, `/api/lora/training/{id}/comparison` | works | `test_lora_lab.py` |
| LoRA exports: model_card, training_report, reward_trace, adapter_config, adapter or labelled placeholder, bundle | `lora_lab/service.py` | works | `test_lora_lab.py` |
| RL lab page (now the LoRA Lab) | `frontend/src/pages/RLLabPage.tsx` (`/rl-lab`, alias `/lora-lab`) | works | Playwright |
| Reports page (runs, category breakdown, failure clusters, patch diffs, examples, printable HTML) | `frontend/src/pages/ReportsPage.tsx`, `/api/runs/{id}/report(.html)` | works | Playwright |
| Exports page | `frontend/src/pages/ExportsPage.tsx` | works | Vitest + Playwright |
| Owner scoping and optional access token | `backend/security.py`, `routes/session.py` | works | `test_security.py` |
| Docker image, Railway config, `/healthz` | `Dockerfile`, `railway.json` | works | `docker build`, container served `/healthz`, `/api/health`, UI routes and a full hardening run. |

## 3. What remains simulated or unverified

- With the default mock provider, target-agent replies come from a deterministic simulator
  (`llm/mock_agent.py`). The loop, verifiers, patches, gates and reports are real code, and every
  run and export is labelled `simulated`.
- Adapter Simulation Mode produces a simulated loss curve and a placeholder adapter; it is labelled
  `simulated` everywhere.
- The OpenAI-compatible provider and LLM patch refinement were not called against a live API
  (no paid calls were allowed). They are covered by configuration tests only.
- Real LoRA training was verified with a tiny model on CPU for a few steps. Larger models should work
  through the same code path but were not run here.
