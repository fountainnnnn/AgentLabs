import { useState } from "react";
import { Link } from "react-router-dom";

interface Report {
  id: string;
  title: string;
  type: "agent-hardening" | "rl-lab";
  date: string;
  wave: number;
  attacksTested: number;
  failures: number;
  robustnessGain: number;
  modelName: string;
}

const MOCK_REPORTS: Report[] = [
  {
    id: "rpt-1",
    title: "RefundBot v0 — Wave 1",
    type: "agent-hardening",
    date: "2026-05-07 14:23",
    wave: 1,
    attacksTested: 48,
    failures: 9,
    robustnessGain: 0,
    modelName: "RefundBot-3000",
  },
  {
    id: "rpt-2",
    title: "RefundBot v1 — Wave 2 (Patched)",
    type: "agent-hardening",
    date: "2026-05-07 14:28",
    wave: 2,
    attacksTested: 48,
    failures: 3,
    robustnessGain: 36,
    modelName: "RefundBot-3000",
  },
  {
    id: "rpt-3",
    title: "Llama-3.2 RL Run 1",
    type: "rl-lab",
    date: "2026-05-07 15:01",
    wave: 1,
    attacksTested: 100,
    failures: 0,
    robustnessGain: 0,
    modelName: "Llama-3.2-3B",
  },
  {
    id: "rpt-4",
    title: "Mistral-7B RL Run — Adapter v2",
    type: "rl-lab",
    date: "2026-05-06 22:15",
    wave: 2,
    attacksTested: 200,
    failures: 0,
    robustnessGain: 0,
    modelName: "Mistral-7B-v0.3",
  },
  {
    id: "rpt-5",
    title: "RefundBot v3 — Wave 3 (Final)",
    type: "agent-hardening",
    date: "2026-05-06 18:42",
    wave: 3,
    attacksTested: 48,
    failures: 0,
    robustnessGain: 42,
    modelName: "RefundBot-3000",
  },
];

export default function ReportsPage() {
  const [filter, setFilter] = useState<"all" | "agent-hardening" | "rl-lab">("all");

  const filtered = filter === "all" ? MOCK_REPORTS : MOCK_REPORTS.filter((r) => r.type === filter);

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
          <h1 className="font-semibold" style={{ fontSize: "18px", color: "#1D1D1F" }}>
            Reports
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          <FilterChip active={filter === "agent-hardening"} onClick={() => setFilter("agent-hardening")} label="Agent Hardening" />
          <FilterChip active={filter === "rl-lab"} onClick={() => setFilter("rl-lab")} label="RL Lab" />
        </div>
      </header>

      {/* Report list */}
      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "32px", width: "100%" }}>
        {filtered.length === 0 && (
          <div className="text-sm text-center py-16" style={{ color: "#7A7D85" }}>
            No reports found for this filter.
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((report) => (
            <div
              key={report.id}
              className="panel p-4 flex items-center justify-between transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center gap-4">
                {/* Type icon */}
                <div
                  className="w-9 h-9 rounded-btn flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: report.type === "agent-hardening"
                      ? "rgba(37,99,235,0.12)"
                      : "rgba(124,58,237,0.12)",
                    color: report.type === "agent-hardening" ? "#2563EB" : "#7C3AED",
                  }}
                >
                  {report.type === "agent-hardening" ? "AH" : "RL"}
                </div>

                <div>
                  <div className="text-sm font-semibold" style={{ color: "#1D1D1F" }}>
                    {report.title}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: "#7A7D85" }}>
                      {report.date}
                    </span>
                    <span className="text-xs" style={{ color: "#7A7D85" }}>
                      Model: {report.modelName}
                    </span>
                    {report.type === "agent-hardening" && (
                      <>
                        <span className="text-xs" style={{ color: "#575A60" }}>
                          Attacks: {report.attacksTested}
                        </span>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: report.failures > 0 ? "#C2414B" : "#21865A" }}
                        >
                          Failures: {report.failures}
                        </span>
                        {report.robustnessGain > 0 && (
                          <span className="text-xs font-semibold" style={{ color: "#21865A" }}>
                            +{report.robustnessGain}% Robustness
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <button
                className="h-8 px-4 rounded-btn text-xs font-semibold transition-opacity hover:opacity-80 flex-shrink-0"
                style={{
                  background: "#FFFFFF",
                  color: "#575A60",
                  border: "1px solid #DCD8CC",
                }}
              >
                View Report
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

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
