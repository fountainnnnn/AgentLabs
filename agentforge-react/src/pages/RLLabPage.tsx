import { useState, useCallback, useMemo, useRef } from "react";
import React from "react";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import TopNavigationBar from "@/components/layout/TopNavigationBar";
import ModelUploadPanel from "@/components/rl-lab/ModelUploadPanel";
import RewardSignalPanel from "@/components/rl-lab/RewardSignalPanel";
import TrainingOptimizationPanel from "@/components/rl-lab/TrainingOptimizationPanel";
import CheckpointGenerationsPanel from "@/components/rl-lab/CheckpointGenerationsPanel";
import TrainingLogPanel from "@/components/rl-lab/TrainingLogPanel";

const PixiArenaWrapper = React.lazy(() => import("@/components/arena/PixiArenaWrapper"));

import {
  createInitialRLLabState,
  MOCK_RL_LAB_WAVES,
  MOCK_RL_CHECKPOINTS,
  MOCK_REWARD_COMPONENTS,
} from "@/data/mockData";
import type {
  RLLabState,
  RLCheckpoint,
  BattleEvent,
  RewardComponents,
  WaveDefinition,
} from "@/types/agentforge";

/* ========================================================================== */
/*  Page Component                                                           */
/* ========================================================================== */

export default function RLLabPage() {
  const [rlState, setRLState] = useState<RLLabState>(
    createInitialRLLabState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    "[RL Lab] Environment initialized. Waiting for training command.",
  ]);
  const [animationPhase, setAnimationPhase] = useState("idle");
  const [speed, setSpeed] = useState(1);
  const [currentWave, setCurrentWave] = useState(1);
  const [autoRun, setAutoRun] = useState(true);
  const autoRunRef = useRef(autoRun);
  autoRunRef.current = autoRun;

  const appendLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /* ---- Derived Metrics ---- */

  const derivedMetrics = useMemo(() => {
    const bestReward = Math.max(
      rlState.rewardComponents.policyAdherence,
      rlState.rewardComponents.correctness,
      rlState.rewardComponents.refusalAccuracy,
      rlState.rewardComponents.toolSafety,
      rlState.rewardComponents.consistency,
    );
    return {
      totalReward: Math.round(rlState.rewardComponents.total * 10),
      bestSignal: bestReward,
      progress: rlState.trainingSteps > 0
        ? Math.round((rlState.currentStep / rlState.trainingSteps) * 100)
        : 0,
      checkpoints: rlState.checkpoints.length,
    };
  }, [rlState]);

  /* ---- Training Config for Optimization Panel ---- */

  const trainingConfig = useMemo(() => ({
    trainingSteps: rlState.trainingSteps,
    batchSize: rlState.batchSize,
    learningRate: 2e-5,
    adapterRank: rlState.adapterRank,
    checkpointInterval: 500,
    earlyStoppingPatience: 10,
  }), [rlState.trainingSteps, rlState.batchSize, rlState.adapterRank]);

  const trainingMetrics = useMemo(() => ({
    samplesPerSec: 42.5,
    tokensPerSec: 1280,
    memoryEstimate: "14.2 GB",
  }), []);

  /* ---- Ref for latest handleRunBatch (used by auto-chain) ---- */
  const handleRunBatchRef = useRef<(() => Promise<void>) | null>(null);

  /* ---- Handlers ---- */

  const handleRunBatch = useCallback(async () => {
    setIsRunning(true);
    setAnimationPhase("training");
    setRLState((s) => ({ ...s, status: "runningBatch" }));
    appendLog("Training batch started...");

    for (let ep = 1; ep <= 10; ep++) {
      await delay(300 / speed);
      const reward = Math.round(Math.random() * 40 + 60);
      const loss = Math.max(
        0,
        Math.round((Math.random() * 0.5 + 0.1) * 100) / 100,
      );
      setRLState((s) => ({
        ...s,
        currentStep: s.currentStep + 1,
        rewardComponents: {
          ...s.rewardComponents,
          total: s.rewardComponents.total + (reward - 50) / 100,
        },
      }));
      appendLog(
        `Episode ${ep}/10 - Reward: ${reward}, Loss: ${loss}`,
      );
    }

    // Each batch advances a wave
    setCurrentWave((w) => Math.min(w + 1, 20));

    setRLState((s) => ({ ...s, status: "completed" }));
    appendLog("Batch complete. Reward trend positive.");
    setAnimationPhase("idle");
    setIsRunning(false);

    // Auto-chain next batch if auto-run is on
    if (autoRunRef.current && currentWave < 20) {
      setTimeout(async () => {
        appendLog("Auto-starting next training batch...");
        await delay(2000);
        handleRunBatchRef.current?.();
      }, 0);
    }
  }, [speed, appendLog, currentWave]);
  handleRunBatchRef.current = handleRunBatch;

  const handleEvaluate = useCallback(async () => {
    setIsRunning(true);
    setAnimationPhase("training");
    setRLState((s) => ({ ...s, status: "evaluating" }));
    appendLog("Running checkpoint evaluation...");
    await delay(800 / speed);

    setRLState((s) => {
      const updatedCheckpoints = s.checkpoints.map((cp) =>
        cp.id === s.activeCheckpointId
          ? { ...cp, status: "completed" as const }
          : cp,
      );
      return {
        ...s,
        status: "completed",
        checkpoints: updatedCheckpoints,
      };
    });
    appendLog("Evaluation passed. Checkpoint saved.");
    setAnimationPhase("idle");
    setIsRunning(false);
  }, [speed, appendLog]);

  const handleTrainAdapter = useCallback(async () => {
    setIsRunning(true);
    setAnimationPhase("training");
    setRLState((s) => ({ ...s, status: "trainingAdapter" }));
    appendLog("Training LoRA adapter...");
    await delay(1200 / speed);

    setRLState((s) => ({
      ...s,
      status: "completed",
      checkpoints: [
        ...s.checkpoints,
        {
          id: `ckpt-${Date.now()}`,
          name: `Adapter Step ${s.checkpoints.length + 1}`,
          rewardScore: 0.7 + Math.random() * 0.15,
          failureRate: Math.max(5, Math.round((1 - Math.random() * 0.5) * 100)) / 100,
          refusalPrecision: Math.round((0.8 + Math.random() * 0.15) * 100) / 100,
          attackResistance: Math.round((0.7 + Math.random() * 0.2) * 100) / 100,
          consistencyScore: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
          status: "completed",
        },
      ],
      events: [
        ...s.events,
        {
          id: `evt-${Date.now()}`,
          timestamp: new Date().toTimeString().slice(0, 8),
          kind: "patch" as const,
          message: "Adapter training complete. Weights frozen.",
          severity: "info" as const,
        },
      ],
    }));
    appendLog("Adapter training complete. Weights frozen.");
    setAnimationPhase("idle");
    setIsRunning(false);
  }, [speed, appendLog]);

  const handleExport = useCallback(() => {
    const data = {
      model: rlState.modelName,
      adapter: `lora-adapter-v${rlState.checkpoints.length}`,
      episodes: rlState.currentStep,
      avgReward: Math.round(rlState.rewardComponents.total * 10) / 10,
      checkpoints: rlState.checkpoints.length,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rl_checkpoint_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog("Checkpoint exported.");
  }, [rlState, appendLog]);

  const handleUploadModel = useCallback(
    (_files: File[]) => {
      appendLog("Model files uploaded for training.");
    },
    [appendLog],
  );

  const handleSelectDemo = useCallback(() => {
    setRLState(createInitialRLLabState());
    setCurrentWave(1);
    appendLog("Demo configuration loaded.");
  }, [appendLog]);

  const handleSelectLocal = useCallback(
    (_path: string) => {
      appendLog("Local model path selected.");
    },
    [appendLog],
  );

  const handleUpdateConfig = useCallback(
    (_config: Partial<typeof trainingConfig>) => {
      appendLog("Training configuration updated.");
    },
    [appendLog],
  );

  const handleExportCheckpoint = useCallback(() => {
    handleExport();
  }, [handleExport]);

  const handleExportAdapter = useCallback(() => {
    const blob = new Blob(["dummy adapter binary"], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adapter.bin";
    a.click();
    URL.revokeObjectURL(url);
    appendLog("Adapter exported.");
  }, [appendLog]);

  const handleExportReport = useCallback(() => {
    handleExport();
  }, [handleExport]);

  const handleExportBundle = useCallback(() => {
    handleExport();
  }, [handleExport]);

  /* ---- RL Events adapter for TrainingLogPanel ---- */

  const rlEvents: BattleEvent[] = useMemo(
    () =>
      rlState.events.length > 0
        ? rlState.events
        : [
            {
              id: "rl-init",
              timestamp: new Date().toTimeString().slice(0, 8),
              kind: "wave",
              message: "RL Lab initialized. Ready for training.",
              severity: "info",
            },
          ],
    [rlState.events],
  );

  const arenaStatus = isRunning
    ? "running_wave"
    : animationPhase === "waveComplete"
      ? "completed"
      : "idle";

  return (
    <WorkspaceShell>
      <TopNavigationBar
        mode="RL Lab"
        onRunWave={handleRunBatch}
        onReplay={handleEvaluate}
        onApplyPatch={handleTrainAdapter}
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
          <ModelUploadPanel
            onUpload={handleUploadModel}
            onSelectDemo={handleSelectDemo}
            onSelectLocal={handleSelectLocal}
          />

          <DatasetPanel
            currentStep={rlState.currentStep}
            totalSteps={rlState.trainingSteps}
            checkpoints={rlState.checkpoints.length}
          />

          <RLHarnessArmyPanel
            status={rlState.status}
            checkpoints={rlState.checkpoints}
            activeId={rlState.activeCheckpointId}
          />

          <RewardSignalPanel components={rlState.rewardComponents} />

          <TrainingOptimizationPanel
            trainingConfig={trainingConfig}
            currentStep={rlState.currentStep}
            metrics={trainingMetrics}
            onUpdateConfig={handleUpdateConfig}
          />

          <CheckpointGenerationsPanel
            checkpoints={rlState.checkpoints}
            activeId={rlState.activeCheckpointId}
          />

          <TrainingLogPanel events={rlEvents} />

          <RLLabExportPanel
            onExportCheckpoint={handleExportCheckpoint}
            onExportAdapter={handleExportAdapter}
            onExportReport={handleExportReport}
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
          <div
            className="flex-1 flex flex-col p-4 gap-3"
            style={{ minHeight: 0 }}
          >
            {/* Arena Header */}
            <ArenaHeader
              label="RL Training Arena"
              defender="Base LLM + Safety Adapter"
              wave={currentWave}
              status={arenaStatus}
              elapsed={`Step ${rlState.currentStep}/${rlState.trainingSteps}`}
              accentColor="#7C3AED"
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
                battleState={{
                  status: arenaStatus as any,
                  currentWave,
                  currentAttackIndex: 0,
                  integrity: 100,
                  shield: 35,
                  score: derivedMetrics.totalReward,
                  mode: "initial",
                  generations: [],
                  attacks: [],
                  verifierRules: [],
                  events: rlEvents,
                  latestPatch: null,
                  metrics: {
                    failureRateBefore: 58,
                    failureRateAfter: 9,
                    robustnessGain: 49,
                    attacksTested: rlState.currentStep,
                    passed: rlState.currentStep,
                    failed: 0,
                    categoryBreakdown: [],
                  },
                  activeGenerationId: "gen-rl-0",
                }}
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
                    background: autoRun ? "#7C3AED" : "transparent",
                    color: autoRun ? "#FFFFFF" : "#575A60",
                    border: `1px solid ${autoRun ? "#7C3AED" : "#DCD8CC"}`,
                  }}
                >
                  {autoRun ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* Wave Ladder */}
            <WaveLadder
              waves={MOCK_RL_LAB_WAVES}
              currentWave={currentWave}
              accentColor="#7C3AED"
            />

            {/* Bottom Metrics (RL-specific) */}
            <LabMetricsRow
              currentStep={rlState.currentStep}
              totalSteps={rlState.trainingSteps}
              totalReward={derivedMetrics.totalReward}
              bestSignal={derivedMetrics.bestSignal}
              checkpoints={derivedMetrics.checkpoints}
            />

            {/* Export and Run Batch */}
            <ExportAndNextWavePanel
              onRunWave={handleRunBatch}
              onExportAgent={handleExportCheckpoint}
              onExportReport={handleExportReport}
              onExportBundle={handleExportBundle}
              isRunning={isRunning}
              accentColor="#7C3AED"
              runLabel="Run Batch"
            />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

/* ========================================================================== */
/*  Helpers                                                                  */
/* ========================================================================== */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ========================================================================== */
/*  INLINE SUB-COMPONENTS (Light Mode, RL-Specific)                          */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/*  DatasetPanel (Lavender Card)                                             */
/* -------------------------------------------------------------------------- */

function DatasetPanel({
  currentStep,
  totalSteps,
  checkpoints,
}: {
  currentStep: number;
  totalSteps: number;
  checkpoints: number;
}) {
  const progress =
    totalSteps > 0
      ? Math.min(100, (currentStep / totalSteps) * 100)
      : 0;

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#F4F1F8",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Dataset
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div
          className="flex flex-col gap-1 rounded-lg px-3 py-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            Status
          </span>
          <span
            className="text-[13px] font-semibold"
            style={{ color: currentStep > 0 ? "#21865A" : "#C77700" }}
          >
            {currentStep > 0 ? "Training" : "Ready"}
          </span>
        </div>
        <div
          className="flex flex-col gap-1 rounded-lg px-3 py-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            Checkpoints
          </span>
          <span
            className="text-[13px] font-semibold"
            style={{ color: "#7C3AED" }}
          >
            {checkpoints}
          </span>
        </div>
        <div
          className="flex flex-col gap-1 rounded-lg px-3 py-2 col-span-2"
          style={{ background: "#FDFDFD", border: "1px solid #DCD8CC" }}
        >
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            Categories
          </span>
          <span
            className="text-[11px]"
            style={{ color: "#575A60" }}
          >
            jailbreak, deceptive, unsafe compliance, correct refusal,
            hallucination, exfiltration, role confusion, tool safety,
            consistency, multi-turn, policy generalization, reward hacking
          </span>
        </div>
      </div>
      <div
        className="rounded-full overflow-hidden"
        style={{ background: "#DCD8CC", height: "4px" }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#7C3AED",
            borderRadius: "2px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  RLHarnessArmyPanel (Warm Card)                                           */
/* -------------------------------------------------------------------------- */

function RLHarnessArmyPanel({
  status,
  checkpoints,
  activeId,
}: {
  status: RLLabState["status"];
  checkpoints: RLCheckpoint[];
  activeId: string;
}) {
  const activeCheckpoint = checkpoints.find((c) => c.id === activeId);
  const totalGenerated = checkpoints.length * 50;

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#FBF5DF",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        RL Harness Army
      </span>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            Generated
          </span>
          <span
            className="text-[24px] font-bold font-mono"
            style={{ color: "#1D1D1F", lineHeight: 1.1 }}
          >
            {totalGenerated}
          </span>
        </div>
        <div className="flex flex-col">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            Checkpoints
          </span>
          <span
            className="text-[24px] font-bold font-mono"
            style={{ color: "#7C3AED", lineHeight: 1.1 }}
          >
            {checkpoints.length}
          </span>
        </div>
        <div className="flex flex-col">
          <span
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#7A7D85" }}
          >
            Status
          </span>
          <span
            className="text-[13px] font-bold font-mono mt-1"
            style={{
              color:
                status === "completed"
                  ? "#21865A"
                  : status === "runningBatch" ||
                      status === "computingRewards" ||
                      status === "trainingAdapter"
                    ? "#C77700"
                    : "#7A7D85",
            }}
          >
            {status === "idle"
              ? "Idle"
              : status === "runningBatch"
                ? "Training"
                : status === "computingRewards"
                  ? "Scoring"
                  : status === "trainingAdapter"
                    ? "Adapter"
                    : status === "evaluating"
                      ? "Eval"
                      : "Done"}
          </span>
        </div>
      </div>
      {activeCheckpoint && (
        <div
          className="flex items-center gap-2 text-[11px]"
          style={{ color: "#575A60" }}
        >
          <span className="font-semibold">Active:</span>
          <span style={{ color: "#7C3AED" }}>
            {activeCheckpoint.name}
          </span>
          <span style={{ color: "#21865A" }}>
            R: {activeCheckpoint.rewardScore.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  RLLabExportPanel (Cool Card)                                             */
/* -------------------------------------------------------------------------- */

function RLLabExportPanel({
  onExportCheckpoint,
  onExportAdapter,
  onExportReport,
  onExportBundle,
}: {
  onExportCheckpoint: () => void;
  onExportAdapter: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
}) {
  const buttons = [
    { label: "Export checkpoint.json", onClick: onExportCheckpoint },
    { label: "Export adapter.bin", onClick: onExportAdapter },
    { label: "Export report.json", onClick: onExportReport },
    { label: "Export bundle.zip", onClick: onExportBundle },
  ];

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#F2F8FC",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "8px",
      }}
    >
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Export
      </span>
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.onClick}
            className="h-9 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80"
            style={{
              background: "#FDFDFD",
              color: "#575A60",
              border: "1px solid #DCD8CC",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ArenaHeader (Light Mode, RL-Specific)                                    */
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
    status === "running_wave" || status === "patching";
  const dotColor = isActive
    ? "#C77700"
    : status === "completed"
      ? "#21865A"
      : "#7A7D85";

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
              animation: isActive
                ? "ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
                : "none",
            }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: dotColor }}
          />
        </span>
        <span
          className="text-[12px] font-bold tracking-tight"
          style={{ color: "#1D1D1F" }}
        >
          {label}
        </span>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
          style={{
            background: `${accentColor}12`,
            color: accentColor,
          }}
        >
          {defender}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="text-[13px] font-bold font-mono"
          style={{ color: accentColor }}
        >
          RL Wave {String(wave).padStart(2, "0")}
        </span>
        <span
          className="text-[10px] font-mono font-semibold uppercase tracking-wider"
          style={{ color: dotColor }}
        >
          {isActive ? "TRAINING" : status === "completed" ? "READY" : "IDLE"}
        </span>
      </div>

      <div className="text-[11px] font-mono tabular-nums" style={{ color: "#7A7D85" }}>
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
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "#7A7D85" }}
      >
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
/*  WaveLadder (Light Mode, RL-Specific)                                     */
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
        RL Wave Ladder
      </span>
      <div className="flex items-center gap-2">
        {waves.map((wave, idx) => {
          const isActive = wave.waveNumber === currentWave;
          const isPast = wave.waveNumber < currentWave;
          const isBoss = wave.isBossWave;
          return (
            <div
              key={wave.waveNumber}
              className="flex items-center gap-2 flex-1"
            >
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
                <div
                  style={{
                    width: "8px",
                    height: "1px",
                    background: "#DCD8CC",
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  LabMetricsRow (RL-Specific Bottom Metrics)                               */
/* -------------------------------------------------------------------------- */

function LabMetricsRow({
  currentStep,
  totalSteps,
  totalReward,
  bestSignal,
  checkpoints,
}: {
  currentStep: number;
  totalSteps: number;
  totalReward: number;
  bestSignal: number;
  checkpoints: number;
}) {
  const progress =
    totalSteps > 0
      ? Math.round((currentStep / totalSteps) * 100)
      : 0;

  const items = [
    {
      label: "Progress",
      value: progress,
      suffix: "%",
      color: "#1D1D1F",
    },
    {
      label: "Total Reward",
      value: totalReward,
      suffix: "pts",
      color: totalReward >= 0 ? "#21865A" : "#C2414B",
    },
    {
      label: "Best Signal",
      value: bestSignal.toFixed(1),
      suffix: "pts",
      color: "#0284C7",
    },
    {
      label: "Checkpoints",
      value: checkpoints,
      suffix: "saved",
      color: "#7C3AED",
    },
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
              style={{
                fontSize: "22px",
                color: item.color,
                lineHeight: 1.1,
              }}
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
/*  ExportAndNextWavePanel (Light Mode, RL-Specific)                         */
/* -------------------------------------------------------------------------- */

function ExportAndNextWavePanel({
  onRunWave,
  onExportAgent,
  onExportReport,
  onExportBundle,
  isRunning,
  accentColor,
  runLabel = "Run Wave",
}: {
  onRunWave: () => void;
  onExportAgent: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
  isRunning: boolean;
  accentColor: string;
  runLabel?: string;
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
          <ExportButton
            label="Export Checkpoint"
            onClick={onExportAgent}
            color={accentColor}
          />
          <ExportButton
            label="Export Report"
            onClick={onExportReport}
            color="#21865A"
          />
          <ExportButton
            label="Export Bundle"
            onClick={onExportBundle}
            color="#0284C7"
          />
        </div>
      </div>

      {/* Run Batch panel */}
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "#FAF9F6", border: "1px solid #DCD8CC" }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "#7A7D85" }}
        >
          Training
        </span>
        <p
          className="text-[12px]"
          style={{ color: "#575A60", margin: 0, lineHeight: 1.5 }}
        >
          Run the next training batch with current configuration.
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
          {isRunning ? "Training..." : runLabel}
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
