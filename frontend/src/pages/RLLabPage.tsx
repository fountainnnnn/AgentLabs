import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import TopNavigationBar from "@/components/layout/TopNavigationBar";
import {
  createInitialRLLabState,
  MOCK_RL_LAB_ARMY,
  MOCK_RL_LAB_WAVES,
} from "@/data/mockData";
import type {
  BattleEvent,
  BattleState,
  RLLabState,
  RLCheckpoint,
  RewardComponents,
  WaveDefinition,
} from "@/types/agentforge";

const PixiArenaWrapper = lazy(() => import("@/components/arena/PixiArenaWrapper"));

export default function RLLabPage() {
  const [rlState, setRLState] = useState<RLLabState>(() =>
    createInitialRLLabState(),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentWave, setCurrentWave] = useState(1);
  const [autoRun, setAutoRun] = useState(true);
  const [narration, setNarration] = useState(
    "Demo Simulation Mode ready. No OpenAI weights are trained.",
  );
  const autoRunRef = useRef(autoRun);
  autoRunRef.current = autoRun;

  const activeCheckpoint =
    rlState.checkpoints.find((checkpoint) => checkpoint.id === rlState.activeCheckpointId) ??
    rlState.checkpoints[0];

  const derivedMetrics = useMemo(() => {
    const bestSignal = Math.max(
      rlState.rewardComponents.policyAdherence,
      rlState.rewardComponents.correctness,
      rlState.rewardComponents.refusalAccuracy,
      rlState.rewardComponents.toolSafety,
      rlState.rewardComponents.consistency,
    );
    return {
      progress:
        rlState.trainingSteps > 0
          ? Math.round((rlState.currentStep / rlState.trainingSteps) * 100)
          : 0,
      totalReward: Math.round(rlState.rewardComponents.total * 10),
      bestSignal,
      checkpoints: rlState.checkpoints.length,
    };
  }, [rlState]);

  const handleSpawnHarnesses = useCallback(() => {
    setRLState((prev) => ({
      ...prev,
      harnessesGenerated: true,
      events: [
        ...prev.events,
        makeEvent("wave", `${MOCK_RL_LAB_ARMY.activeBatch.toLocaleString()} RL harnesses prepared`, "info"),
      ],
    }));
    setNarration("RL harnesses prepared for checkpoint evaluation.");
  }, []);

  const handleRunBatch = useCallback(async () => {
    setIsRunning(true);
    setNarration("Running adapter simulation batch.");
    setRLState((prev) => ({
      ...prev,
      status: "runningBatch",
      events: [
        ...prev.events,
        makeEvent("wave", "Training batch started in Adapter Simulation Mode", "info"),
      ],
    }));

    for (let episode = 1; episode <= 8; episode += 1) {
      await delay(250 / speed);
      setRLState((prev) => ({
        ...prev,
        currentStep: Math.min(prev.trainingSteps, prev.currentStep + 1),
        rewardComponents: {
          ...prev.rewardComponents,
          total: prev.rewardComponents.total + 0.08,
          refusalAccuracy: Math.min(1, prev.rewardComponents.refusalAccuracy + 0.005),
          hallucinationPenalty: prev.rewardComponents.hallucinationPenalty + 0.002,
        },
        events: [
          ...prev.events,
          makeEvent(
            "attack",
            `Episode ${episode}/8 scored reward and penalty signals`,
            episode % 3 === 0 ? "warning" : "success",
          ),
        ],
      }));
    }

    setCurrentWave((wave) => Math.min(20, wave + 1));
    setRLState((prev) => ({
      ...prev,
      status: "completed",
      events: [
        ...prev.events,
        makeEvent("pass", "Batch complete. Checkpoint metrics improved.", "success"),
      ],
    }));
    setNarration("Batch complete. Reward trace updated.");
    setIsRunning(false);
  }, [speed]);

  const handleEvaluate = useCallback(async () => {
    setIsRunning(true);
    setNarration("Evaluating active checkpoint.");
    setRLState((prev) => ({
      ...prev,
      status: "evaluating",
      events: [
        ...prev.events,
        makeEvent("attack", "Checkpoint evaluation batch started", "info"),
      ],
    }));
    await delay(700 / speed);
    setRLState((prev) => ({
      ...prev,
      status: "completed",
      checkpoints: prev.checkpoints.map((checkpoint) =>
        checkpoint.id === prev.activeCheckpointId
          ? { ...checkpoint, status: "completed" as const }
          : checkpoint,
      ),
      events: [
        ...prev.events,
        makeEvent("pass", "Checkpoint evaluation passed", "success"),
      ],
    }));
    setNarration("Checkpoint evaluation complete.");
    setIsRunning(false);
  }, [speed]);

  const handleTrainAdapter = useCallback(async () => {
    setIsRunning(true);
    setNarration("Simulating adapter update. Base weights remain unchanged.");
    setRLState((prev) => ({
      ...prev,
      status: "trainingAdapter",
      events: [
        ...prev.events,
        makeEvent("patch", "Adapter simulation started. Base model frozen.", "info"),
      ],
    }));
    await delay(900 / speed);
    setRLState((prev) => {
      const checkpoint: RLCheckpoint = {
        id: `ckpt-${Date.now()}`,
        name: `Adapter Simulation ${prev.checkpoints.length}`,
        rewardScore: 0.78,
        failureRate: 0.07,
        refusalPrecision: 0.94,
        attackResistance: 0.92,
        consistencyScore: 0.91,
        status: "completed",
      };
      return {
        ...prev,
        status: "completed",
        activeCheckpointId: checkpoint.id,
        checkpoints: [...prev.checkpoints, checkpoint],
        events: [
          ...prev.events,
          makeEvent("patch", "Adapter simulation checkpoint saved", "info"),
        ],
      };
    });
    setNarration("Adapter simulation checkpoint saved.");
    setIsRunning(false);
  }, [speed]);

  const handleExport = useCallback(() => {
    downloadJson("rl_training_report.json", {
      real_or_simulated: "adapter_simulation",
      not_trained_on_openai_weights: true,
      limitations: [
        "No OpenAI weights are trained or exported.",
        "Adapter artifact is simulated unless a local open-weight model is uploaded.",
      ],
      model: rlState.modelName,
      checkpoint: activeCheckpoint?.name,
      rewardComponents: rlState.rewardComponents,
    });
    setNarration("RL report exported with simulation metadata.");
  }, [activeCheckpoint?.name, rlState]);

  const syntheticBattleState = useMemo<BattleState>(() => ({
    status: isRunning ? "running_wave" : "idle",
    currentWave,
    currentAttackIndex: 0,
    integrity: 100,
    shield: 44,
    score: derivedMetrics.totalReward,
    mode: "initial",
    generations: [],
    attacks: [],
    verifierRules: [],
    events: rlState.events,
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
    activeGenerationId: "rl-demo",
  }), [currentWave, derivedMetrics.totalReward, isRunning, rlState.currentStep, rlState.events]);

  return (
    <WorkspaceShell>
      <TopNavigationBar
        mode="RL Lab"
        currentWave={currentWave}
        activeLabel={activeCheckpoint?.name ?? "Base Model"}
        harnessCount={MOCK_RL_LAB_ARMY.activeBatch}
        onSpawnHarnesses={handleSpawnHarnesses}
        onRunWave={handleRunBatch}
        onReplay={handleEvaluate}
        onApplyPatch={handleTrainAdapter}
        onExport={handleExport}
        isRunning={isRunning}
      />

      <main className="af-workspace">
        <aside className="af-left-panel" aria-label="RL Lab controls">
          <div className="af-left-panel-inner">
            <ModelSourcePanel onSelectDemo={() => {
              setRLState(createInitialRLLabState());
              setCurrentWave(1);
              setNarration("Demo Simulation Mode loaded.");
            }} />
            <DatasetPanel
              currentStep={rlState.currentStep}
              totalSteps={rlState.trainingSteps}
              checkpoints={rlState.checkpoints.length}
            />
            <ModeStatusPanel state={rlState} />
            <RLHarnessArmyPanel
              status={rlState.status}
              checkpoints={rlState.checkpoints}
              activeId={rlState.activeCheckpointId}
            />
            <RewardSignalPanel components={rlState.rewardComponents} />
            <TrainingOptimizationPanel
              currentStep={rlState.currentStep}
              totalSteps={rlState.trainingSteps}
              adapterRank={rlState.adapterRank}
              batchSize={rlState.batchSize}
            />
            <CheckpointPanel
              checkpoints={rlState.checkpoints}
              activeId={rlState.activeCheckpointId}
            />
            <TrainingLogPanel events={rlState.events} />
            <RLLabExportPanel onExport={handleExport} />
          </div>
        </aside>

        <section className="af-right-panel" aria-label="RL Lab simulation">
          <div className="af-simulation-grid">
            <SimulationHeader
              title="RL Training Arena"
              subtitle="Base LLM + Safety Adapter"
              status={rlState.status}
              narration={narration}
              accent="#7C3AED"
              modeLabel="Adapter Simulation Mode"
            />

            <div className="af-simulation-frame">
              <Suspense fallback={<ArenaFallback />}>
                <PixiArenaWrapper
                  battleState={syntheticBattleState}
                  className="h-full w-full"
                />
              </Suspense>
            </div>

            <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
              <SpeedAutoControls
                speed={speed}
                onSpeedChange={setSpeed}
                autoRun={autoRun}
                onAutoRunChange={setAutoRun}
                accent="#7C3AED"
              />
              <WaveLadder
                waves={MOCK_RL_LAB_WAVES}
                currentWave={currentWave}
                accent="#7C3AED"
              />
            </div>

            <MetricDock
              metrics={[
                ["Progress", derivedMetrics.progress, "%", "#1D1D1F"],
                ["Total Reward", derivedMetrics.totalReward, "pts", "#21865A"],
                ["Best Signal", derivedMetrics.bestSignal.toFixed(2), "pts", "#0284C7"],
                ["Checkpoints", derivedMetrics.checkpoints, "saved", "#7C3AED"],
              ]}
            />

            <ExportAndNextWave
              title="Export Artifacts"
              runTitle="Training"
              runCopy="Run the next adapter simulation batch with the current reward configuration."
              runLabel="Run Batch"
              isRunning={isRunning}
              accent="#7C3AED"
              onRun={handleRunBatch}
              onExportPrimary={handleExport}
              onExportReport={handleExport}
              onExportBundle={handleExport}
            />
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}

function Panel({
  title,
  children,
  className = "af-panel",
  meta,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  meta?: ReactNode;
}) {
  return (
    <section className={`${className} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="af-section-label">{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

function ModelSourcePanel({ onSelectDemo }: { onSelectDemo: () => void }) {
  return (
    <Panel title="Model Source" className="af-panel-lavender" meta={<span className="af-chip">Demo Simulation Mode</span>}>
      <div className="grid gap-2">
        {[
          ["Demo Simulation", "No model upload required"],
          ["Upload Model Folder", "config.json, weights, tokenizer files"],
          ["Local Path", "Filesystem path to open-weight model"],
        ].map(([label, description], index) => (
          <button
            key={label}
            type="button"
            onClick={index === 0 ? onSelectDemo : undefined}
            className="af-row-button min-h-12 px-3 py-2"
          >
            <span className="block text-[13px] font-semibold">{label}</span>
            <span className="block text-[12px] text-[#7A7D85]">{description}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onSelectDemo} className="af-button af-button-purple mt-3 w-full">
        Load Model
      </button>
    </Panel>
  );
}

function DatasetPanel({ currentStep, totalSteps, checkpoints }: { currentStep: number; totalSteps: number; checkpoints: number }) {
  const progress = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;
  return (
    <Panel title="Dataset" className="af-panel">
      <div className="grid grid-cols-2 gap-2">
        <MiniCell label="Status" value={currentStep > 0 ? "Training" : "Ready"} color={currentStep > 0 ? "#C77700" : "#21865A"} />
        <MiniCell label="Checkpoints" value={checkpoints} color="#7C3AED" />
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[#575A60]">
        jailbreak, deceptive instruction, unsafe compliance, correct refusal,
        hallucination, data exfiltration, tool safety, consistency, reward hacking
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#DCD8CC]">
        <span className="block h-full rounded-full bg-[#7C3AED]" style={{ width: `${progress}%` }} />
      </div>
    </Panel>
  );
}

function ModeStatusPanel({ state }: { state: RLLabState }) {
  return (
    <Panel title="Mode Status" className="af-panel-warm" meta={<span className="af-chip">Not OpenAI Weights</span>}>
      <div className="grid gap-2 text-[13px]">
        <FactRow label="Current mode" value="Adapter Simulation Mode" />
        <FactRow label="Base model" value={state.modelName} />
        <FactRow label="Frozen base" value={state.frozenBase ? "Yes" : "No"} />
        <FactRow label="Export truth" value="Simulated artifacts labeled" />
      </div>
    </Panel>
  );
}

function RLHarnessArmyPanel({ status, checkpoints, activeId }: { status: RLLabState["status"]; checkpoints: RLCheckpoint[]; activeId: string }) {
  const activeCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === activeId);
  return (
    <Panel title="RL Harness Army" className="af-panel-warm" meta={<span className="af-chip">{status}</span>}>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Generated" value={(checkpoints.length * 50).toLocaleString()} />
        <MiniStat label="Checkpoints" value={checkpoints.length} color="#7C3AED" />
        <MiniStat label="Active" value={MOCK_RL_LAB_ARMY.activeBatch} color="#0284C7" />
      </div>
      {activeCheckpoint && (
        <p className="mt-3 text-[12px] leading-5 text-[#575A60]">
          Active checkpoint: <span className="font-semibold text-[#1D1D1F]">{activeCheckpoint.name}</span>
        </p>
      )}
    </Panel>
  );
}

function RewardSignalPanel({ components }: { components: RewardComponents }) {
  const positives: [keyof RewardComponents, string][] = [
    ["policyAdherence", "policy"],
    ["correctness", "correctness"],
    ["refusalAccuracy", "refusal"],
    ["toolSafety", "tool safety"],
    ["consistency", "consistency"],
  ];
  const penalties: [keyof RewardComponents, string][] = [
    ["leakagePenalty", "leakage"],
    ["hallucinationPenalty", "hallucination"],
    ["unsafeCompliancePenalty", "unsafe"],
    ["rewardHackingPenalty", "reward hacking"],
  ];

  return (
    <Panel title="Reward Signal" className="af-panel-lavender" meta={<span className="af-chip">Weighted</span>}>
      <div className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2 text-[12px] leading-5 text-[#575A60]">
        <span className="font-semibold text-[#1D1D1F]">Final reward</span> = positive signals - penalties
      </div>
      <div className="mt-3 grid gap-1.5">
        {positives.map(([key, label]) => (
          <SignalRow key={key} label={label} value={components[key] as number} positive />
        ))}
        {penalties.map(([key, label]) => (
          <SignalRow key={key} label={label} value={components[key] as number} />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.08)] px-3 py-2">
        <span className="text-[12px] font-semibold text-[#7C3AED]">Total Reward</span>
        <span className="af-mono text-[16px] font-bold text-[#21865A]">{components.total.toFixed(2)}</span>
      </div>
    </Panel>
  );
}

function SignalRow({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-1.5 text-[12px]">
      <span className="capitalize text-[#575A60]">{label}</span>
      <span className="af-mono font-bold" style={{ color: positive ? "#21865A" : "#C2414B" }}>
        {positive ? "+" : "-"}{Math.abs(value).toFixed(2)}
      </span>
    </div>
  );
}

function TrainingOptimizationPanel({
  currentStep,
  totalSteps,
  adapterRank,
  batchSize,
}: {
  currentStep: number;
  totalSteps: number;
  adapterRank: number;
  batchSize: number;
}) {
  return (
    <Panel title="Training Optimization" className="af-panel-lavender">
      <div className="grid grid-cols-2 gap-2">
        <MiniCell label="Progress" value={`${currentStep}/${totalSteps}`} />
        <MiniCell label="Adapter Rank" value={adapterRank} color="#7C3AED" />
        <MiniCell label="Batch Size" value={batchSize} />
        <MiniCell label="Frozen Params" value="3.00B" color="#575A60" />
      </div>
    </Panel>
  );
}

function CheckpointPanel({ checkpoints, activeId }: { checkpoints: RLCheckpoint[]; activeId: string }) {
  return (
    <Panel title="Checkpoints" className="af-panel">
      <div className="grid gap-2">
        {checkpoints.map((checkpoint) => {
          const active = checkpoint.id === activeId;
          return (
            <div
              key={checkpoint.id}
              className="grid grid-cols-[minmax(0,1fr)_70px] gap-3 rounded-lg border px-3 py-2"
              style={{
                background: active ? "#F4F1F8" : "#FDFDFD",
                borderColor: active ? "rgba(124,58,237,0.28)" : "#DCD8CC",
              }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-[#1D1D1F]">{checkpoint.name}</span>
                <span className="block text-[12px] text-[#7A7D85]">{checkpoint.status}</span>
              </span>
              <span className="af-mono text-right text-[13px] font-bold text-[#21865A]">
                {checkpoint.rewardScore.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function TrainingLogPanel({ events }: { events: BattleEvent[] }) {
  return (
    <Panel title="Training Log" className="af-panel-cool" meta={<span className="af-chip">{events.length} events</span>}>
      <div className="af-log max-h-[240px] overflow-y-auto">
        {events.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#DCD8CC] bg-[#FDFDFD] px-3 py-4 text-center text-[13px] text-[#7A7D85]">
            Waiting for training to start.
          </div>
        )}
        {events.map((event) => (
          <div key={event.id} className="af-log-row">
            <span className="af-mono text-[#7A7D85]">{event.timestamp}</span>
            <span className="truncate">{event.message}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RLLabExportPanel({ onExport }: { onExport: () => void }) {
  return (
    <Panel title="Export Artifacts" className="af-panel-cool" meta={<span className="af-chip">not_trained_on_openai_weights</span>}>
      <p className="mb-3 text-[12px] leading-5 text-[#575A60]">
        RL exports include a model card, training report, reward trace, adapter config, and limitations.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {["model_card.json", "training_report.json", "reward_trace.json", "adapter_config.json"].map((label) => (
          <button key={label} type="button" onClick={onExport} className="af-button">
            Export {label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, color = "#1D1D1F" }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <span className="af-meta font-semibold">{label}</span>
      <span className="af-mono mt-1 block text-[24px] font-bold leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function MiniCell({ label, value, color = "#1D1D1F" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2">
      <span className="af-meta font-semibold">{label}</span>
      <span className="af-mono mt-1 block text-[18px] font-bold leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-t border-[#DCD8CC] pt-2">
      <span className="font-semibold text-[#575A60]">{label}</span>
      <span className="text-[#1D1D1F]">{value}</span>
    </div>
  );
}

function SimulationHeader({
  title,
  subtitle,
  status,
  narration,
  accent,
  modeLabel,
}: {
  title: string;
  subtitle: string;
  status: string;
  narration: string;
  accent: string;
  modeLabel: string;
}) {
  const active = status === "runningBatch" || status === "trainingAdapter" || status === "evaluating";
  return (
    <div className="af-panel-canvas flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[22px] font-semibold leading-none text-[#1D1D1F]">{title}</h1>
          <span className="af-chip" style={{ color: accent }}>{subtitle}</span>
          <span className="af-chip">{modeLabel}</span>
        </div>
        <p className="mt-2 truncate text-[13px] text-[#575A60]">{narration}</p>
      </div>
      <span className="af-status-chip">
        <span className="af-status-dot" style={{ background: active ? "#C77700" : "#21865A" }} />
        {active ? "Training" : "Ready"}
      </span>
    </div>
  );
}

function SpeedAutoControls({
  speed,
  onSpeedChange,
  autoRun,
  onAutoRunChange,
  accent,
}: {
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoRun: boolean;
  onAutoRunChange: (value: boolean) => void;
  accent: string;
}) {
  return (
    <div className="af-panel flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="af-section-label mr-1">Speed</span>
      {[0.5, 1, 2, 4].map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onSpeedChange(item)}
          className="af-button h-8 min-h-8 px-2 af-mono"
          style={{
            background: speed === item ? "#1D1D1F" : "#FDFDFD",
            color: speed === item ? "#FFFFFF" : "#575A60",
          }}
        >
          {item}x
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-[#DCD8CC]" aria-hidden="true" />
      <span className="af-section-label">Auto-Run</span>
      <button
        type="button"
        onClick={() => onAutoRunChange(!autoRun)}
        className="af-button h-8 min-h-8 px-3 af-mono"
        style={{
          background: autoRun ? accent : "#FDFDFD",
          borderColor: autoRun ? accent : "#DCD8CC",
          color: autoRun ? "#FFFFFF" : "#575A60",
        }}
      >
        {autoRun ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function WaveLadder({ waves, currentWave, accent }: { waves: WaveDefinition[]; currentWave: number; accent: string }) {
  return (
    <div className="af-panel-canvas overflow-x-auto p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="af-section-label">Wave Ladder</p>
        <span className="af-chip">20 waves</span>
      </div>
      <div className="grid min-w-[920px] gap-1" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
        {waves.map((wave) => {
          const active = wave.waveNumber === currentWave;
          const past = wave.waveNumber < currentWave;
          return (
            <div
              key={wave.waveNumber}
              className="rounded-lg border px-1 py-2 text-center"
              style={{
                background: active ? `${accent}14` : past ? "rgba(33,134,90,0.08)" : "#FDFDFD",
                borderColor: active ? `${accent}55` : "#DCD8CC",
              }}
            >
              <span className="af-mono block text-[13px] font-bold" style={{ color: active ? accent : past ? "#21865A" : "#7A7D85" }}>
                {String(wave.waveNumber).padStart(2, "0")}
              </span>
              <span className="mt-1 block text-[9px] font-semibold text-[#7A7D85]">
                {wave.isBossWave ? "BOSS" : wave.visibleEnemies}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricDock({ metrics }: { metrics: [string, string | number, string, string][] }) {
  return (
    <div className="af-metric-grid">
      {metrics.map(([label, value, suffix, color]) => (
        <div key={label} className="af-metric">
          <span className="af-metric-label">{label}</span>
          <span className="af-metric-value af-mono" style={{ color }}>
            {value}
            <span className="ml-1 text-[13px] font-semibold text-[#7A7D85]">{suffix}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function ExportAndNextWave({
  title,
  runTitle,
  runCopy,
  runLabel,
  isRunning,
  accent,
  onRun,
  onExportPrimary,
  onExportReport,
  onExportBundle,
}: {
  title: string;
  runTitle: string;
  runCopy: string;
  runLabel: string;
  isRunning: boolean;
  accent: string;
  onRun: () => void;
  onExportPrimary: () => void;
  onExportReport: () => void;
  onExportBundle: () => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <section className="af-panel-canvas p-4">
        <h2 className="af-section-label">{title}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={onExportPrimary} className="af-button">Export Checkpoint</button>
          <button type="button" onClick={onExportReport} className="af-button">Export Report</button>
          <button type="button" onClick={onExportBundle} className="af-button">Export Bundle</button>
        </div>
      </section>
      <section className="af-panel-canvas p-4">
        <h2 className="af-section-label">{runTitle}</h2>
        <p className="mt-2 text-[13px] leading-5 text-[#575A60]">{runCopy}</p>
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="af-button mt-3 w-full text-[14px]"
          style={{ background: accent, borderColor: accent, color: "#FFFFFF" }}
        >
          {isRunning ? "Training" : runLabel}
        </button>
      </section>
    </div>
  );
}

function ArenaFallback() {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center text-[13px] font-semibold text-[#7A7D85]">
      Loading arena renderer
    </div>
  );
}

function makeEvent(kind: BattleEvent["kind"], message: string, severity: BattleEvent["severity"]): BattleEvent {
  return {
    id: `rl-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toTimeString().slice(0, 8),
    kind,
    message,
    severity,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
