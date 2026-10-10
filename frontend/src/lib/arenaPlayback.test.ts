import { describe, expect, it } from "vitest";
import type { RunEvent } from "@/lib/api";
import { applyAll, applyEvent, arenaCategory, initialPlayback } from "@/lib/arenaPlayback";

let seq = 0;
const ev = (type: string, payload: Record<string, unknown> = {}, extra: Partial<RunEvent> = {}): RunEvent => ({
  seq: ++seq,
  type,
  wave: 1,
  phase: "pre_patch",
  message: type,
  payload,
  created_at: null,
  ...extra,
});

const cases = [
  { case_id: "a", category: "prompt_injection", severity: "high", prompt: "ignore" },
  { case_id: "b", category: "secret_leakage", severity: "critical", prompt: "leak" },
];

describe("arena playback", () => {
  it("maps backend categories onto arena sprites", () => {
    expect(arenaCategory("secret_leakage")).toBe("policy_extraction");
    expect(arenaCategory("multi_turn")).toBe("multi_turn_escalation");
    expect(arenaCategory("unknown_thing")).toBe("prompt_injection");
  });

  it("animates only real verdicts from case_result events", () => {
    let s = applyEvent(initialPlayback(), ev("wave_started", { cases })).state;
    expect(s.battle.attacks).toHaveLength(2);
    expect(s.battle.attacks.every((a) => a.status === "pending")).toBe(true);
    const step = applyEvent(s, ev("case_result", { case_id: "b", category: "secret_leakage", passed: false, failure_category: "secret_leakage" }));
    s = step.state;
    expect(step.delay).toBeGreaterThan(1000);
    expect(s.battle.currentAttackIndex).toBe(1);
    expect(s.battle.attacks[1].status).toBe("failed");
    expect(s.battle.metrics.failed).toBe(1);
    expect(s.battle.integrity).toBeLessThan(100);
  });

  it("tracks patches, generations, retests and the regression summary", () => {
    const s = applyAll(initialPlayback(), [
      ev("wave_started", { cases }),
      ev("case_result", { case_id: "a", passed: false, category: "prompt_injection" }),
      ev("case_result", { case_id: "b", passed: true, category: "secret_leakage" }),
      ev("wave_summary", { failed: 1, passed: 1 }),
      ev("patch_applied", { generation: 1, title: "v1: prompt guards", changes: { added_system_rules: ["[guard:injection] x"], tool_policies: {}, added_output_filters: [] } }),
      ev("retest_started", { cases }, { phase: "post_patch" }),
      ev("case_result", { case_id: "a", passed: true, category: "prompt_injection" }, { phase: "post_patch" }),
      ev("retest_summary", { after_failure_rate: 0 }, { phase: "post_patch" }),
      ev("regression_summary", { before_failure_rate: 50, after_failure_rate: 0 }, { phase: "regression" }),
      ev("run_completed", {}, { phase: "done" }),
    ]);
    expect(s.generation).toBe(1);
    expect(s.patches[0].addedRules).toHaveLength(1);
    expect(s.battle.activeGenerationId).toBe("v1");
    expect(s.waves[0]).toMatchObject({ wave: 1, preFailed: 1, postFailed: 0, patched: true });
    expect(s.regression?.after_failure_rate).toBe(0);
    expect(s.battle.metrics.robustnessGain).toBe(50);
    expect(s.finished).toBe(true);
  });

  it("records training loss and marks failures", () => {
    let s = applyAll(initialPlayback(), [ev("train_step", { step: 1, loss: 2.1 }), ev("train_step", { step: 2, loss: 1.7 }), ev("checkpoint_saved")]);
    expect(s.lossPoints).toEqual([{ step: 1, loss: 2.1 }, { step: 2, loss: 1.7 }]);
    expect(s.battle.activeGenerationId).toBe("ckpt-1");
    s = applyEvent(s, ev("error", {}, { message: "boom" })).state;
    expect(s.failed).toBe(true);
    expect(s.battle.status).toBe("collapsed");
  });
});
