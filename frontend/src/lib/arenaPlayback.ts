/**
 * Turns backend run events into arena state. The arena never invents outcomes: every
 * blocked or breached attack it animates is a case_result event from a real run.
 */
import type { AttackCategory, AttackScenario, BattleEvent, BattleState, EventKind, PatchSummary, Severity } from "@/types/arena";
import type { RunEvent } from "@/lib/api";

const ARENA_CATEGORY: Record<string, AttackCategory> = {
  prompt_injection: "prompt_injection",
  constraint_violation: "prompt_injection",
  jailbreak: "prompt_injection",
  deceptive_instruction: "prompt_injection",
  role_impersonation: "role_impersonation",
  role_confusion: "role_impersonation",
  emotional_manipulation: "emotional_manipulation",
  missing_escalation: "emotional_manipulation",
  benign: "emotional_manipulation",
  tool_abuse: "tool_abuse",
  tool_safety: "tool_abuse",
  unsafe_compliance: "tool_abuse",
  policy_extraction: "policy_extraction",
  secret_leakage: "policy_extraction",
  hallucinated_policy: "policy_extraction",
  hallucination_trap: "policy_extraction",
  data_exfiltration: "policy_extraction",
  policy_generalization: "policy_extraction",
  multi_turn: "multi_turn_escalation",
  multi_turn_attack: "multi_turn_escalation",
  reward_hacking_probe: "multi_turn_escalation",
};

export function arenaCategory(category: string): AttackCategory {
  return ARENA_CATEGORY[category] ?? "prompt_injection";
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface WaveTrack {
  wave: number;
  total: number;
  preFailed: number | null;
  postFailed: number | null;
  patched: boolean;
  status: "pending" | "running" | "retest" | "done";
}

export interface PlaybackState {
  battle: BattleState;
  narration: string;
  generation: number;
  waves: WaveTrack[];
  patches: PatchSummary[];
  lossPoints: { step: number; loss: number }[];
  finished: boolean;
  failed: boolean;
  regression: Record<string, any> | null;
  lastPhase: string | null;
}

export function initialPlayback(label = "Ready"): PlaybackState {
  return {
    battle: {
      status: "idle",
      currentWave: 1,
      currentAttackIndex: -1,
      integrity: 100,
      shield: 100,
      score: 0,
      mode: "initial",
      generations: [],
      attacks: [],
      verifierRules: [],
      events: [],
      latestPatch: null,
      metrics: { failureRateBefore: 0, failureRateAfter: 0, robustnessGain: 0, attacksTested: 0, passed: 0, failed: 0, categoryBreakdown: [] },
      activeGenerationId: "v0",
    },
    narration: label,
    generation: 0,
    waves: [],
    patches: [],
    lossPoints: [],
    finished: false,
    failed: false,
    regression: null,
    lastPhase: null,
  };
}

/** Base delays at 1x speed, in milliseconds. */
export const DELAYS = {
  wave: 1200,
  attack: 3600,
  summary: 1500,
  patch: 2600,
  trainStep: 90,
  minor: 300,
};

let logCounter = 0;
function logEntry(kind: EventKind, message: string, severity: BattleEvent["severity"]): BattleEvent {
  logCounter += 1;
  return { id: `log-${logCounter}`, timestamp: new Date().toISOString(), kind, message, severity };
}

function withLog(state: PlaybackState, entry: BattleEvent): PlaybackState {
  const events = [...state.battle.events, entry].slice(-200);
  return { ...state, battle: { ...state.battle, events } };
}

function attacksFrom(cases: any[]): AttackScenario[] {
  return (cases ?? []).map((c) => ({
    id: c.case_id,
    category: arenaCategory(c.category),
    label: titleCase(c.category),
    severity: (c.severity ?? "medium") as Severity,
    prompt: c.prompt,
    status: "pending",
    enemyState: "idle",
  }));
}

/** Apply one backend event. Returns the next state and how long to hold it (at 1x). */
export function applyEvent(state: PlaybackState, event: RunEvent): { state: PlaybackState; delay: number } {
  const p = event.payload ?? {};
  const b = state.battle;
  switch (event.type) {
    case "run_started":
    case "train_started":
    case "freeze": {
      const next = withLog({ ...state, narration: event.message, lastPhase: event.phase }, logEntry("wave", event.message, "info"));
      return { state: next, delay: DELAYS.minor };
    }
    case "wave_started":
    case "retest_started": {
      const retest = event.type === "retest_started";
      const wave = event.wave ?? b.currentWave;
      const attacks = attacksFrom(p.cases);
      const waves = retest
        ? state.waves.map((w) => (w.wave === wave ? { ...w, status: "retest" as const } : w))
        : [...state.waves.filter((w) => w.wave !== wave).map((w) => (w.status === "pending" || w.status === "done" ? w : { ...w, status: "done" as const })), { wave, total: attacks.length, preFailed: null, postFailed: null, patched: false, status: "running" as const }];
      const next: PlaybackState = {
        ...state,
        waves,
        narration: event.message,
        lastPhase: event.phase,
        battle: { ...b, status: "running_wave", currentWave: wave, currentAttackIndex: -1, attacks, mode: retest ? "retest" : state.generation > 0 ? "patched" : "initial" },
      };
      return { state: withLog(next, logEntry("wave", event.message, "info")), delay: DELAYS.wave };
    }
    case "case_result": {
      const idx = b.attacks.findIndex((a) => a.id === p.case_id);
      const passed = Boolean(p.passed);
      const attacks = b.attacks.map((a, i) =>
        i === idx ? { ...a, status: passed ? ("blocked" as const) : ("failed" as const), enemyState: passed ? ("defeated" as const) : ("successful" as const) } : a,
      );
      const integrity = passed ? b.integrity : Math.max(0, b.integrity - 6);
      const shield = passed ? Math.max(0, b.shield - 2) : Math.max(0, b.shield - 8);
      const firstPass = event.phase !== "post_patch" && event.phase !== "regression";
      const trackedWaves = firstPass
        ? state.waves.map((w) => (w.wave === (event.wave ?? b.currentWave) ? { ...w, preFailed: (w.preFailed ?? 0) + (passed ? 0 : 1) } : w))
        : state.waves;
      const metrics = { ...b.metrics, attacksTested: b.metrics.attacksTested + 1, passed: b.metrics.passed + (passed ? 1 : 0), failed: b.metrics.failed + (passed ? 0 : 1) };
      const label = titleCase(p.category ?? "attack");
      const narration = passed
        ? `${label} blocked. Verifiers passed.`
        : `${label} breached: ${p.failure_reason ?? p.failure_category ?? "verifier failure"}.`;
      const next: PlaybackState = {
        ...state,
        waves: trackedWaves,
        narration,
        lastPhase: event.phase,
        battle: { ...b, attacks, integrity, shield, metrics, score: b.score + (passed ? 12 : -4), status: passed ? "attack_blocked" : "attack_failed", currentAttackIndex: idx >= 0 ? idx : b.currentAttackIndex },
      };
      const tag = event.phase === "post_patch" || event.phase === "checkpoint" ? "RETEST" : "ATTACK";
      return {
        state: withLog(next, logEntry(passed ? "pass" : "fail", `${tag} ${passed ? "PASS" : "FAIL"} ${label}${passed ? "" : ` | ${p.failure_category ?? ""}`}`, passed ? "success" : "danger")),
        delay: idx >= 0 ? DELAYS.attack : DELAYS.minor,
      };
    }
    case "wave_summary":
    case "retest_summary": {
      const wave = event.wave ?? b.currentWave;
      const waves = state.waves.map((w) =>
        w.wave === wave
          ? event.type === "wave_summary"
            ? { ...w, preFailed: Number(p.failed ?? 0), status: "done" as const }
            : { ...w, postFailed: Math.round(((p.after_failure_rate ?? 0) / 100) * w.total), status: "done" as const }
          : w,
      );
      const next = { ...state, waves, narration: event.message, battle: { ...b, status: "completed" as const, currentAttackIndex: -1 } };
      return { state: withLog(next, logEntry("wave", event.message, "info")), delay: DELAYS.summary };
    }
    case "patch_applied": {
      const changes = p.changes ?? {};
      const patch: PatchSummary = {
        id: `patch-${p.generation}`,
        patchType: p.source ?? "template",
        title: p.title ?? event.message,
        addedRules: changes.added_system_rules ?? [],
        restrictedTools: Object.keys(changes.tool_policies ?? {}),
        outputFilters: (changes.added_output_filters ?? []).map((f: any) => f.pattern ?? f.type ?? "filter"),
      };
      const generation = Number(p.generation ?? state.generation + 1);
      const waves = state.waves.map((w) => (w.wave === event.wave ? { ...w, patched: true } : w));
      const next: PlaybackState = {
        ...state,
        generation,
        waves,
        patches: [...state.patches, patch],
        narration: `Patch applied. Agent upgraded to v${generation}: ${p.rationale ?? ""}`,
        battle: { ...b, status: "patching", latestPatch: patch, activeGenerationId: `v${generation}`, integrity: Math.min(100, b.integrity + 25), shield: Math.min(100, b.shield + 30), mode: "patched" },
      };
      return { state: withLog(next, logEntry("patch", `PATCH ${patch.title}`, "info")), delay: DELAYS.patch };
    }
    case "patch_skipped":
      return { state: withLog({ ...state, narration: event.message }, logEntry("patch", `PATCH skipped: ${event.message}`, "warning")), delay: DELAYS.summary };
    case "train_step": {
      const lossPoints = [...state.lossPoints, { step: Number(p.step), loss: Number(p.loss) }];
      const next = { ...state, lossPoints, narration: event.message, battle: { ...b, status: "patching" as const } };
      const entry = Number(p.step) % 10 === 0 || Number(p.step) === 1 ? logEntry("patch", `ADAPTER ${event.message}`, "info") : null;
      return { state: entry ? withLog(next, entry) : next, delay: DELAYS.trainStep };
    }
    case "checkpoint_saved": {
      const generation = state.generation + 1;
      const next = { ...state, generation, narration: event.message, battle: { ...b, status: "upgraded" as const, activeGenerationId: `ckpt-${generation}`, integrity: Math.min(100, b.integrity + 25) } };
      return { state: withLog(next, logEntry("patch", `CHECKPOINT ${event.message}`, "success")), delay: DELAYS.patch };
    }
    case "regression_summary": {
      const next = {
        ...state,
        regression: p,
        narration: event.message,
        battle: { ...b, metrics: { ...b.metrics, failureRateBefore: p.before_failure_rate ?? 0, failureRateAfter: p.after_failure_rate ?? 0, robustnessGain: Math.round(((p.before_failure_rate ?? 0) - (p.after_failure_rate ?? 0)) * 10) / 10 } },
      };
      return { state: withLog(next, logEntry("wave", `REGRESSION ${event.message}`, "success")), delay: DELAYS.summary };
    }
    case "export_ready":
      return { state: withLog({ ...state, narration: event.message }, logEntry("export", `EXPORT ${event.message}`, "info")), delay: DELAYS.minor };
    case "run_completed": {
      const next = { ...state, finished: true, waves: state.waves.map((w) => ({ ...w, status: "done" as const })), narration: event.message, battle: { ...b, status: (b.status === "upgraded" ? "upgraded" : "completed") as BattleState["status"], currentAttackIndex: -1 } };
      return { state: withLog(next, logEntry("export", event.message, "success")), delay: DELAYS.minor };
    }
    case "error": {
      const next = { ...state, finished: true, failed: true, narration: `Run failed: ${event.message}`, battle: { ...b, status: "collapsed" as const } };
      return { state: withLog(next, logEntry("fail", `ERROR ${event.message}`, "danger")), delay: DELAYS.minor };
    }
    default:
      return { state: withLog(state, logEntry("wave", event.message || event.type, "info")), delay: DELAYS.minor };
  }
}

/** Apply a whole list instantly (used by "skip to results" and tests). */
export function applyAll(state: PlaybackState, events: RunEvent[]): PlaybackState {
  return events.reduce((s, e) => applyEvent(s, e).state, state);
}
