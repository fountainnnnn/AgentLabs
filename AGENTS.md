# AGENTS.md

Guide for contributors and coding agents working on AgentLabs.

AgentLabs is an adversarial hardening workbench: attack a target, detect failures with deterministic
verifiers, patch (agent wrapper) or train (LoRA adapter), retest, compare, export. It has two modules,
Agent Hardening and the LoRA Lab, that share one backend runs model and one PixiJS arena.

## Non-negotiable rules

- The app must run with no API key, no GPU, no local model and without torch/transformers/peft.
- LLM calls go through `backend/llm/provider.py`. The mock provider is the default; a live provider is
  used only when `AGENTLABS_LLM_PROVIDER=openai` and a key are set. Never make paid API calls in tests.
- Never present simulated results as real. Every run and every export carries `real_or_simulated`;
  LoRA exports also carry `not_trained_on_openai_weights: true`. Every report has limitations.
- Never claim API model weights are fine-tuned. LoRA training only targets local open-weight models,
  and base weights are never exported. Agent Hardening exports wrappers, not weights.
- Verifiers stay deterministic (regex and rules). No LLM-as-judge for pass/fail.
- The arena only animates outcomes from backend run events. Do not add client-side fake outcomes.
- Agents, datasets, runs and artifacts are owner-scoped (`security.py`). New endpoints must take
  `owner: str = Depends(current_owner)` and filter by it. Never return secret values from the API or
  write them to exports in clear text.
- Treat uploaded configs as untrusted: literal output filters only, bounded sizes, fail closed.
- Heavy ML imports stay inside functions (`lora_lab/engine.py`) so the app starts without them.

## Layout

- `backend/` FastAPI app (`main.py`), `services/` (hardening loop), `lora_lab/`, `llm/`, `routes/`,
  `models.py`, `security.py`, `seed_attacks.py`, `target_configs/`.
- `frontend/` React + Vite + Tailwind + PixiJS. Pages in `src/pages`, arena in `src/components/arena`,
  the event-to-arena reducer in `src/lib/arenaPlayback.ts`.
- `tests/backend` pytest, `tests/playwright` end-to-end, frontend unit tests next to the code
  (`*.test.ts(x)`).

## UI conventions

- Light theme (`#FCFCF7` background, panels per `frontend/src/index.css`). No emojis or em dashes in
  visible text. Icons come from `lucide-react`; do not hand-draw SVG icons. No pulsing or animated
  status dots.
- Simulation must be labelled visibly (`TruthBadge`, chips) wherever results are shown.

## Before you commit

```bash
python3 -m pytest
npm --prefix frontend run lint && npm --prefix frontend run typecheck && npm --prefix frontend test && npm --prefix frontend run build
PYTHON=python3 npm run test:e2e        # when UI flows change
```

Update `README.md` and `docs/feature-audit.md` when features or their real/simulated status change.
Do not commit runtime data (`.agentlabs/`, model weights, datasets, screenshots outside
`docs/screenshots`, `.env`).
