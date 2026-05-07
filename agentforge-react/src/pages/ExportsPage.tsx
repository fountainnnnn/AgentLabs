import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExportItem {
  id: string;
  title: string;
  type:
    | "agent-json"
    | "report-json"
    | "runner-py"
    | "agent-bundle"
    | "model-card"
    | "training-report"
    | "reward-trace"
    | "adapter-config"
    | "rl-bundle";
  source: "agent-hardening" | "rl-lab";
  date: string;
  size: string;
  runId: string;
  format: "json" | "yaml" | "csv" | "py" | "zip" | "md";
}

const typeLabels: Record<string, string> = {
  "agent-json": "Agent JSON",
  "report-json": "Report JSON",
  "runner-py": "Runner Script",
  "agent-bundle": "Agent Bundle",
  "model-card": "Model Card",
  "training-report": "Training Report",
  "reward-trace": "Reward Trace",
  "adapter-config": "Adapter Config",
  "rl-bundle": "RL Bundle",
};

const formatBadge: Record<string, { label: string; color: string; bg: string }> = {
  json: { label: "JSON", color: "#2563EB", bg: "rgba(37, 99, 235, 0.1)" },
  yaml: { label: "YAML", color: "#C77700", bg: "rgba(199, 119, 0, 0.1)" },
  csv: { label: "CSV", color: "#21865A", bg: "rgba(33, 134, 90, 0.1)" },
  py: { label: "Python", color: "#0284C7", bg: "rgba(2, 132, 199, 0.1)" },
  zip: { label: "ZIP", color: "#7C3AED", bg: "rgba(124, 58, 237, 0.1)" },
  md: { label: "Markdown", color: "#575A60", bg: "rgba(87, 90, 96, 0.1)" },
};

const MOCK_EXPORTS: ExportItem[] = [
  {
    id: "exp-1",
    title: "RefundBot_v0_agent.json",
    type: "agent-json",
    source: "agent-hardening",
    date: "2026-05-07 14:23",
    size: "12 KB",
    runId: "AH-2026-0507-001",
    format: "json",
  },
  {
    id: "exp-2",
    title: "wave1_report.json",
    type: "report-json",
    source: "agent-hardening",
    date: "2026-05-07 14:24",
    size: "28 KB",
    runId: "AH-2026-0507-001",
    format: "json",
  },
  {
    id: "exp-3",
    title: "refundbot_hardened_runner.py",
    type: "runner-py",
    source: "agent-hardening",
    date: "2026-05-07 14:25",
    size: "6 KB",
    runId: "AH-2026-0507-001",
    format: "py",
  },
  {
    id: "exp-4",
    title: "RefundBot_v3_final_bundle.zip",
    type: "agent-bundle",
    source: "agent-hardening",
    date: "2026-05-07 14:30",
    size: "64 KB",
    runId: "AH-2026-0507-001",
    format: "zip",
  },
  {
    id: "exp-5",
    title: "llama3_2_model_card.md",
    type: "model-card",
    source: "rl-lab",
    date: "2026-05-07 15:01",
    size: "4 KB",
    runId: "RL-2026-0507-001",
    format: "md",
  },
  {
    id: "exp-6",
    title: "rl_training_report_run1.json",
    type: "training-report",
    source: "rl-lab",
    date: "2026-05-07 15:02",
    size: "44 KB",
    runId: "RL-2026-0507-001",
    format: "json",
  },
  {
    id: "exp-7",
    title: "reward_trace_episode_100.csv",
    type: "reward-trace",
    source: "rl-lab",
    date: "2026-05-07 15:03",
    size: "18 KB",
    runId: "RL-2026-0507-001",
    format: "csv",
  },
  {
    id: "exp-8",
    title: "lora_adapter_config.yaml",
    type: "adapter-config",
    source: "rl-lab",
    date: "2026-05-07 15:04",
    size: "2 KB",
    runId: "RL-2026-0507-001",
    format: "yaml",
  },
  {
    id: "exp-9",
    title: "mistral_rl_bundle.zip",
    type: "rl-bundle",
    source: "rl-lab",
    date: "2026-05-06 22:16",
    size: "128 KB",
    runId: "RL-2026-0506-001",
    format: "zip",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ExportsPage() {
  const [filter, setFilter] = useState<"all" | "agent-hardening" | "rl-lab">("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? MOCK_EXPORTS
        : MOCK_EXPORTS.filter((e) => e.source === filter),
    [filter],
  );

  // Group by run ID
  const groupedByRun = useMemo(() => {
    const groups: Record<string, ExportItem[]> = {};
    filtered.forEach((item) => {
      if (!groups[item.runId]) {
        groups[item.runId] = [];
      }
      groups[item.runId].push(item);
    });
    return groups;
  }, [filtered]);

  const sourceColor = (source: string) =>
    source === "agent-hardening" ? "#2563EB" : "#7C3AED";

  const handleDownload = useCallback((exp: ExportItem) => {
    setDownloadingId(exp.id);
    // Simulate download delay
    setTimeout(() => {
      const blob = new Blob(
        [`Simulated content for ${exp.title}`],
        { type: "application/octet-stream" },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exp.title;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setDownloadingId(null);
    }, 400);
  }, []);

  return (
    <div
      className="flex flex-col min-h-screen w-full"
      style={{ background: "#FCFCF7" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between w-full flex-shrink-0 px-8 py-5"
        style={{ borderBottom: "1px solid #DCD8CC" }}
      >
        <div className="flex items-baseline gap-3">
          <Link
            to="/"
            className="font-bold tracking-tight hover:opacity-70 transition-opacity"
            style={{ fontSize: "18px", color: "#1D1D1F" }}
          >
            AgentForge
          </Link>
          <span style={{ fontSize: "18px", color: "#DCD8CC" }}>/</span>
          <h1
            className="font-semibold"
            style={{ fontSize: "18px", color: "#1D1D1F" }}
          >
            Exports
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <FilterChip
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Agent Hardening"
            active={filter === "agent-hardening"}
            onClick={() => setFilter("agent-hardening")}
          />
          <FilterChip
            label="RL Lab"
            active={filter === "rl-lab"}
            onClick={() => setFilter("rl-lab")}
          />
        </div>
      </header>

      {/* Export list */}
      <main
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "32px 32px 64px",
          width: "100%",
        }}
      >
        {filtered.length === 0 && (
          <div
            className="text-sm text-center py-16"
            style={{ color: "#7A7D85" }}
          >
            No exports found for this filter.
          </div>
        )}

        <div className="flex flex-col gap-6">
          {Object.entries(groupedByRun).map(([runId, items]) => (
            <div key={runId} className="flex flex-col gap-2">
              {/* Run group header */}
              <div className="flex items-center gap-2 px-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#7A7D85" }}
                >
                  Run
                </span>
                <span
                  className="text-xs font-mono font-bold"
                  style={{ color: "#1D1D1F" }}
                >
                  {runId}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{
                    background: `${sourceColor(items[0].source)}12`,
                    color: sourceColor(items[0].source),
                  }}
                >
                  {items[0].source === "agent-hardening"
                    ? "Agent Hardening"
                    : "RL Lab"}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "#7A7D85" }}
                >
                  {items.length} file{items.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Files for this run */}
              <div className="flex flex-col gap-2">
                {items.map((exp) => {
                  const badge = formatBadge[exp.format];
                  const isDownloading = downloadingId === exp.id;

                  return (
                    <div
                      key={exp.id}
                      className="rounded-xl flex items-center justify-between transition-shadow hover:shadow-sm px-4 py-3"
                      style={{
                        background: "#FAF9F6",
                        border: "1px solid #DCD8CC",
                      }}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Type icon */}
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{
                            background: `${sourceColor(exp.source)}18`,
                            color: sourceColor(exp.source),
                          }}
                        >
                          {exp.type === "agent-json" || exp.type === "report-json"
                            ? "{ }"
                            : exp.type === "runner-py"
                              ? ">_"
                              : exp.type === "agent-bundle" || exp.type === "rl-bundle"
                                ? "ZIP"
                                : exp.type === "model-card"
                                  ? "MD"
                                  : exp.type === "adapter-config"
                                    ? "YML"
                                    : "CSV"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-sm font-semibold truncate"
                              style={{ color: "#1D1D1F" }}
                            >
                              {exp.title}
                            </span>
                            {/* Format badge */}
                            {badge && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                style={{
                                  background: badge.bg,
                                  color: badge.color,
                                }}
                              >
                                {badge.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span
                              className="text-xs"
                              style={{ color: "#7A7D85" }}
                            >
                              {typeLabels[exp.type]}
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: "#7A7D85" }}
                            >
                              {exp.date}
                            </span>
                            <span
                              className="text-xs font-mono"
                              style={{ color: "#7A7D85" }}
                            >
                              {exp.size}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Download button */}
                      <button
                        onClick={() => handleDownload(exp)}
                        disabled={isDownloading}
                        className="h-9 px-5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 flex-shrink-0"
                        style={{
                          background: isDownloading
                            ? "#DCD8CC"
                            : "#FFFFFF",
                          color: isDownloading ? "#7A7D85" : "#575A60",
                          border: "1px solid #DCD8CC",
                        }}
                      >
                        {isDownloading ? (
                          <>
                            <span
                              className="w-3 h-3 rounded-full border-2 border-transparent border-t-current animate-spin"
                              style={{ borderTopColor: "#7A7D85" }}
                            />
                            Downloading...
                          </>
                        ) : (
                          "Download"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-8 px-3 rounded-btn text-xs font-semibold transition-all"
      style={{
        background: active ? "#1D1D1F" : "#FAF9F6",
        color: active ? "#FFFFFF" : "#575A60",
        border: active ? "none" : "1px solid #DCD8CC",
      }}
    >
      {label}
    </button>
  );
}
