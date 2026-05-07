
interface TopNavigationBarProps {
  mode?: string;
  onRunWave?: () => void;
  onReplay?: () => void;
  onApplyPatch?: () => void;
  onExport?: () => void;
  isRunning?: boolean;
}

function getAccentColor(mode?: string): string {
  if (mode === "RL Lab") return "#7C3AED";
  return "#2563EB";
}

function getLabel(mode?: string): string {
  if (mode === "Agent Hardening") return "Agent Hardening";
  if (mode === "RL Lab") return "RL Lab";
  return "Adversarial Training Platform";
}

export default function TopNavigationBar({
  mode,
  onRunWave,
  onReplay,
  onApplyPatch,
  onExport,
  isRunning = false,
}: TopNavigationBarProps) {
  const accent = getAccentColor(mode);
  const label = getLabel(mode);

  return (
    <header
      className="flex items-center justify-between w-full flex-shrink-0 px-5"
      style={{
        height: "52px",
        background: "#FAF9F6",
        borderBottom: "1px solid #DCD8CC",
      }}
    >
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-sm flex items-center justify-center text-[10px] font-bold"
          style={{
            width: "16px",
            height: "16px",
            background: accent,
            color: "#FFFFFF",
          }}
        >
          AF
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="font-bold tracking-tight"
            style={{ fontSize: "18px", color: "#1D1D1F" }}
          >
            AgentForge
          </span>
          <span
            className="hidden sm:inline text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ color: accent, background: `${accent}14` }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Center-right: status */}
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{
            background: isRunning ? "#C77700" : "#21865A",
            boxShadow: isRunning
              ? "0 0 6px rgba(199,119,0,0.5)"
              : "0 0 6px rgba(33,134,90,0.5)",
          }}
        />
        <span
          className="text-xs font-semibold"
          style={{ color: isRunning ? "#C77700" : "#21865A" }}
        >
          {isRunning ? "Running" : "Ready"}
        </span>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunWave}
          disabled={isRunning}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{
            background: isRunning ? `${accent}50` : accent,
            color: "#FFFFFF",
            border: "none",
          }}
        >
          {isRunning ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-transparent border-t-white animate-spin" />
              Running
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 1.5L11.5 7L3 12.5V1.5Z" fill="currentColor" />
              </svg>
              Run Wave
            </>
          )}
        </button>

        <button
          onClick={onReplay}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            borderColor: "#DCD8CC",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 7C3.5 5.067 5.067 3.5 7 3.5C8.381 3.5 9.579 4.302 10.168 5.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M10.5 3V5.5H8"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Replay
        </button>

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            borderColor: "#DCD8CC",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 9.5V2M4.5 4.5L7 2L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 9V11.5C2 12.052 2.448 12.5 3 12.5H11C11.552 12.5 12 12.052 12 11.5V9"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          Export
        </button>

        <button
          onClick={onApplyPatch}
          disabled={isRunning}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-semibold border transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: "#FFFFFF",
            color: accent,
            borderColor: `${accent}40`,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4.5 5V3.5C4.5 2.672 5.172 2 7 2C8.828 2 9.5 2.672 9.5 3.5V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="7" cy="8" r="1" fill="currentColor" />
          </svg>
          Apply Patch
        </button>
      </div>
    </header>
  );
}
