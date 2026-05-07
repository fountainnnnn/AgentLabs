
import AgentSourcePanel from "@/components/agent-hardening/AgentSourcePanel";
import HarnessArmyPanel from "@/components/agent-hardening/HarnessArmyPanel";
import AgentExportPanel from "@/components/agent-hardening/AgentExportPanel";
import AgentGenerationsPanel from "@/components/ops/AgentGenerationsPanel";
import AttackQueuePanel from "@/components/ops/AttackQueuePanel";
import EvaluationHistoryPanel from "@/components/ops/EvaluationHistoryPanel";
import LatestPatchPanel from "@/components/ops/LatestPatchPanel";
import BottomMetricsRow from "@/components/metrics/BottomMetricsRow";
import type {
  BattleState,
  HarnessArmy,
  AttackScenario,
  WaveDefinition,
  RunMetrics,
} from "@/types/agentforge";

interface AgentHardeningWorkspaceProps {
  state: BattleState;
  isRunning: boolean;
  onAttackClick: (attackId: string) => void;

  agentName: string;
  systemPromptStatus: "loaded" | "missing";
  toolSchemaStatus: "loaded" | "missing";
  runtimeMode: string;
  onLoadDemo: () => void;
  onUploadAgent: () => void;

  harnessArmy: HarnessArmy;

  onExportAgent: () => void;
  onExportReport: () => void;
  onExportRunner: () => void;
  onExportBundle: () => void;

  onRunWave: () => void;
  onReplay: () => void;
  onApplyUpgrade: () => void;
  onSpawnHarnesses: () => void;
}

export default function AgentHardeningWorkspace({
  state,
  isRunning,
  onAttackClick,
  agentName,
  systemPromptStatus,
  toolSchemaStatus,
  runtimeMode,
  onLoadDemo,
  onUploadAgent,
  harnessArmy,
  onExportAgent,
  onExportReport,
  onExportRunner,
  onExportBundle,
  onRunWave,
  onReplay,
  onApplyUpgrade,
  onSpawnHarnesses,
}: AgentHardeningWorkspaceProps) {
  const severityDist = harnessArmy.categories.map((c) => ({
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

  return (
    <div className="flex flex-1 w-full overflow-hidden">
      {/* Left panel: 450px */}
      <div
        className="flex-shrink-0 overflow-y-auto flex flex-col"
        style={{
          width: "450px",
          background: "#FAF9F6",
          borderRight: "1px solid #DCD8CC",
          padding: "14px",
          gap: "14px",
          scrollbarWidth: "thin",
          scrollbarColor: "#DCD8CC transparent",
        }}
      >
        <AgentSourcePanel
          agentName={agentName}
          systemPromptStatus={systemPromptStatus}
          toolSchemaStatus={toolSchemaStatus}
          runtimeMode={runtimeMode}
          onLoadDemo={onLoadDemo}
          onUploadAgent={onUploadAgent}
        />

        <HarnessArmyPanel
          totalHarnesses={harnessArmy.totalGenerated}
          activeWaveHarnesses={harnessArmy.activeBatch}
          categoriesCount={harnessArmy.categoryCount}
          severityDistribution={severityDist}
          waves={harnessArmy.waves}
          currentWave={state.currentWave}
        />

        <AgentGenerationsPanel generations={state.generations} activeId={state.activeGenerationId} />

        <AttackQueuePanel attacks={state.attacks} onAttackClick={onAttackClick} />

        <EvaluationHistoryPanel metrics={state.metrics} currentWave={state.currentWave} />

        <LatestPatchPanel patch={state.latestPatch} />

        <AgentExportPanel
          onExportAgent={onExportAgent}
          onExportReport={onExportReport}
          onExportRunner={onExportRunner}
          onExportBundle={onExportBundle}
        />
      </div>

      {/* Right panel: flex-1 */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ background: "#FCFCF7" }}
      >
        {/* Arena area */}
        <div className="flex-1 flex flex-col p-4 gap-3" style={{ minHeight: 0 }}>
          {/* PixiArenaWrapper placeholder */}
          <div
            className="flex-1 rounded-xl flex flex-col items-center justify-center"
            style={{
              background: "#FAF9F6",
              border: "1px solid #DCD8CC",
              minHeight: "280px",
            }}
          >
            {/* Arena visualization */}
            <div
              className="arena-grid w-full h-full rounded-xl flex flex-col items-center justify-center"
              style={{ position: "relative", overflow: "hidden" }}
            >
              {/* Shield icon */}
              <div
                className="flex items-center gap-3 mb-2"
                style={{ pointerEvents: "none" }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3L4 7V13C4 17.5 7.5 21.5 12 23C16.5 21.5 20 17.5 20 13V7L12 3Z"
                    fill="rgba(2, 132, 199, 0.12)"
                    stroke="#0284C7"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="#0284C7"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-[13px] font-semibold" style={{ color: "#7A7D85" }}>
                Arena Visualization
              </span>
              <span className="text-[11px]" style={{ color: "#7A7D85", marginTop: "2px" }}>
                Wave {state.currentWave} | {state.attacks.length} threats detected
              </span>
            </div>
          </div>

          {/* Bottom metrics */}
          <BottomMetricsRow metrics={state.metrics} />

          {/* WaveLadder */}
          <WaveLadder waves={harnessArmy.waves} currentWave={state.currentWave} />
        </div>
      </div>
    </div>
  );
}

/* ---------- WaveLadder (inline sub-component) ---------- */

function WaveLadder({
  waves,
  currentWave,
}: {
  waves: WaveDefinition[];
  currentWave: number;
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
                    ? "rgba(37, 99, 235, 0.08)"
                    : isPast
                      ? "rgba(33, 134, 90, 0.06)"
                      : "#FFFFFF",
                  border: isActive
                    ? "1px solid rgba(37, 99, 235, 0.3)"
                    : isBoss
                      ? "1px solid rgba(194, 65, 75, 0.2)"
                      : "1px solid #DCD8CC",
                }}
              >
                <span
                  className="text-[13px] font-bold font-mono"
                  style={{
                    color: isActive
                      ? "#2563EB"
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
                        ? "#2563EB"
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
