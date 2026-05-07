import type { BattleState } from "@/types/agentforge";
import { createInitialBattleState } from "@/data/mockData";

const BASE = "/api";
const USE_MOCK = true; // Flip to false when backend is available

function mockDelay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Existing generic helpers
// ---------------------------------------------------------------------------

export async function getHealth(): Promise<{ status: string; mode: string }> {
  if (USE_MOCK) {
    return mockDelay({ status: "ok", mode: "mock" });
  }
  const resp = await fetch(`${BASE}/health`);
  return resp.json();
}

export function downloadJSON(filename: string, data: object) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Agent Hardening — API functions (async, backend-bound)
// ---------------------------------------------------------------------------

export async function getDemoAgent(): Promise<BattleState> {
  if (USE_MOCK) {
    return mockDelay(createInitialBattleState());
  }
  const resp = await fetch(`${BASE}/agent-hardening/demo`);
  if (!resp.ok) throw new Error(`Failed to fetch demo agent: ${resp.status}`);
  return resp.json();
}

export async function uploadAgent(
  file: File
): Promise<{ agentId: string; name: string }> {
  if (USE_MOCK) {
    return mockDelay({ agentId: randomId(), name: file.name.replace(/\.json$/, "") });
  }
  const form = new FormData();
  form.append("agent", file);
  const resp = await fetch(`${BASE}/agent-hardening/upload`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
  return resp.json();
}

export async function spawnHarnesses(
  count: number
): Promise<{ harnessIds: string[] }> {
  if (USE_MOCK) {
    return mockDelay({
      harnessIds: Array.from({ length: count }, () => `harness-${randomId()}`),
    });
  }
  const resp = await fetch(`${BASE}/agent-hardening/harnesses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  if (!resp.ok) throw new Error(`Failed to spawn harnesses: ${resp.status}`);
  return resp.json();
}

export async function runWave(
  waveNumber: number
): Promise<{ waveId: string; attacksDeployed: number }> {
  if (USE_MOCK) {
    return mockDelay({ waveId: `wave-${waveNumber}-${randomId()}`, attacksDeployed: 6 });
  }
  const resp = await fetch(`${BASE}/agent-hardening/wave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wave: waveNumber }),
  });
  if (!resp.ok) throw new Error(`Failed to run wave: ${resp.status}`);
  return resp.json();
}

export async function applyPatch(
  patchType: string
): Promise<{ patchId: string; status: string }> {
  if (USE_MOCK) {
    return mockDelay({ patchId: `patch-${randomId()}`, status: "applied" });
  }
  const resp = await fetch(`${BASE}/agent-hardening/patch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patchType }),
  });
  if (!resp.ok) throw new Error(`Failed to apply patch: ${resp.status}`);
  return resp.json();
}

export async function retest(
  waveNumber: number
): Promise<{ retestId: string; failures: number }> {
  if (USE_MOCK) {
    return mockDelay({ retestId: `retest-${randomId()}`, failures: Math.floor(Math.random() * 3) });
  }
  const resp = await fetch(`${BASE}/agent-hardening/retest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wave: waveNumber }),
  });
  if (!resp.ok) throw new Error(`Retest failed: ${resp.status}`);
  return resp.json();
}

export async function getReport(
  runId: string
): Promise<Record<string, unknown>> {
  if (USE_MOCK) {
    return mockDelay({
      reportId: runId,
      generatedAt: new Date().toISOString(),
      totalWaves: 3,
      metrics: {
        failureRateBefore: 42,
        failureRateAfter: 6,
        robustnessGain: 36,
        attacksTested: 48,
        passed: 39,
        failed: 9,
      },
      patchHistory: [
        { patchType: "Prompt Guard", wave: 1 },
        { patchType: "Execution Constraint", wave: 2 },
      ],
    });
  }
  const resp = await fetch(`${BASE}/agent-hardening/reports/${runId}`);
  if (!resp.ok) throw new Error(`Failed to fetch report: ${resp.status}`);
  return resp.json();
}

export async function exportAgentJson(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/agent-hardening/exports/${runId}/agent.json` });
  }
  const resp = await fetch(`${BASE}/agent-hardening/exports/${runId}/agent.json`);
  if (!resp.ok) throw new Error(`Export agent failed: ${resp.status}`);
  return resp.json();
}

export async function exportReportJson(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/agent-hardening/exports/${runId}/report.json` });
  }
  const resp = await fetch(`${BASE}/agent-hardening/exports/${runId}/report.json`);
  if (!resp.ok) throw new Error(`Export report failed: ${resp.status}`);
  return resp.json();
}

export async function exportRunnerPy(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/agent-hardening/exports/${runId}/runner.py` });
  }
  const resp = await fetch(`${BASE}/agent-hardening/exports/${runId}/runner.py`);
  if (!resp.ok) throw new Error(`Export runner failed: ${resp.status}`);
  return resp.json();
}

export async function exportAgentBundle(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/agent-hardening/exports/${runId}/bundle.zip` });
  }
  const resp = await fetch(`${BASE}/agent-hardening/exports/${runId}/bundle`);
  if (!resp.ok) throw new Error(`Export bundle failed: ${resp.status}`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// LLM Reinforcement Lab — API functions
// ---------------------------------------------------------------------------

export async function getDemoConfig(): Promise<Record<string, unknown>> {
  if (USE_MOCK) {
    return mockDelay({
      baseModel: "Llama-3.2-3B",
      totalEpisodes: 100,
      batchSize: 10,
      learningRate: 2e-5,
      adapterType: "lora",
      freezeBase: true,
      rewardFunction: "helpfulness + safety",
    });
  }
  const resp = await fetch(`${BASE}/rl-lab/demo`);
  if (!resp.ok) throw new Error(`Failed to fetch RL demo config: ${resp.status}`);
  return resp.json();
}

export async function uploadDataset(
  file: File
): Promise<{ datasetId: string; rows: number }> {
  if (USE_MOCK) {
    return mockDelay({ datasetId: `ds-${randomId()}`, rows: 1200 });
  }
  const form = new FormData();
  form.append("dataset", file);
  const resp = await fetch(`${BASE}/rl-lab/datasets`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(`Dataset upload failed: ${resp.status}`);
  return resp.json();
}

export async function spawnRLHarnesses(
  count: number
): Promise<{ harnessIds: string[] }> {
  if (USE_MOCK) {
    return mockDelay({
      harnessIds: Array.from({ length: count }, () => `rl-harness-${randomId()}`),
    });
  }
  const resp = await fetch(`${BASE}/rl-lab/harnesses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count }),
  });
  if (!resp.ok) throw new Error(`Failed to spawn RL harnesses: ${resp.status}`);
  return resp.json();
}

export async function runBatch(
  config: Record<string, unknown>
): Promise<{ batchId: string; episodesCompleted: number }> {
  if (USE_MOCK) {
    return mockDelay({ batchId: `batch-${randomId()}`, episodesCompleted: 10 });
  }
  const resp = await fetch(`${BASE}/rl-lab/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!resp.ok) throw new Error(`Run batch failed: ${resp.status}`);
  return resp.json();
}

export async function computeRewards(
  batchId: string
): Promise<{ rewards: number[]; averageReward: number }> {
  if (USE_MOCK) {
    const rewards = Array.from({ length: 10 }, () => Math.round(Math.random() * 40 + 60));
    return mockDelay({
      rewards,
      averageReward: Math.round(rewards.reduce((a, b) => a + b, 0) / rewards.length),
    });
  }
  const resp = await fetch(`${BASE}/rl-lab/batches/${batchId}/rewards`);
  if (!resp.ok) throw new Error(`Compute rewards failed: ${resp.status}`);
  return resp.json();
}

export async function trainAdapter(
  config: Record<string, unknown>
): Promise<{ adapterId: string; loss: number; epochs: number }> {
  if (USE_MOCK) {
    return mockDelay({
      adapterId: `adapter-${randomId()}`,
      loss: 0.12,
      epochs: 3,
    });
  }
  const resp = await fetch(`${BASE}/rl-lab/adapter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!resp.ok) throw new Error(`Train adapter failed: ${resp.status}`);
  return resp.json();
}

export async function evaluateCheckpoint(
  adapterId: string
): Promise<{ passed: boolean; metrics: Record<string, number> }> {
  if (USE_MOCK) {
    return mockDelay({
      passed: true,
      metrics: {
        accuracy: 0.94,
        f1: 0.91,
        reward: 87,
        loss: 0.09,
      },
    });
  }
  const resp = await fetch(`${BASE}/rl-lab/adapters/${adapterId}/evaluate`);
  if (!resp.ok) throw new Error(`Evaluate checkpoint failed: ${resp.status}`);
  return resp.json();
}

export async function getRLReport(
  runId: string
): Promise<Record<string, unknown>> {
  if (USE_MOCK) {
    return mockDelay({
      reportId: runId,
      generatedAt: new Date().toISOString(),
      baseModel: "Llama-3.2-3B",
      totalEpisodes: 100,
      finalReward: 94,
      finalLoss: 0.08,
      adapterType: "lora",
      trainingTime: "3m 42s",
    });
  }
  const resp = await fetch(`${BASE}/rl-lab/reports/${runId}`);
  if (!resp.ok) throw new Error(`Failed to fetch RL report: ${resp.status}`);
  return resp.json();
}

export async function exportModelCard(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/rl-lab/exports/${runId}/model-card.md` });
  }
  const resp = await fetch(`${BASE}/rl-lab/exports/${runId}/model-card`);
  if (!resp.ok) throw new Error(`Export model card failed: ${resp.status}`);
  return resp.json();
}

export async function exportTrainingReport(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/rl-lab/exports/${runId}/training-report.json` });
  }
  const resp = await fetch(`${BASE}/rl-lab/exports/${runId}/training-report`);
  if (!resp.ok) throw new Error(`Export training report failed: ${resp.status}`);
  return resp.json();
}

export async function exportRewardTrace(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/rl-lab/exports/${runId}/reward-trace.csv` });
  }
  const resp = await fetch(`${BASE}/rl-lab/exports/${runId}/reward-trace`);
  if (!resp.ok) throw new Error(`Export reward trace failed: ${resp.status}`);
  return resp.json();
}

export async function exportAdapterConfig(
  adapterId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/rl-lab/adapters/${adapterId}/config.yaml` });
  }
  const resp = await fetch(`${BASE}/rl-lab/adapters/${adapterId}/config`);
  if (!resp.ok) throw new Error(`Export adapter config failed: ${resp.status}`);
  return resp.json();
}

export async function exportRLBundle(
  runId: string
): Promise<{ downloadUrl: string }> {
  if (USE_MOCK) {
    return mockDelay({ downloadUrl: `/api/rl-lab/exports/${runId}/rl-bundle.zip` });
  }
  const resp = await fetch(`${BASE}/rl-lab/exports/${runId}/bundle`);
  if (!resp.ok) throw new Error(`Export RL bundle failed: ${resp.status}`);
  return resp.json();
}

// ---------------------------------------------------------------------------
// Client-side download helpers (keep for local export)
// ---------------------------------------------------------------------------

export function exportAgentJSON(state: BattleState) {
  const agent = {
    name: "RefundBot-3000",
    version: state.activeGenerationId,
    mode: state.mode,
    integrity: state.integrity,
    metrics: state.metrics,
    generations: state.generations,
  };
  downloadJSON(`agent_${state.activeGenerationId}.json`, agent);
}

export function exportReportJSON(state: BattleState) {
  const report = {
    report_id: `AF-${Date.now()}`,
    generated_at: new Date().toISOString(),
    mode: "mock",
    total_waves: state.currentWave,
    metrics: state.metrics,
    attacks: state.attacks,
    events: state.events,
    patch: state.latestPatch,
  };
  downloadJSON(`report_wave${state.currentWave}.json`, report);
}

export function exportBundle(state: BattleState) {
  exportAgentJSON(state);
  setTimeout(() => exportReportJSON(state), 100);
}
