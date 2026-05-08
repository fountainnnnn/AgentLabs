
interface AgentSourcePanelProps {
  agentName: string;
  systemPromptStatus: "loaded" | "missing";
  toolSchemaStatus: "loaded" | "missing";
  runtimeMode: string;
  onLoadDemo: () => void;
  onUploadAgent: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  loaded: { bg: "rgba(33, 134, 90, 0.12)", color: "#21865A", label: "Loaded" },
  missing: { bg: "rgba(194, 65, 75, 0.12)", color: "#C2414B", label: "Missing" },
};

export default function AgentSourcePanel({
  agentName,
  systemPromptStatus,
  toolSchemaStatus,
  runtimeMode,
  onLoadDemo,
  onUploadAgent,
}: AgentSourcePanelProps) {
  const sysBadge = STATUS_BADGE[systemPromptStatus] || STATUS_BADGE.missing;
  const toolBadge = STATUS_BADGE[toolSchemaStatus] || STATUS_BADGE.missing;

  return (
    <div
      className="cool-card rounded-xl flex flex-col"
      style={{
        background: "#F2F8FC",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
        minHeight: "190px",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-[11px] font-bold tracking-widest uppercase"
          style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
        >
          Agent Source
        </span>
      </div>

      {/* Agent name field */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium flex-shrink-0" style={{ color: "#575A60", width: "80px" }}>
          Agent Name
        </span>
        <div
          className="flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium"
          style={{
            background: "#FFFFFF",
            border: "1px solid #DCD8CC",
            color: "#1D1D1F",
          }}
        >
          {agentName}
        </div>
      </div>

      {/* Status badges row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "80px minmax(0, 1fr)" }}>
        <span className="text-[12px] font-medium self-start pt-1" style={{ color: "#575A60" }}>
          Status
        </span>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(138px, 1fr))" }}>
          <span
            className="min-w-0 rounded-md px-2 py-1 text-[11px] font-semibold leading-none"
            style={{ background: sysBadge.bg, color: sysBadge.color, border: `1px solid ${sysBadge.color}22` }}
          >
            System Prompt: {sysBadge.label}
          </span>
          <span
            className="min-w-0 rounded-md px-2 py-1 text-[11px] font-semibold leading-none"
            style={{ background: toolBadge.bg, color: toolBadge.color, border: `1px solid ${toolBadge.color}22` }}
          >
            Tool Schema: {toolBadge.label}
          </span>
          <span
            className="min-w-0 rounded-md px-2 py-1 text-[11px] font-semibold leading-none"
            style={{ background: "rgba(37, 99, 235, 0.12)", color: "#2563EB", border: "1px solid rgba(37, 99, 235, 0.14)" }}
          >
            Runtime: {runtimeMode}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid gap-2 mt-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <button
          type="button"
          onClick={onLoadDemo}
          className="h-8 min-w-0 px-3 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
          style={{
            background: "#2563EB",
            color: "#FFFFFF",
            border: "none",
          }}
        >
          Load RefundBot Demo
        </button>
        <button
          type="button"
          onClick={onUploadAgent}
          className="h-8 min-w-0 px-3 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "#FFFFFF",
            color: "#575A60",
            border: "1px solid #DCD8CC",
          }}
        >
          Upload agent.json
        </button>
      </div>
    </div>
  );
}
