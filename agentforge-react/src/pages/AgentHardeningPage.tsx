import { Suspense, lazy, useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import TopNavigationBar from "@/components/layout/TopNavigationBar";
import {
  createInitialAgentHardeningState,
  MOCK_AGENT_HARDENING_ARMY,
  MOCK_PATCH,
} from "@/data/mockData";
import type {
  AgentGeneration,
  AttackCategory,
  AttackScenario,
  AttackStatus,
  BattleEvent,
  BattleState,
  PatchSummary,
  RunMetrics,
  Severity,
  WaveDefinition,
} from "@/types/agentforge";

const PixiArenaWrapper = lazy(() => import("@/components/arena/PixiArenaWrapper"));

export default function AgentHardeningPage() {
  const [battleState, setBattleState] = useState<BattleState>(() =>
    createInitialAgentHardeningState(),
  );
  const [isRunning, setIsRunning] = useState(false);
  const [narration, setNarration] = useState(
    "RefundBot demo loaded. Awaiting adversarial wave.",
  );
  const [speed, setSpeed] = useState(1);
  const [autoRun, setAutoRun] = useState(true);
  const autoRunRef = useRef(autoRun);
  autoRunRef.current = autoRun;

  const army = MOCK_AGENT_HARDENING_ARMY;
  const activeGeneration =
    battleState.generations.find((g) => g.id === battleState.activeGenerationId) ??
    battleState.generations[0];

  const handleSpawnHarnesses = useCallback(() => {
    setBattleState((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        makeBattleEvent(
          "wave",
          `${army.activeBatch.toLocaleString()} harnesses prepared for wave ${prev.currentWave}`,
          "info",
        ),
      ],
    }));
    setNarration("Harness army prepared for the current wave.");
  }, [army.activeBatch]);

  const handleRunWave = useCallback(async (targetWave?: number) => {
    const wave = typeof targetWave === "number" ? targetWave : battleState.currentWave;
    setIsRunning(true);
    setNarration("Spawning adversarial harnesses.");
    setBattleState((prev) => ({
      ...prev,
      status: "running_wave",
      currentWave: wave,
      currentAttackIndex: -1,
      attacks: [],
      events: [
        ...prev.events,
        makeBattleEvent("wave", `Wave ${wave} started`, "info"),
      ],
    }));

    await delay(500 / speed);
    const waveDefs = army.waves.filter((w) => w.waveNumber <= wave);
    const enemies = generateWaveEnemies(wave, waveDefs);

    setBattleState((prev) => ({
      ...prev,
      status: "running_wave",
      attacks: enemies,
      events: [
        ...prev.events,
        makeBattleEvent(
          "attack",
          `${enemies.length} visible attacks mapped to ${army.activeBatch.toLocaleString()} active harnesses`,
          "warning",
        ),
      ],
    }));

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const outcome = determineOutcome(enemy);
      setBattleState((prev) => ({
        ...prev,
        currentAttackIndex: i,
        attacks: prev.attacks.map((attack, index) =>
          index === i
            ? { ...attack, status: "running", enemyState: "attacking" }
            : attack,
        ),
      }));
      setNarration(`${enemy.label} is probing RefundBot.`);

      await delay(900 / speed);

      if (outcome === "blocked") {
        setBattleState((prev) => ({
          ...prev,
          status: "attack_blocked",
          shield: Math.max(0, prev.shield - 4),
          score: prev.score + 12,
          attacks: prev.attacks.map((attack, index) =>
            index === i
              ? { ...attack, status: "blocked", enemyState: "blocked" }
              : attack,
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
              `${enemy.label} blocked by verifier and output guard`,
              "success",
            ),
          ],
        }));
        setNarration(`${enemy.label} blocked by guardrails.`);
      } else {
        setBattleState((prev) => ({
          ...prev,
          status: "attack_failed",
          integrity: Math.max(0, prev.integrity - 12),
          score: Math.max(0, prev.score - 8),
          attacks: prev.attacks.map((attack, index) =>
            index === i
              ? { ...attack, status: "failed", enemyState: "successful" }
              : attack,
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
              `${enemy.label} breached wrapper policy`,
              "danger",
            ),
          ],
        }));
        setNarration(`${enemy.label} breached wrapper policy.`);
      }

      await delay(550 / speed);
      setBattleState((prev) => ({
        ...prev,
        attacks: prev.attacks.map((attack, index) =>
          index === i ? { ...attack, enemyState: "defeated" } : attack,
        ),
      }));
    }

    setBattleState((prev) => ({
      ...prev,
      status: "completed",
      currentAttackIndex: -1,
      events: [
        ...prev.events,
        makeBattleEvent(
          "wave",
          `Wave ${wave} complete. ${prev.metrics.failed} failures recorded.`,
          "info",
        ),
      ],
    }));
    setNarration("Wave complete. Review verifier failures before exporting.");
    setIsRunning(false);
  }, [army.activeBatch, army.waves, battleState.currentWave, speed]);

  const handleApplyPatch = useCallback(async () => {
    setIsRunning(true);
    setNarration("Applying wrapper-level guardrail patch.");
    setBattleState((prev) => ({
      ...prev,
      status: "patching",
      events: [
        ...prev.events,
        makeBattleEvent("patch", "Patch proposal accepted for RefundBot", "info"),
      ],
    }));

    await delay(800 / speed);

    setBattleState((prev) => ({
      ...prev,
      status: "upgraded",
      mode: "patched",
      latestPatch: MOCK_PATCH,
      activeGenerationId:
        prev.generations[Math.min(1, prev.generations.length - 1)].id,
      integrity: Math.min(100, prev.integrity + 24),
      shield: 76,
      score: prev.score + 50,
      metrics: {
        ...prev.metrics,
        failureRateBefore: 42,
        failureRateAfter: 6,
        robustnessGain: 36,
      },
      events: [
        ...prev.events,
        makeBattleEvent(
          "patch",
          "Prompt Guard patch applied. Wrapper export ready.",
          "info",
        ),
      ],
    }));
    setNarration("Prompt Guard patch applied. RefundBot upgraded to v1.");
    setIsRunning(false);
  }, [speed]);

  const handleReplay = useCallback(() => {
    const first = battleState.attacks[0];
    setNarration(first ? `Replay queued for ${first.label}.` : "No attack trace to replay yet.");
  }, [battleState.attacks]);

  const handleExport = useCallback(() => {
    downloadJson("agentforge_agent_report.json", {
      real_or_simulated: "demo_simulation",
      export_type: "hardened_wrapper_report",
      limitation: "This export contains wrapper settings and reports, not model weights.",
      agent: "RefundBot",
      wave: battleState.currentWave,
      metrics: battleState.metrics,
      latestPatch: battleState.latestPatch,
    });
    setNarration("Export complete. Wrapper package metadata included.");
  }, [battleState]);

  const handleExportAgent = useCallback(() => {
    downloadJson("hardened_agent.json", {
      real_or_simulated: "demo_simulation",
      export_type: "hardened_wrapper",
      limitations: ["No model weights are exported.", "Demo run uses deterministic mock behavior."],
      agent: "RefundBot",
      generation: activeGeneration?.version ?? "v0",
      patch: battleState.latestPatch,
    });
  }, [activeGeneration?.version, battleState.latestPatch]);

  const handleExportRunner = useCallback(() => {
    downloadText(
      "runner.py",
      [
        "# AgentForge hardened wrapper runner",
        "# real_or_simulated: demo_simulation",
        "# limitations: wrapper export only, no model weights",
        "print('AgentForge hardened wrapper ready')",
      ].join("\n"),
      "text/python",
    );
  }, []);

  const handleAttackClick = useCallback((attackId: string) => {
    const attack = battleState.attacks.find((item) => item.id === attackId);
    if (attack) setNarration(`Inspecting trace for ${attack.label}.`);
  }, [battleState.attacks]);

  const severityDist = army.categories.map((category) => ({
    label: category.severity,
    count: category.count,
    color:
      category.severity === "critical"
        ? "#C2414B"
        : category.severity === "high"
          ? "#C77700"
          : category.severity === "medium"
            ? "#2563EB"
            : "#7A7D85",
  }));

  return (
    <WorkspaceShell>
      <TopNavigationBar
        mode="Agent Hardening"
        currentWave={battleState.currentWave}
        activeLabel={activeGeneration?.version ?? "v0"}
        harnessCount={army.activeBatch}
        onSpawnHarnesses={handleSpawnHarnesses}
        onRunWave={handleRunWave}
        onReplay={handleReplay}
        onApplyPatch={handleApplyPatch}
        onExport={handleExport}
        isRunning={isRunning}
      />

      <main className="af-workspace">
        <aside className="af-left-panel" aria-label="Agent hardening controls">
          <div className="af-left-panel-inner">
            <AgentSourceCard onLoadDemo={() => {
              setBattleState(createInitialAgentHardeningState());
              setNarration("Demo RefundBot loaded.");
            }} />
            <HarnessArmyCard
              totalHarnesses={army.totalGenerated}
              activeWaveHarnesses={army.activeBatch}
              categoriesCount={army.categoryCount}
              severityDistribution={severityDist}
              waves={army.waves}
              currentWave={battleState.currentWave}
            />
            <GenerationTimeline
              generations={battleState.generations}
              activeId={battleState.activeGenerationId}
            />
            <AttackQueue attacks={battleState.attacks} onAttackClick={handleAttackClick} />
            <EvaluationLog metrics={battleState.metrics} currentWave={battleState.currentWave} />
            <LatestPatch patch={battleState.latestPatch} />
            <ExportPackage
              onExportAgent={handleExportAgent}
              onExportReport={handleExport}
              onExportRunner={handleExportRunner}
              onExportBundle={handleExport}
            />
          </div>
        </aside>

        <section className="af-right-panel" aria-label="Agent hardening simulation">
          <div className="af-simulation-grid">
            <SimulationHeader
              title="Agent Hardening Arena"
              subtitle="RefundBot Agent"
              status={battleState.status}
              narration={narration}
              accent="#2563EB"
              modeLabel="Wrapper Export"
            />

            <div className="af-simulation-frame">
              <Suspense fallback={<ArenaFallback />}>
                <PixiArenaWrapper
                  battleState={battleState}
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
                accent="#2563EB"
              />
              <WaveLadder
                waves={army.waves}
                currentWave={battleState.currentWave}
                accent="#2563EB"
              />
            </div>

            <MetricDock
              metrics={[
                ["Integrity", battleState.integrity, "%", "#1D1D1F"],
                ["Shield", battleState.shield, "%", "#0284C7"],
                ["Pass Rate", getPassRate(battleState.metrics), "%", "#21865A"],
                ["Failures", battleState.metrics.failed, "cases", "#C2414B"],
              ]}
            />

            <ExportAndNextWave
              title="Export & Share"
              runTitle="Next Wave"
              runCopy="Run the next adversarial wave against the active wrapper generation."
              runLabel="Run Wave"
              isRunning={isRunning}
              accent="#2563EB"
              onRun={handleRunWave}
              onExportPrimary={handleExportAgent}
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

function AgentSourceCard({ onLoadDemo }: { onLoadDemo: () => void }) {
  return (
    <Panel title="Agent Source" className="af-panel-cool" meta={<span className="af-chip">Loaded</span>}>
      <div className="grid gap-3">
        <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 text-[13px]">
          <span className="font-semibold text-[#575A60]">Agent Name</span>
          <span className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2 font-semibold">
            RefundBot Agent
          </span>
        </div>
        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-[13px]">
          <span className="font-semibold text-[#575A60]">Status</span>
          <div className="flex flex-wrap gap-2">
            <span className="af-chip text-[#21865A]">System Prompt: Loaded</span>
            <span className="af-chip text-[#21865A]">Tool Schema: Loaded</span>
            <span className="af-chip text-[#2563EB]">Runtime: deterministic</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onLoadDemo} className="af-button af-button-primary">
            Load RefundBot Demo
          </button>
          <button type="button" className="af-button">
            Upload agent.json
          </button>
        </div>
      </div>
    </Panel>
  );
}

function HarnessArmyCard({
  totalHarnesses,
  activeWaveHarnesses,
  categoriesCount,
  severityDistribution,
  waves,
  currentWave,
}: {
  totalHarnesses: number;
  activeWaveHarnesses: number;
  categoriesCount: number;
  severityDistribution: { label: string; count: number; color: string }[];
  waves: WaveDefinition[];
  currentWave: number;
}) {
  const nextBossWave = waves.find((wave) => wave.isBossWave && wave.waveNumber > currentWave);
  const maxCount = Math.max(...severityDistribution.map((item) => item.count), 1);

  return (
    <Panel title="Harness Army" className="af-panel-warm" meta={<span className="af-chip">Demo Simulation Mode</span>}>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total" value={totalHarnesses.toLocaleString()} />
        <MiniStat label="Active" value={activeWaveHarnesses.toLocaleString()} color="#0284C7" />
        <MiniStat label="Families" value={categoriesCount} color="#7C3AED" />
      </div>
      <div className="mt-4 grid gap-2">
        {severityDistribution.slice(0, 4).map((item) => (
          <div key={`${item.label}-${item.count}`} className="grid grid-cols-[72px_minmax(0,1fr)_44px] items-center gap-2 text-[12px]">
            <span className="font-semibold capitalize text-[#575A60]">{item.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-[#DCD8CC]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%`, background: item.color }}
              />
            </span>
            <span className="af-mono text-right text-[#575A60]">{item.count}</span>
          </div>
        ))}
      </div>
      {nextBossWave && (
        <div className="mt-4 rounded-lg border border-[rgba(194,65,75,0.22)] bg-[rgba(194,65,75,0.08)] px-3 py-2 text-[12px] font-semibold text-[#C2414B]">
          Boss Wave {nextBossWave.waveNumber} in {nextBossWave.waveNumber - currentWave} waves
        </div>
      )}
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

function GenerationTimeline({ generations, activeId }: { generations: AgentGeneration[]; activeId: string }) {
  return (
    <Panel title="Agent Generations" className="af-panel">
      <div className="grid gap-2">
        {generations.map((generation) => {
          const active = generation.id === activeId;
          return (
            <div
              key={generation.id}
              className="grid grid-cols-[54px_minmax(0,1fr)_64px] items-center gap-3 rounded-lg border px-3 py-2"
              style={{
                background: active ? "#F0F8FF" : "#FDFDFD",
                borderColor: active ? "rgba(37,99,235,0.28)" : "#DCD8CC",
              }}
            >
              <span className="af-mono font-bold text-[#2563EB]">{generation.version}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-[#1D1D1F]">
                  {generation.name}
                </span>
                <span className="block text-[12px] text-[#7A7D85]">{generation.patchType}</span>
              </span>
              <span className="af-mono text-right text-[12px] font-semibold text-[#575A60]">
                {generation.failureRate}%
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function AttackQueue({
  attacks,
  onAttackClick,
}: {
  attacks: AttackScenario[];
  onAttackClick: (attackId: string) => void;
}) {
  return (
    <Panel title="Attack Queue" className="af-panel-cool" meta={<span className="af-chip">{attacks.length}</span>}>
      <div className="grid gap-2">
        {attacks.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#DCD8CC] bg-[#FDFDFD] px-3 py-4 text-center text-[13px] text-[#7A7D85]">
            No attacks yet. Run a wave to populate traces.
          </div>
        )}
        {attacks.map((attack) => (
          <button
            key={attack.id}
            type="button"
            onClick={() => onAttackClick(attack.id)}
            className="af-row-button grid min-h-11 grid-cols-[8px_minmax(0,1fr)_68px] items-center gap-3 px-3 py-2"
          >
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: categoryColor(attack.category) }}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{attack.label}</span>
              <span className="block text-[12px] capitalize text-[#7A7D85]">{attack.severity}</span>
            </span>
            <span className="af-mono text-right text-[11px] font-semibold" style={{ color: statusColor(attack.status) }}>
              {attack.status}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function EvaluationLog({ metrics, currentWave }: { metrics: RunMetrics; currentWave: number }) {
  return (
    <Panel title="Evaluation Log" className="af-panel">
      <div className="grid grid-cols-2 gap-2">
        <MiniCell label="Attacks Tested" value={metrics.attacksTested} />
        <MiniCell label="Current Wave" value={currentWave} color="#2563EB" />
        <MiniCell label="Pass Rate" value={`${getPassRate(metrics)}%`} color="#21865A" />
        <MiniCell label="Failure Rate" value={`${getFailRate(metrics)}%`} color="#C2414B" />
      </div>
    </Panel>
  );
}

function MiniCell({ label, value, color = "#1D1D1F" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2">
      <span className="af-meta font-semibold">{label}</span>
      <span className="af-mono mt-1 block text-[20px] font-bold leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function LatestPatch({ patch }: { patch: PatchSummary | null }) {
  return (
    <Panel title="Latest Patch" className="af-panel-lavender" meta={patch ? <span className="af-chip text-[#21865A]">Applied</span> : undefined}>
      {!patch ? (
        <div className="rounded-lg border border-dashed border-[#DCD8CC] bg-[#FDFDFD] px-3 py-4 text-center text-[13px] text-[#7A7D85]">
          No patches applied
        </div>
      ) : (
        <div className="grid gap-3">
          <div>
            <span className="af-chip text-[#7C3AED]">{patch.patchType}</span>
            <p className="mt-3 text-[13px] leading-5 text-[#575A60]">
              {patch.addedRules[0] || patch.title}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="af-mono text-[12px] font-bold text-[#21865A]">+12% Survival</span>
            <span className="af-mono text-[12px] font-bold text-[#21865A]">-8% Damage</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ExportPackage({
  onExportAgent,
  onExportReport,
  onExportRunner,
  onExportBundle,
}: {
  onExportAgent: () => void;
  onExportReport: () => void;
  onExportRunner: () => void;
  onExportBundle: () => void;
}) {
  return (
    <Panel title="Export Package" className="af-panel-cool" meta={<span className="af-chip">Wrapper only</span>}>
      <p className="mb-3 text-[12px] leading-5 text-[#575A60]">
        Hardened wrapper exports include prompts, tool constraints, verifier evidence, and limitations.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="af-button" onClick={onExportAgent}>Export agent.json</button>
        <button type="button" className="af-button" onClick={onExportReport}>Export report.json</button>
        <button type="button" className="af-button" onClick={onExportRunner}>Export runner.py</button>
        <button type="button" className="af-button" onClick={onExportBundle}>Export bundle.zip</button>
      </div>
    </Panel>
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
  const active = status === "running_wave" || status === "patching";
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
        {active ? "Running" : "Ready"}
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
      <div
        className="grid min-w-[920px] gap-1"
        style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      >
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
          <button type="button" onClick={onExportPrimary} className="af-button">Export Agent</button>
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
          {isRunning ? "Running" : runLabel}
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let eventCounter = 0;

function makeBattleEvent(
  kind: BattleEvent["kind"],
  message: string,
  severity: BattleEvent["severity"] = "info",
): BattleEvent {
  eventCounter += 1;
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
  const waveDef = currentWaves.find((wave) => wave.waveNumber === waveNumber);

  return Array.from({ length: count }, (_, index) => {
    const category = categories[index % categories.length];
    const attack: AttackScenario = {
      id: `enemy-w${waveNumber}-${index}`,
      category,
      label: `${titleCase(category)} Attack #${index + 1}`,
      severity: (
        index >= count - 2
          ? "critical"
          : index % 3 === 0
            ? "high"
            : index % 2 === 0
              ? "medium"
              : "low"
      ) as Severity,
      prompt: `Attempt to ${category.replace(/_/g, " ")} through technique ${index + 1}`,
      status: "pending" as AttackStatus,
      enemyState: "idle",
    };
    if (waveDef?.isBossWave && index === count - 1) {
      attack.label = `BOSS: ${attack.label}`;
      attack.severity = "critical";
    }
    return attack;
  });
}

function determineOutcome(attack: AttackScenario): "blocked" | "failed" {
  const failing: AttackCategory[] = [
    "prompt_injection",
    "role_impersonation",
    "policy_extraction",
  ];
  return failing.includes(attack.category) ? "failed" : "blocked";
}

function getPassRate(metrics: RunMetrics): number {
  return metrics.attacksTested > 0
    ? Math.round((metrics.passed / metrics.attacksTested) * 100)
    : 0;
}

function getFailRate(metrics: RunMetrics): number {
  return metrics.attacksTested > 0
    ? Math.round((metrics.failed / metrics.attacksTested) * 100)
    : 0;
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryColor(category: AttackCategory): string {
  const colors: Record<AttackCategory, string> = {
    prompt_injection: "#C2414B",
    role_impersonation: "#7C3AED",
    emotional_manipulation: "#C77700",
    tool_abuse: "#0284C7",
    policy_extraction: "#21865A",
    multi_turn_escalation: "#C2414B",
  };
  return colors[category];
}

function statusColor(status: AttackStatus): string {
  const colors: Record<AttackStatus, string> = {
    pending: "#7A7D85",
    running: "#C77700",
    blocked: "#0284C7",
    failed: "#C2414B",
    passed: "#21865A",
  };
  return colors[status];
}

function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
