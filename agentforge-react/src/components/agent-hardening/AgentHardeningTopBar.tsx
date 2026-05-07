
interface AgentHardeningTopBarProps {
  waveNumber: number;
  totalWaves: number;
  currentGeneration: string;
  totalHarnesses: number;
  isValidating?: boolean;
  onSpawnHarnesses: () => void;
  onRunWave: () => void;
  onApplyUpgrade: () => void;
  onReplay: () => void;
  onExport: () => void;
}

export default function AgentHardeningTopBar({
  waveNumber,
  totalWaves,
  currentGeneration,
  totalHarnesses,
  isValidating = false,
  onSpawnHarnesses,
  onRunWave,
  onApplyUpgrade,
  onReplay,
  onExport,
}: AgentHardeningTopBarProps) {
  return (
    <header
      className="flex items-center justify-between w-full flex-shrink-0 px-5"
      style={{
        height: "64px",
        background: "#FAF9F6",
        borderBottom: "1px solid #DCD8CC",
      }}
    >
      {/* Left: brand + mode chip + run id */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-sm flex items-center justify-center text-[10px] font-bold"
          style={{ width: "16px", height: "16px", background: "#2563EB", color: "#FFFFFF" }}
        >
          AF
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-bold tracking-tight" style={{ fontSize: "18px", color: "#1D1D1F" }}>
            AgentForge
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: "rgba(2, 132, 199, 0.12)", color: "#0284C7" }}
        >
          Agent Hardening
        </span>
        <span
          className="text-[10px] font-mono font-semibold rounded-md px-2 py-0.5"
          style={{ background: "#FFFFFF", border: "1px solid #DCD8CC", color: "#7A7D85" }}
        >
          run_7f3a2b
        </span>
      </div>

      {/* Middle: wave stats */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Wave
          </span>
          <span className="text-[15px] font-bold font-mono" style={{ color: "#1D1D1F" }}>
            {waveNumber}/{totalWaves}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Gen
          </span>
          <span className="text-[15px] font-bold font-mono" style={{ color: "#7C3AED" }}>
            {currentGeneration}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#7A7D85" }}>
            Harnesses
          </span>
          <span className="text-[15px] font-bold font-mono" style={{ color: "#1D1D1F" }}>
            {totalHarnesses}
          </span>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSpawnHarnesses}
          disabled={isValidating}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            border: "1px solid #DCD8CC",
          }}
        >
          Spawn Harnesses
        </button>
        <button
          type="button"
          onClick={onRunWave}
          disabled={isValidating}
          className="h-8 px-4 rounded-lg text-[12px] font-semibold transition-opacity disabled:opacity-50"
          style={{
            background: "#2563EB",
            color: "#FFFFFF",
            border: "none",
          }}
        >
          {isValidating ? "Running" : "Run Wave"}
        </button>
        <button
          type="button"
          onClick={onApplyUpgrade}
          disabled={isValidating}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            border: "1px solid #DCD8CC",
          }}
        >
          Apply Upgrade
        </button>
        <button
          type="button"
          onClick={onReplay}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            border: "1px solid #DCD8CC",
          }}
        >
          Replay
        </button>
        <button
          type="button"
          onClick={onExport}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            border: "1px solid #DCD8CC",
          }}
        >
          Export
        </button>
      </div>
    </header>
  );
}
