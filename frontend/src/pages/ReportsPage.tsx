import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type ReportMode = "agent-hardening" | "rl-lab";
type Filter = "all" | ReportMode;

interface RunReport {
  id: string;
  mode: ReportMode;
  title: string;
  target: string;
  runStatus: "Complete" | "Review needed" | "Export ready";
  completedAt: string;
  wave: number;
  harnesses: number;
  passRateBefore: number;
  passRateAfter: number;
  failures: number;
  duration: string;
  realOrSimulated: "demo_simulation" | "adapter_simulation" | "real_local_model";
  artifactCount: number;
  clusters: string[];
  timeline: string[];
  metadata: Record<string, string | number | boolean>;
}

const reports: RunReport[] = [
  {
    id: "AH-2026-0507-001",
    mode: "agent-hardening",
    title: "RefundBot wrapper hardening run",
    target: "RefundBot Agent",
    runStatus: "Export ready",
    completedAt: "2026-05-07 14:31",
    wave: 8,
    harnesses: 1248,
    passRateBefore: 58,
    passRateAfter: 94,
    failures: 6,
    duration: "08:42",
    realOrSimulated: "demo_simulation",
    artifactCount: 4,
    clusters: [
      "policy extraction against private refund threshold",
      "role impersonation with false escalation authority",
      "prompt injection through tool-call argument stuffing",
    ],
    timeline: [
      "Harness army prepared for RefundBot v0",
      "Verifier trace captured 48 wrapper failures",
      "Prompt Guard patch applied to output filter and tool schema",
      "Retest wave reduced failures from 42 percent to 6 percent",
    ],
    metadata: {
      export_type: "hardened_wrapper_report",
      model_weights_exported: false,
      structured_traces: true,
    },
  },
  {
    id: "RL-2026-0507-001",
    mode: "rl-lab",
    title: "Local adapter simulation run",
    target: "Llama-3.1-8B-Instruct",
    runStatus: "Complete",
    completedAt: "2026-05-07 15:04",
    wave: 6,
    harnesses: 960,
    passRateBefore: 42,
    passRateAfter: 91,
    failures: 9,
    duration: "11:18",
    realOrSimulated: "adapter_simulation",
    artifactCount: 5,
    clusters: [
      "jailbreak prompts with deceptive instruction hierarchy",
      "reward hacking probes against refusal precision",
      "hallucination traps with fabricated policy citations",
    ],
    timeline: [
      "Demo Simulation Mode initialized without local model upload",
      "Reward components scored correctness, refusal, leakage, and consistency",
      "Adapter simulation checkpoint saved with frozen base model metadata",
      "Export marked not_trained_on_openai_weights as true",
    ],
    metadata: {
      not_trained_on_openai_weights: true,
      local_model_required_for_real_training: true,
      reward_trace_included: true,
    },
  },
  {
    id: "AH-2026-0506-003",
    mode: "agent-hardening",
    title: "Regression certification precheck",
    target: "RefundBot Agent",
    runStatus: "Review needed",
    completedAt: "2026-05-06 18:42",
    wave: 19,
    harnesses: 3584,
    passRateBefore: 83,
    passRateAfter: 97,
    failures: 3,
    duration: "16:09",
    realOrSimulated: "demo_simulation",
    artifactCount: 3,
    clusters: [
      "multi-turn escalation after partial order lookup",
      "policy leakage via comparison request",
      "tool permission drift after replay",
    ],
    timeline: [
      "Certification precheck executed across previous failures",
      "Three traces flagged for human review",
      "Wrapper report generated with limitations section",
      "Export bundle pending review signoff",
    ],
    metadata: {
      export_type: "hardened_wrapper_bundle",
      limitations_included: true,
      requires_review: true,
    },
  },
];

export default function ReportsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(reports[0].id);

  const filteredReports = useMemo(
    () => reports.filter((report) => filter === "all" || report.mode === filter),
    [filter],
  );

  const selectedReport =
    filteredReports.find((report) => report.id === selectedId) ??
    filteredReports[0] ??
    reports[0];

  const totals = useMemo(() => {
    const totalHarnesses = filteredReports.reduce((sum, report) => sum + report.harnesses, 0);
    const totalFailures = filteredReports.reduce((sum, report) => sum + report.failures, 0);
    const improvement =
      filteredReports.length === 0
        ? 0
        : Math.round(
            filteredReports.reduce(
              (sum, report) => sum + report.passRateAfter - report.passRateBefore,
              0,
            ) / filteredReports.length,
          );

    return {
      runs: filteredReports.length,
      totalHarnesses,
      totalFailures,
      improvement,
    };
  }, [filteredReports]);

  return (
    <div className="af-page">
      <header className="af-topbar flex items-center justify-between gap-4 px-5">
        <Link to="/" className="af-brand-link" aria-label="Back to AgentForge menu">
          <img
            src="/assets/agentforge/brand/agentforge-logo.png"
            alt=""
            aria-hidden="true"
            className="af-brand-logo"
          />
          <span>
            <span className="af-brand-word">AgentForge</span>
            <span className="af-brand-subtitle">Reports and run evidence</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
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

      <main className="af-page-main">
        <div className="af-container-wide grid gap-4">
          <section className="af-panel-canvas p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="af-section-label">Run observability</p>
                <h1 className="mt-3 text-[28px] font-semibold leading-tight text-[#1D1D1F] md:text-[34px]">
                  Reports
                </h1>
                <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[#575A60]">
                  Inspect adversarial runs, failure clusters, verifier traces,
                  reward traces, and export metadata without overstating what was
                  simulated.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="af-chip">Structured logs</span>
                <span className="af-chip">Trace evidence</span>
                <span className="af-chip">Truthful artifacts</span>
              </div>
            </div>
          </section>

          <section className="af-metric-grid" aria-label="Report summary">
            <Kpi label="Runs" value={totals.runs} suffix="visible" color="#1D1D1F" />
            <Kpi label="Harnesses" value={totals.totalHarnesses.toLocaleString()} suffix="tested" color="#0284C7" />
            <Kpi label="Failures" value={totals.totalFailures} suffix="open" color="#C2414B" />
            <Kpi label="Mean lift" value={`+${totals.improvement}`} suffix="pts" color="#21865A" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(560px,1fr)_minmax(420px,0.72fr)]">
            <div className="af-panel-canvas overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCD8CC] px-4 py-3">
                <p className="af-section-label">Run index</p>
                <span className="af-chip af-mono">{filteredReports.length} records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="af-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Target</th>
                      <th>Mode</th>
                      <th>Wave</th>
                      <th>Pass rate</th>
                      <th>Failures</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => {
                      const active = report.id === selectedReport.id;
                      return (
                        <tr key={report.id} style={{ background: active ? "#F0F8FF" : "transparent" }}>
                          <td>
                            <button
                              type="button"
                              onClick={() => setSelectedId(report.id)}
                              className="text-left font-semibold text-[#1D1D1F] underline-offset-4 hover:underline"
                            >
                              {report.title}
                            </button>
                            <span className="af-mono mt-1 block text-[11px] text-[#7A7D85]">
                              {report.id}
                            </span>
                          </td>
                          <td>{report.target}</td>
                          <td>
                            <span className="af-chip" style={{ color: modeColor(report.mode) }}>
                              {modeLabel(report.mode)}
                            </span>
                          </td>
                          <td className="af-mono">W{String(report.wave).padStart(2, "0")}</td>
                          <td className="af-mono text-[#21865A]">
                            {report.passRateBefore}% to {report.passRateAfter}%
                          </td>
                          <td className="af-mono text-[#C2414B]">{report.failures}</td>
                          <td>{report.runStatus}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="grid gap-4">
              <section className="af-panel-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="af-section-label">Selected run</p>
                    <h2 className="mt-2 text-[21px] font-semibold leading-tight text-[#1D1D1F]">
                      {selectedReport.title}
                    </h2>
                    <p className="mt-1 af-mono text-[12px] text-[#7A7D85]">
                      {selectedReport.id}
                    </p>
                  </div>
                  <span className="af-chip" style={{ color: modeColor(selectedReport.mode) }}>
                    {modeLabel(selectedReport.mode)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <DetailCell label="Completed" value={selectedReport.completedAt} />
                  <DetailCell label="Duration" value={selectedReport.duration} />
                  <DetailCell label="Artifacts" value={selectedReport.artifactCount} />
                  <DetailCell label="real_or_simulated" value={selectedReport.realOrSimulated} mono />
                </div>
              </section>

              <section className="af-panel p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="af-section-label">Failure clusters</p>
                  <span className="af-chip">{selectedReport.clusters.length} clusters</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedReport.clusters.map((cluster, index) => (
                    <div
                      key={cluster}
                      className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2 text-[13px] leading-5 text-[#575A60]"
                    >
                      <span className="af-mono font-bold text-[#C2414B]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{cluster}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="af-panel-cool p-4">
                <p className="af-section-label">Timeline and metadata</p>
                <div className="mt-3 af-log">
                  {selectedReport.timeline.map((item, index) => (
                    <div key={item} className="af-log-row">
                      <span className="af-mono">{`T+${String(index).padStart(2, "0")}`}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] p-3">
                  <pre className="af-mono whitespace-pre-wrap break-all text-[12px] leading-5 text-[#575A60]">
                    {JSON.stringify(selectedReport.metadata, null, 2)}
                  </pre>
                </div>
              </section>
            </aside>
          </section>
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
      type="button"
      onClick={onClick}
      className="af-button h-8 min-h-8 px-3"
      style={{
        background: active ? "#1D1D1F" : "#FDFDFD",
        borderColor: active ? "#1D1D1F" : "#DCD8CC",
        color: active ? "#FDFDFD" : "#575A60",
      }}
    >
      {label}
    </button>
  );
}

function Kpi({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix: string;
  color: string;
}) {
  return (
    <div className="af-metric">
      <span className="af-metric-label">{label}</span>
      <span className="af-metric-value af-mono" style={{ color }}>
        {value}
        <span className="ml-1 text-[13px] font-semibold text-[#7A7D85]">{suffix}</span>
      </span>
    </div>
  );
}

function DetailCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2">
      <span className="af-meta font-semibold">{label}</span>
      <span className={`mt-1 block text-[13px] font-semibold text-[#1D1D1F] ${mono ? "af-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function modeLabel(mode: ReportMode) {
  return mode === "agent-hardening" ? "Agent Hardening" : "RL Lab";
}

function modeColor(mode: ReportMode) {
  return mode === "agent-hardening" ? "#2563EB" : "#7C3AED";
}
