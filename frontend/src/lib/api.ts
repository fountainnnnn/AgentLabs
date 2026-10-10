/** Typed client for the AgentLabs backend. All requests go to same-origin /api (proxied in dev). */

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export type RunKind = "hardening" | "model_eval" | "lora_training";
export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface Run {
  id: string;
  kind: RunKind;
  name: string;
  status: RunStatus;
  provider: string;
  real_or_simulated: "real" | "simulated" | string;
  truth_mode: string;
  parent_run_id: string | null;
  config: Record<string, any>;
  summary: Record<string, any>;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface RunEvent {
  seq: number;
  type: string;
  wave: number | null;
  phase: string | null;
  message: string;
  payload: Record<string, any>;
  created_at: string | null;
}

export interface Artifact {
  id: string;
  run_id?: string;
  kind: string;
  filename: string;
  media_type: string;
  real_or_simulated: string;
  size_bytes?: number;
  created_at?: string | null;
  download_url: string;
}

export interface Health {
  status: string;
  product: string;
  version: string;
  llm: { provider: string; live: boolean; requested: string; base_url: string | null; warning?: string };
  lora_mode: "real_local_model" | "adapter_simulation";
  lora_dependencies: Record<string, boolean>;
  auth_required: boolean;
}

export interface AgentSummary {
  id: string;
  name: string;
  source: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  version: string;
  system_prompt: string;
  tools: { name: string; description: string; parameters: Record<string, string>; dangerous: boolean }[];
  policies: { rule: string; value: unknown }[];
  secrets: string[];
  tool_policies: Record<string, unknown>;
  output_filters: unknown[];
}

export interface DemoAgent {
  id: string;
  name: string;
  config: AgentConfig;
  attack_library: Record<string, number>;
  categories: string[];
  verifiers: string[];
}

export interface LoraModel {
  id: string;
  name: string;
  source: "simulation" | "local_path" | "hf_cache";
  path: string | null;
  available: boolean;
  truth_mode: string;
  description: string;
}

export interface LoraCapabilities {
  mode: "real_local_model" | "adapter_simulation";
  dependencies: Record<string, boolean>;
  real_training_enabled: boolean;
  real_models: string[];
  limitations: string[];
}

export interface DatasetSample {
  id: string;
  prompt: string;
  target: string;
  category: string;
  should_refuse: boolean;
  forbidden_outputs: string[];
}

export interface DatasetInfo {
  id: string;
  name: string;
  source: string;
  summary: { total_samples: number; should_refuse: number; benign_or_grounded: number; categories: Record<string, number> };
  preview: DatasetSample[];
}

export interface TargetSpec {
  type: "simulated" | "local" | "provider";
  model_id?: string | null;
}

export interface Comparison {
  baseline_run_id: string;
  checkpoint_run_id: string;
  baseline_metrics: Record<string, any>;
  checkpoint_metrics: Record<string, any>;
  comparison: { improvements: number; regressions: number; before_failure_rate: number; after_failure_rate: number; total: number };
  rows: {
    case_id: string;
    category: string;
    prompt: string;
    base_response: string;
    adapter_response: string;
    base_passed: boolean;
    adapter_passed: boolean;
    base_score: number;
    adapter_score: number;
  }[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

const postJson = <T,>(path: string, body: unknown = {}) =>
  request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const postFile = <T,>(path: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return request<T>(path, { method: "POST", body: form });
};

export const api = {
  health: () => request<Health>("/api/health"),
  session: () => request<{ auth_required: boolean; authenticated: boolean }>("/api/session"),
  login: (token: string) => postJson<{ authenticated: boolean }>("/api/session", { token }),

  // runs, reports, artifacts
  listRuns: (kind?: RunKind) => request<{ runs: Run[] }>(`/api/runs${kind ? `?kind=${kind}` : ""}`).then((r) => r.runs),
  getRun: (id: string) => request<Run>(`/api/runs/${id}`),
  getEvents: (id: string, after = 0) =>
    request<{ run_id: string; status: RunStatus; events: RunEvent[] }>(`/api/runs/${id}/events?after=${after}`),
  getReport: (id: string) => request<Record<string, any>>(`/api/runs/${id}/report`),
  reportHtmlUrl: (id: string) => `${BASE}/api/runs/${id}/report.html`,
  listArtifacts: (runId?: string) =>
    request<{ artifacts: Artifact[] }>(`/api/artifacts${runId ? `?run_id=${runId}` : ""}`).then((r) => r.artifacts),
  downloadUrl: (artifact: Artifact) => `${BASE}${artifact.download_url}`,

  // agent hardening
  demoAgent: () => request<DemoAgent>("/api/hardening/demo-agent"),
  listAgents: () => request<{ agents: AgentSummary[] }>("/api/hardening/agents").then((r) => r.agents),
  getAgent: (id: string) => request<{ id: string; config: AgentConfig }>(`/api/hardening/agents/${id}`),
  createAgent: (config: Partial<AgentConfig>) => postJson<AgentSummary & { config: AgentConfig }>("/api/hardening/agents", config),
  uploadAgent: (file: File) => postFile<AgentSummary & { config: AgentConfig }>("/api/hardening/agents/upload", file),
  startHardening: (body: { agent_id: string; waves: number; cases_per_wave: number; seed?: number }) =>
    postJson<{ run_id: string; real_or_simulated: string; truth_mode: string }>("/api/hardening/runs", body),

  // LoRA lab
  loraModels: () => request<{ models: LoraModel[]; capabilities: LoraCapabilities }>("/api/lora/models"),
  demoDataset: () => postJson<DatasetInfo>("/api/lora/datasets/demo"),
  uploadDataset: (file: File) => postFile<DatasetInfo>("/api/lora/datasets/upload", file),
  startEvaluation: (body: { dataset_id: string; target: TargetSpec; checkpoint_run_id?: string; baseline_run_id?: string; max_cases?: number }) =>
    postJson<{ run_id: string; phase: string; real_or_simulated: string; truth_mode: string }>("/api/lora/evaluations", body),
  startTraining: (body: { dataset_id: string; target: TargetSpec; rank: number; steps: number; learning_rate: number; batch_size: number }) =>
    postJson<{ run_id: string; real_or_simulated: string; truth_mode: string }>("/api/lora/training", body),
  comparison: (trainingRunId: string) => request<Comparison>(`/api/lora/training/${trainingRunId}/comparison`),
  exportTraining: (trainingRunId: string) =>
    postJson<{ run_id: string; artifacts: Artifact[] }>(`/api/lora/training/${trainingRunId}/export`),
};

/** Poll a run's events until it finishes. Calls onEvents with each new batch. */
export async function followRun(
  runId: string,
  onEvents: (events: RunEvent[], status: RunStatus) => void,
  signal?: AbortSignal,
  intervalMs = 400,
): Promise<RunStatus> {
  let after = 0;
  for (;;) {
    if (signal?.aborted) return "failed";
    const { events, status } = await api.getEvents(runId, after);
    if (events.length) {
      after = events[events.length - 1].seq;
    }
    onEvents(events, status);
    if (status === "completed" || status === "failed") {
      // one final read in case events landed between the two queries
      const tail = await api.getEvents(runId, after);
      if (tail.events.length) onEvents(tail.events, tail.status);
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
