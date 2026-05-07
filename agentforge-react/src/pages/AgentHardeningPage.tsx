import { useState, useCallback, useRef } from "react";
import React from "react";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import TopNavigationBar from "@/components/layout/TopNavigationBar";
import AgentSourcePanel from "@/components/agent-hardening/AgentSourcePanel";
import HarnessArmyPanel from "@/components/agent-hardening/HarnessArmyPanel";
import AgentExportPanel from "@/components/agent-hardening/AgentExportPanel";

const PixiArenaWrapper = React.lazy(() => import("@/components/arena/PixiArenaWrapper"));

import {
  createInitialAgentHardeningState,
  MOCK_AGENT_HARDENING_ARMY,
  MOCK_PATCH,
} from "@/data/mockData";
import type {
  BattleState,
  AttackScenario,
  AgentGeneration,
  AttackCategory,
  Severity,
  AttackStatus,
  WaveDefinition,
  RunMetrics,
  PatchSummary,
  BattleEvent,
} from "@/types/agentforge";

/* ========================================================================== */
/*  Page Component                                                           */
/* ========================================================================== */

export default function AgentHardeningPage() {
  const [battleState, setBattleState] = useState<BattleState>(
    createInitialAgentHardeningState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [narration, setNarration] = useState(
    "System ready. Awaiting wave execution.",
  );
  const [animationPhase, setAnimationPhase] = useState("idle");
  const [speed, setSpeed] = useState(1);
  const [autoRun, setAutoRun] = useState(true);
  const autoRunRef = useRef(autoRun);
  autoRunRef.current = autoRun;

  const army = MOCK_AGENT_HARDENING_ARMY;

  /* ---- Ref for latest handleRunWave (used by auto-chain) ---- */
  const handleRunWaveRef = useRef<((targetWave?: number) => Promise<void>) | null>(null);

  /* ---- Handlers ---- */

  const handleRunWave = useCallback(async (targetWave?: number | React.MouseEvent) => {
    setIsRunning(true);
    setNarration("Deploying attack wave...");
    setAnimationPhase("preparingWave");
    setBattleState((prev) => ({
      ...prev,
      status: "running_wave",
      currentAttackIndex: -1,
      attacks: [],
    }));

    await delay(800 / speed);
    setAnimationPhase("spawningEnemies");

    // Generate enemies for this wave (compute wave-waves inline for auto-chain)
    const wave = typeof targetWave === "number" ? targetWave : battleState.currentWave;
    const waveWaves = army.waves.filter((w) => w.waveNumber <= wave);
    const enemies = generateWaveEnemies(wave, waveWaves);
    await delay(600 / speed);

    setBattleState((prev) => ({
      ...prev,
      status: "running_wave",
      currentWave: wave,
      currentAttackIndex: -1,
      attacks: [...enemies],
      events: [
        ...prev.events,
        makeBattleEvent(
          "wave",
          `Wave ${prev.currentWave}: ${enemies.length} threats detected`,
          "info",
        ),
      ],
    }));

    // Execute each attack with full animation sequence
    for (let i = 0; i < enemies.length; i++) {
      if (battleState.integrity <= 0) break;

      const enemy = enemies[i];
      const outcome = determineOutcome(enemy);
      const resolvedStatus: AttackStatus =
        outcome === "blocked" ? "blocked" : "failed";

      setBattleState((prev) => ({
        ...prev,
        status: "running_wave",
        currentAttackIndex: i,
        attacks: prev.attacks.map((atk, idx) =>
          idx === i
            ? { ...atk, status: resolvedStatus, enemyState: "attacking" }
            : atk,
        ),
      }));
      setAnimationPhase("selectingEnemy");
      await delay(300 / speed);

      setAnimationPhase("enemyApproaching");
      await delay(800 / speed);

      setAnimationPhase("enemyWindup");
      await delay(400 / speed);

      setAnimationPhase("enemyAttacking");
      await delay(500 / speed);

      setAnimationPhase("projectileTravel");
      await delay(500 / speed);

      if (outcome === "blocked") {
        setAnimationPhase("blocked");
        setBattleState((prev) => ({
          ...prev,
          status: "attack_blocked",
          shield: Math.max(0, prev.shield - 4),
          score: prev.score + 10,
          attacks: prev.attacks.map((atk, idx) =>
            idx === i
              ? { ...atk, status: "blocked", enemyState: "blocked" }
              : atk,
          ),
          metrics: {
            ...prev.metrics,
            passed: prev.metrics.passed + 1,
            attacksTested: prev.metrics.attacksTested + 1,
          },
          events: [
            ...prev.events,
            makeBattleEvent(
              "pass",
              `${enemy.label} blocked by guardrails`,
              "success",
            ),
          ],
        }));
        setNarration(`${enemy.label} blocked by guardrails.`);
      } else {
        setAnimationPhase("damaged");
        setBattleState((prev) => ({
          ...prev,
          status: "attack_failed",
          integrity: Math.max(0, prev.integrity - 14),
          score: Math.max(0, prev.score - 15),
          attacks: prev.attacks.map((atk, idx) =>
            idx === i
              ? { ...atk, status: "failed", enemyState: "successful" }
              : atk,
          ),
          metrics: {
            ...prev.metrics,
            failed: prev.metrics.failed + 1,
            attacksTested: prev.metrics.attacksTested + 1,
          },
          events: [
            ...prev.events,
            makeBattleEvent(
              "fail",
              `${enemy.label} breached agent defenses`,
              "danger",
            ),
          ],
        }));
        setNarration(`${enemy.label} breached defenses.`);
      }

      await delay(500 / speed);

      setAnimationPhase("enemyDefeated");
      setBattleState((prev) => ({
        ...prev,
        attacks: prev.attacks.map((atk, idx) =>
          idx === i ? { ...atk, enemyState: "defeated" } : atk,
        ),
      }));
      await delay(600 / speed);
    }

    setAnimationPhase("waveComplete");
    setBattleState((prev) => ({
      ...prev,
      status: "completed",
      currentAttackIndex: -1,
      events: [
        ...prev.events,
        makeBattleEvent(
          "wave",
          `Wave ${prev.currentWave} complete. Score: ${prev.score}`,
          "info",
        ),
      ],
    }));
    setNarration(
      `Wave complete. ${battleState.metrics.failed} failures detected.`,
    );
    setIsRunning(false);

    // Auto-chain: if auto-run is on and we have more waves, advance after 2s
    if (autoRunRef.current && wave < 20 && battleState.integrity > 0) {
      const nextWave = wave + 1;
      const hasFailures = battleState.metrics.failed > 0;
      setTimeout(async () => {
        // Auto-patch if failures were detected in the completed wave
        if (hasFailures) {
          setAnimationPhase("patching");
          setNarration("Auto-patching defenses...");
          await delay(1200 / speed);
          setBattleState((prev) => ({
            ...prev,
            mode: "patched",
            latestPatch: MOCK_PATCH,
            activeGenerationId:
              prev.generations[Math.min(1, prev.generations.length - 1)].id,
            integrity: Math.min(100, prev.integrity + 25),
            shield: 75,
            score: prev.score + 50,
            events: [
              ...prev.events,
              makeBattleEvent("patch", "Auto-patch applied. Agent upgraded.", "info"),
            ],
          }));
          setNarration("Auto-patch applied.");
          await delay(1000 / speed);
        }

        setNarration(`Auto-advancing to wave ${nextWave}...`);
        setBattleState((prev) => ({
          ...prev,
          currentWave: nextWave,
          events: [
            ...prev.events,
            makeBattleEvent("wave", `Auto-proceeding to wave ${nextWave}`, "info"),
          ],
        }));
        await delay(2000);
        handleRunWaveRef.current?.(nextWave);
      }, 0);
    }
  }, [battleState, speed, army.waves]);
  handleRunWaveRef.current = handleRunWave;

  const handleApplyPatch = useCallback(async () => {
    setIsRunning(true);
    setAnimationPhase("patching");
    setNarration("Applying hardening patch...");
    setBattleState((prev) => ({
      ...prev,
      status: "patching",
    }));
    await delay(1200 / speed);

    setAnimationPhase("upgraded");
    setBattleState((prev) => ({
      ...prev,
      status: "upgraded",
      mode: "patched",
      latestPatch: MOCK_PATCH,
      activeGenerationId:
        prev.generations[
          Math.min(1, prev.generations.length - 1)
        ].id,
      integrity: Math.min(100, prev.integrity + 25),
      shield: 75,
      score: prev.score + 50,
      metrics: {
        ...prev.metrics,
        failureRateBefore: prev.metrics.failureRateAfter,
        failureRateAfter: Math.max(0, prev.metrics.failureRateAfter - 8),
        robustnessGain: 8,
      },
      events: [
        ...prev.events,
        makeBattleEvent("patch", "Patch applied. Agent upgraded.", "info"),
      ],
    }));
    setNarration("Patch applied. Agent upgraded.");
    await delay(1000 / speed);

    setBattleState((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        makeBattleEvent("export", "Checkpoint saved.", "info"),
      ],
    }));
    setAnimationPhase("idle");
    setIsRunning(false);
  }, [speed]);

  const handleReplay = useCallback(() => {
    if (battleState.attacks.length > 0) {
      setNarration(
        `Replaying: ${battleState.attacks[0].label}`,
      );
    }
  }, [battleState]);

  const handleExport = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            agent: "RefundBot",
            wave: battleState.currentWave,
            score: battleState.score,
            metrics: battleState.metrics,
            generations: battleState.generations,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agentforge_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNarration("Export complete.");
  }, [battleState]);

  const handleAttackClick = useCallback(
    (attackId: string) => {
      const atk = battleState.attacks.find((a) => a.id === attackId);
      if (atk) setNarration(`Inspecting: ${atk.label}`);
    },
    [battleState.attacks],
  );

  const handleExportAgent = useCallback(() => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            name: "RefundBot",
            version:
              battleState.generations.find(
                (g) => g.id === battleState.activeGenerationId,
              )?.version ?? "v1",
            patchType:
              battleState.generations.find(
                (g) => g.id === battleState.activeGenerationId,
              )?.patchType ?? "none",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hardened_agent.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [battleState]);

  const handleExportReport = useCallback(() => {
    handleExport();
  }, [handleExport]);

  const handleExportRunner = useCallback(() => {
    const content = `#!/usr/bin/env python3\n# AgentForge Hardened Runner\n# Generated for: RefundBot\nimport json\n\nprint("AgentForge hardened agent runner ready.")\n`;
    const blob = new Blob([content], { type: "text/python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "runner.py";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportBundle = useCallback(() => {
    handleExport();
  }, [handleExport]);

  const handleUploadAgent = useCallback(() => {
    setNarration("Upload agent.json - feature ready in production.");
  }, []);

  const handleLoadDemo = useCallback(() => {
    setBattleState(createInitialAgentHardeningState());
    setNarration("Demo RefundBot loaded.");
  }, []);

  /* ---- Severity distribution ---- */

  const severityDist = army.categories.map((c) => ({
    label: c.severity,
    count: c.count,
    color:
      c.severity === "critical"
        ? "#C2414B"
        : c.severity === "high"
          ? "#C77700"
          : c.severity === "medium"
            ? "#2563EB"
            : "#7A7D85",
  }));

  /* ---- Status for arena ---- */

  const arenaStatus = isRunning
    ? "running_wave"
    : animationPhase === "waveComplete"
      ? "completed"
      : battleState.integrity <= 0
        ? "collapsed"
        : "idle";

  return (
    <WorkspaceShell>
      <TopNavigationBar
        mode="Agent Hardening"
        onRunWave={handleRunWave}
        onReplay={handleReplay}
        onApplyPatch={handleApplyPatch}
        onExport={handleExport}
        isRunning={isRunning}
      />

      <div className="flex flex-1 w-full overflow-hidden">
        {/* ================================================================ */}
        {/* LEFT PANEL (440px)                                              */}
        {/* ================================================================ */}
        <div
          className="flex-shrink-0 overflow-y-auto flex flex-col"
          style={{
            width: "440px",
            maxHeight: "calc(100vh - 52px)",
            background: "#FAF9F6",
            borderRight: "1px solid #DCD8CC",
            padding: "14px",
            gap: "14px",
            scrollbarWidth: "thin",
            scrollbarColor: "#DCD8CC transparent",
          }}
        >
          <AgentSourcePanel
            agentName="RefundBot Agent"
            systemPromptStatus="loaded"
            toolSchemaStatus="loaded"
            runtimeMode="deterministic"
            onLoadDemo={handleLoadDemo}
            onUploadAgent={handleUploadAgent}
          />

          <HarnessArmyPanel
            totalHarnesses={army.totalGenerated}
            activeWaveHarnesses={army.activeBatch}
            categoriesCount={army.categoryCount}
            severityDistribution={severityDist}
            waves={army.waves}
            currentWave={battleState.currentWave}
          />

          <AgentGenerationsPanel
            generations={battleState.generations}
            activeId={battleState.activeGenerationId}
          />

          <AttackQueuePanel
            attacks={battleState.attacks}
            onAttackClick={handleAttackClick}
          />

          <EvaluationLogPanel
            metrics={battleState.metrics}
            currentWave={battleState.currentWave}
          />

          <LatestPatchPanel patch={battleState.latestPatch} />

          <AgentExportPanel
            onExportAgent={handleExportAgent}
            onExportReport={handleExportReport}
            onExportRunner={handleExportRunner}
            onExportBundle={handleExportBundle}
          />
        </div>

        {/* ================================================================ */}
        {/* RIGHT PANEL (flex-1)                                            */}
        {/* ================================================================ */}
        <div
          className="flex-1 flex flex-col overflow-y-auto"
          style={{ background: "#FCFCF7" }}
        >
          <div className="flex-1 flex flex-col p-4 gap-3" style={{ minHeight: 0 }}>
            {/* Arena Header */}
            <ArenaHeader
              label="Agent Hardening Arena"
              defender="RefundBot Agent"
              wave={battleState.currentWave}
              status={arenaStatus}
              elapsed={narration}
              accentColor="#2563EB"
            />

            {/* Pixi Arena */}
            <div
              className="flex-1 rounded-xl overflow-hidden"
              style={{
                background: "#FAF9F6",
                border: "1px solid #DCD8CC",
                minHeight: "320px",
                maxHeight: "55vh",
              }}
            >
              <PixiArenaWrapper
                battleState={battleState}
                onAnimationComplete={(e) => {}}
                className="w-full h-full"
              />
            </div>

            {/* Arena Speed Controls + Auto-Run Toggle */}
            <div className="flex items-center gap-3 flex-wrap">
              <ArenaSpeedControls speed={speed} onSpeedChange={setSpeed} />
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
                  Auto-Run
                </span>
                <button
                  type="button"
                  onClick={() => setAutoRun((v) => !v)}
                  className="rounded px-2 py-0.5 text-[11px] font-semibold font-mono transition-all"
                  style={{
                    background: autoRun ? "#2563EB" : "transparent",
                    color: autoRun ? "#FFFFFF" : "#575A60",
                    border: `1px solid ${autoRun ? "#2563EB" : "#DCD8CC"}`,
                  }}
                >
                  {autoRun ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* Wave Ladder */}
            <WaveLadder
              waves={army.waves}
              currentWave={battleState.currentWave}
              accentColor="#2563EB"
            />

            {/* Bottom Metrics Row */}
            <BottomMetricsRow metrics={battleState.metrics} />

            {/* Export and Next Wave */}
            <ExportAndNextWavePanel
              onRunWave={handleRunWave}
              onExportAgent={handleExportAgent}
              onExportReport={handleExportReport}
              onExportBundle={handleExportBundle}
              isRunning={isRunning}
              accentColor="#2563EB"
            />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

/* ========================================================================== */
/*  Helper Functions                                                         */
/* ========================================================================== */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let eventCounter = 0;

function makeBattleEvent(
  kind: BattleEvent["kind"],
  message: string,
  severity: BattleEvent["severity"] = "info",
): BattleEvent {
  eventCounter++;
  return {
    id: `evt-${eventCounter}`,
    timestamp: new Date().toTimeString().slice(0, 8),
    kind,
    message,
    severity,
  };
}

function generateWaveEnemies(
  waveNumber: number,
  currentWaves: WaveDefinition[],
): AttackScenario[] {
  const categories: AttackCategory[] = [
    "prompt_injection",
    "role_impersonation",
    "emotional_manipulation",
    "tool_abuse",
    "policy_extraction",
    "multi_turn_escalation",
  ];
  const count = Math.min(3 + waveNumber, 8);
  const enemies: AttackScenario[] = [];

  const waveDef = currentWaves.find((w) => w.waveNumber === waveNumber);

  for (let i = 0; i < count; i++) {
    const cat = categories[i % categories.length];
    enemies.push({
      id: `enemy-w${waveNumber}-${i}`,
      category: cat,
      label: `${cat.replace(/_/g, " ")} Attack #${i + 1}`,
      severity: (
        i >= count - 2
          ? "critical"
          : i % 3 === 0
            ? "high"
            : i % 2 === 0
              ? "medium"
              : "low"
      ) as Severity,
      prompt: `Attempt to ${cat.replace(/_/g, " ")} through technique ${i + 1}`,
      status: "pending" as AttackStatus,
      enemyState: "idle",
    });
  }

  if (waveDef?.isBossWave && enemies.length > 0) {
    const boss = enemies[enemies.length - 1];
    boss.severity = "critical";
    boss.label = `BOSS: ${boss.label}`;
  }

  return enemies;
}

function determineOutcome(
  attack: AttackScenario,
): "blocked" | "damaged" {
  const FAILING = [
    "prompt_injection",
    "role_impersonation",
    "policy_extraction",
  ];
  if (FAILING.includes(attack.category)) return "damaged";
  return "blocked";
}

/* ========================================================================== */
/*  INLINE SUB-COMPONENTS (Light Mode)                                       */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  AgentGenerationsPanel                                                    */
/* -------------------------------------------------------------------------- */

function AgentGenerationsPanel({
  generations,
  activeId,
}: {
  generations: AgentGeneration[];
  activeId: string;
}) {
  return (
    <div className="flex flex-col gap-2" style={{ background: "#F2F8FC", border: "1px solid #DCD8CC", borderRadius: "12px", padding: "12px" }}>
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Agent Generations
      </span>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {generations.map((gen) => {
          const isActive = gen.id === activeId;
          const statusColor =
            gen.status === "active"
              ? "#2563EB"
              : gen.status === "patched"
                ? "#7C3AED"
                : gen.status === "final"
                  ? "#21865A"
                  : "#C2414B";
          return (
            <div
              key={gen.id}
              className="flex-shrink-0 rounded-lg flex flex-col items-center py-2 px-2 transition-all"
              style={{
                width: "90px",
                background: "#FDFDFD",
                border: isActive
                  ? `1px solid ${statusColor}`
                  : "1px solid #DCD8CC",
                boxShadow: isActive
                  ? `0 0 6px ${statusColor}30`
                  : "none",
              }}
            >
              <span className="text-[11px] font-mono font-bold" style={{ color: "#1D1D1F" }}>
                {gen.version}
              </span>
              <span className="text-[9px] font-medium mt-0.5 text-center" style={{ color: "#575A60" }}>
                {gen.name}
              </span>
              <div className="flex items-center gap-1 mt-1">
                <div className="rounded-full" style={{ width: "5px", height: "5px", background: statusColor }} />
                <span className="text-[8px] uppercase tracking-wider" style={{ color: "#7A7D85" }}>
                  {gen.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AttackQueuePanel                                                         */
/* -------------------------------------------------------------------------- */

const CATEGORY_COLORS: Record<AttackCategory, string> = {
  prompt_injection: "#C2414B",
  role_impersonation: "#7C3AED",
  emotional_manipulation: "#C77700",
  tool_abuse: "#C77700",
  policy_extraction: "#0284C7",
  multi_turn_escalation: "#C2414B",
};

const SEVERITY_BG: Record<Severity, string> = {
  low: "rgba(122,125,133,0.12)",
  medium: "rgba(199,119,0,0.12)",
  high: "rgba(194,65,75,0.12)",
  critical: "rgba(194,65,75,0.2)",
};

const SEVERITY_COLOR: Record<Severity, string> = {
  low: "#7A7D85",
  medium: "#C77700",
  high: "#C2414B",
  critical: "#C2414B",
};

const STATUS_STYLE: Record<string, { text: string; color: string }> = {
  pending: { text: "PENDING", color: "#7A7D85" },
  running: { text: "RUNNING", color: "#C77700" },
  blocked: { text: "BLOCKED", color: "#2563EB" },
  failed: { text: "FAILED", color: "#C2414B" },
  passed: { text: "PASSED", color: "#21865A" },
};

function AttackQueuePanel({
  attacks,
  onAttackClick,
}: {
  attacks: AttackScenario[];
  onAttackClick: (attackId: string) => void;
}) {
  return (
    <div
      className="flex flex-col gap-2"
      style={{ background: "#F2F8FC", border: "1px solid #DCD8CC", borderRadius: "12px", padding: "12px" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Attack Queue
        </span>
        <span
          className="text-[10px] font-semibold rounded-full px-2 py-0.5"
          style={{ background: "#FDFDFD", color: "#7A7D85", border: "1px solid #DCD8CC" }}
        >
          {attacks.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {attacks.map((atk) => {
          const dotColor = CATEGORY_COLORS[atk.category] || "#7A7D85";
          const sevBg = SEVERITY_BG[atk.severity] || "rgba(122,125,133,0.12)";
          const sevColor = SEVERITY_COLOR[atk.severity] || "#7A7D85";
          const statusInfo = STATUS_STYLE[atk.status] || STATUS_STYLE.pending;
          return (
            <button
              key={atk.id}
              type="button"
              onClick={() => onAttackClick(atk.id)}
              className="w-full flex items-center rounded-lg transition-all text-left cursor-pointer"
              style={{
                height: "44px",
                padding: "0 10px",
                background: "#FDFDFD",
                border: "1px solid #DCD8CC",
              }}
            >
              <div
                className="rounded flex-shrink-0"
                style={{
                  width: "10px",
                  height: "10px",
                  background: dotColor,
                  opacity: 0.85,
                  marginRight: "10px",
                  borderRadius: "3px",
                }}
              />
              <span className="text-[13px] font-medium truncate flex-1" style={{ color: "#1D1D1F" }}>
                {atk.label}
              </span>
              <span
                className="rounded-full text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 flex-shrink-0"
                style={{ background: sevBg, color: sevColor, marginRight: "8px" }}
              >
                {atk.severity}
              </span>
              <span className="text-[10px] font-semibold tracking-wider flex-shrink-0" style={{ color: statusInfo.color, width: "56px", textAlign: "right" }}>
                {statusInfo.text}
              </span>
            </button>
          );
        })}
        {attacks.length === 0 && (
          <div className="py-4 text-center text-[12px]" style={{ color: "#7A7D85" }}>
            No attacks yet. Run a wave to populate.
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  EvaluationLogPanel                                                       */
/* -------------------------------------------------------------------------- */

function EvaluationLogPanel({
  metrics,
  currentWave,
}: {
  metrics: RunMetrics;
  currentWave: number;
}) {
  const passRatio =
    metrics.attacksTested > 0
      ? Math.round((metrics.passed / metrics.attacksTested) * 100)
      : 0;
  const failRatio =
    metrics.attacksTested > 0
      ? Math.round((metrics.failed / metrics.attacksTested) * 100)
      : 0;

  return (
    <div
      className="flex flex-col gap-2"
      style={{ background: "#F2F8FC", border: "1px solid #DCD8CC", borderRadius: "12px", padding: "12px" }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Evaluation Log
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Attacks Tested
          </span>
          <span className="text-[20px] font-bold font-mono block" style={{ color: "#1D1D1F", lineHeight: 1.2 }}>
            {metrics.attacksTested}
          </span>
        </div>
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Current Wave
          </span>
          <span className="text-[20px] font-bold font-mono block" style={{ color: "#2563EB", lineHeight: 1.2 }}>
            {currentWave}
          </span>
        </div>
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Pass Rate
          </span>
          <span className="text-[20px] font-bold font-mono block" style={{ color: "#21865A", lineHeight: 1.2 }}>
            {passRatio}%
          </span>
        </div>
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Failure Rate
          </span>
          <span className="text-[20px] font-bold font-mono block" style={{ color: "#C2414B", lineHeight: 1.2 }}>
            {failRatio}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  LatestPatchPanel                                                         */
/* -------------------------------------------------------------------------- */

function LatestPatchPanel({ patch }: { patch: PatchSummary | null }) {
  if (!patch) {
    return (
      <div
        className="flex flex-col gap-2"
        style={{ background: "#F4F1F8", border: "1px solid #DCD8CC", borderRadius: "12px", padding: "12px" }}
      >
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Latest Patch
        </span>
        <div className="rounded-lg flex items-center justify-center py-3" style={{ background: "#FDFDFD", border: "1px dashed #DCD8CC" }}>
          <span className="text-[13px]" style={{ color: "#7A7D85" }}>
            No patches applied
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-2"
      style={{ background: "#F4F1F8", border: "1px solid #DCD8CC", borderRadius: "12px", padding: "12px" }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Latest Patch
      </span>
      <div className="rounded-lg px-3 py-2" style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="rounded-full text-[10px] font-bold px-2 py-0.5"
            style={{ background: "rgba(124,58,237,0.12)", color: "#7C3AED" }}
          >
            {patch.patchType}
          </span>
          <div className="flex items-center gap-1">
            <div className="rounded-full" style={{ width: "5px", height: "5px", background: "#21865A" }} />
            <span className="text-[10px] font-semibold uppercase" style={{ color: "#21865A" }}>
              Applied
            </span>
          </div>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: "#575A60" }}>
          {patch.addedRules[0] || patch.title}
        </p>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[11px] font-bold font-mono" style={{ color: "#21865A" }}>
            +12% Survival
          </span>
          <span className="text-[11px] font-bold font-mono" style={{ color: "#21865A" }}>
            -8% Damage
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ArenaHeader                                                              */
/* -------------------------------------------------------------------------- */

function ArenaHeader({
  label,
  defender,
  wave,
  status,
  elapsed,
  accentColor,
}: {
  label: string;
  defender: string;
  wave: number;
  status: string;
  elapsed: string;
  accentColor: string;
}) {
  const isActive =
    status === "running_wave" || status === "patching" || status === "blocked" || status === "damaged";
  const dotColor = isActive ? "#C77700" : status === "completed" ? "#21865A" : "#7A7D85";

  return (
    <div
      className="flex items-center justify-between px-4 flex-shrink-0 rounded-xl"
      style={{
        height: "44px",
        background: "#FAF9F6",
        border: "1px solid #DCD8CC",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{
              background: dotColor,
              animation: isActive ? "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" : "none",
            }}
          />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: dotColor }} />
        </span>
        <span className="text-[12px] font-bold tracking-tight" style={{ color: "#1D1D1F" }}>
          {label}
        </span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${accentColor}12`, color: accentColor }}>
          {defender}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[13px] font-bold font-mono" style={{ color: accentColor }}>
          Wave {String(wave).padStart(2, "0")}
        </span>
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: dotColor }}>
          {status === "idle" ? "IDLE" : status === "running_wave" ? "RUNNING" : status === "completed" ? "COMPLETE" : status === "collapsed" ? "COLLAPSED" : status.toUpperCase()}
        </span>
      </div>

      <div
        className="text-[11px] font-medium truncate max-w-[280px]"
        style={{ color: "#7A7D85" }}
        title={elapsed}
      >
        {elapsed}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ArenaSpeedControls                                                       */
/* -------------------------------------------------------------------------- */

function ArenaSpeedControls({
  speed,
  onSpeedChange,
}: {
  speed: number;
  onSpeedChange: (s: number) => void;
}) {
  const speeds = [0.5, 1, 2, 4];
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg self-start"
      style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
        Speed
      </span>
      {speeds.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onSpeedChange(s)}
          className="rounded px-2 py-0.5 text-[11px] font-semibold font-mono transition-all"
          style={{
            background: speed === s ? "#1D1D1F" : "transparent",
            color: speed === s ? "#FFFFFF" : "#575A60",
          }}
        >
          {s}x
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  WaveLadder (Light Mode)                                                  */
/* -------------------------------------------------------------------------- */

function WaveLadder({
  waves,
  currentWave,
  accentColor,
}: {
  waves: WaveDefinition[];
  currentWave: number;
  accentColor: string;
}) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#FAF9F6",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "8px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Wave Ladder
      </span>
      <div className="flex items-center gap-2">
        {waves.map((wave, idx) => {
          const isActive = wave.waveNumber === currentWave;
          const isPast = wave.waveNumber < currentWave;
          const isBoss = wave.isBossWave;
          return (
            <div key={wave.waveNumber} className="flex items-center gap-2 flex-1">
              <div
                className="flex-1 rounded-lg flex flex-col items-center py-2 transition-all"
                style={{
                  background: isActive
                    ? `${accentColor}12`
                    : isPast
                      ? "rgba(33, 134, 90, 0.06)"
                      : "#FDFDFD",
                  border: isActive
                    ? `1px solid ${accentColor}50`
                    : isBoss
                      ? "1px solid rgba(194, 65, 75, 0.2)"
                      : "1px solid #DCD8CC",
                }}
              >
                <span
                  className="text-[13px] font-bold font-mono"
                  style={{
                    color: isActive
                      ? accentColor
                      : isPast
                        ? "#21865A"
                        : "#7A7D85",
                  }}
                >
                  {wave.waveNumber}
                </span>
                <span
                  className="text-[9px] uppercase tracking-wider font-semibold mt-0.5"
                  style={{
                    color: isBoss
                      ? "#C2414B"
                      : isActive
                        ? accentColor
                        : "#7A7D85",
                  }}
                >
                  {isBoss ? "BOSS" : wave.harnessCount + " atk"}
                </span>
              </div>
              {idx < waves.length - 1 && (
                <div style={{ width: "8px", height: "1px", background: "#DCD8CC", flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  BottomMetricsRow (Light Mode)                                            */
/* -------------------------------------------------------------------------- */

function BottomMetricsRow({ metrics }: { metrics: RunMetrics }) {
  const totalReward = Math.round(metrics.robustnessGain * 10);
  const survivalTime = metrics.attacksTested * 4;
  const winRatePct = Math.round(
    (metrics.passed / Math.max(metrics.attacksTested, 1)) * 100,
  );
  const damageTaken = metrics.failed;

  const items = [
    { label: "Total Reward", value: totalReward, suffix: "pts", color: "#21865A" },
    { label: "Survival Time", value: survivalTime, suffix: "s", color: "#0284C7" },
    { label: "Win Rate", value: winRatePct, suffix: "%", color: "#21865A" },
    { label: "Damage Taken", value: damageTaken, suffix: "hits", color: "#C2414B" },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl p-3 flex flex-col gap-1"
          style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            {item.label}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="font-bold font-mono"
              style={{ fontSize: "22px", color: item.color, lineHeight: 1.1 }}
            >
              {item.value}
            </span>
            <span className="text-[12px] font-mono" style={{ color: "#7A7D85" }}>
              {item.suffix}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ExportAndNextWavePanel (Light Mode)                                       */
/* -------------------------------------------------------------------------- */

function ExportAndNextWavePanel({
  onRunWave,
  onExportAgent,
  onExportReport,
  onExportBundle,
  isRunning,
  accentColor,
}: {
  onRunWave: () => void;
  onExportAgent: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
  isRunning: boolean;
  accentColor: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Export panel */}
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "#7A7D85" }}
        >
          Export & Share
        </span>
        <div className="flex flex-col gap-2">
          <ExportButton label="Export Agent" onClick={onExportAgent} color={accentColor} />
          <ExportButton label="Export Report" onClick={onExportReport} color="#21865A" />
          <ExportButton label="Export Bundle" onClick={onExportBundle} color="#0284C7" />
        </div>
      </div>

      {/* Next Wave panel */}
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "#7A7D85" }}
        >
          Next Wave
        </span>
        <p className="text-[12px]" style={{ color: "#575A60", margin: 0, lineHeight: 1.5 }}>
          Run the next wave of adversarial attacks against the current agent
          generation.
        </p>
        <button
          onClick={onRunWave}
          disabled={isRunning}
          className="w-full rounded-lg font-bold text-base transition-all disabled:cursor-not-allowed"
          style={{
            height: "48px",
            background: isRunning ? `${accentColor}60` : accentColor,
            color: "#FFFFFF",
            border: "none",
            opacity: isRunning ? 0.6 : 1,
          }}
        >
          {isRunning ? "Running..." : "Run Wave"}
        </button>
      </div>
    </div>
  );
}

function ExportButton({
  label,
  onClick,
  color,
}: {
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all hover:opacity-80 px-3"
      style={{
        height: "40px",
        background: "#FDFDFD",
        border: "1px solid #DCD8CC",
        color: "#575A60",
      }}
    >
      <span
        className="rounded flex-shrink-0"
        style={{
          width: "14px",
          height: "14px",
          background: color,
          opacity: 0.7,
        }}
      />
      <span>{label}</span>
    </button>
  );
}
