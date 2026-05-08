import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type ExportMode = "agent-hardening" | "rl-lab";
type Filter = "all" | ExportMode;

interface ExportArtifact {
  id: string;
  runId: string;
  filename: string;
  type: string;
  source: ExportMode;
  format: "json" | "py" | "zip" | "md" | "csv" | "yaml";
  size: string;
  generatedAt: string;
  realOrSimulated: "demo_simulation" | "adapter_simulation" | "real_local_model";
  limitations: string[];
  metadata: Record<string, string | number | boolean>;
}

const artifacts: ExportArtifact[] = [
  {
    id: "exp-agent-runtime",
    runId: "AH-2026-0507-001",
    filename: "refundbot_hardened_runtime.json",
    type: "Hardened wrapper runtime",
    source: "agent-hardening",
    format: "json",
    size: "18 KB",
    generatedAt: "2026-05-07 14:31",
    realOrSimulated: "demo_simulation",
    limitations: [
      "Contains wrapper prompts, verifier policy, output filters, and tool constraints only.",
      "Does not export model weights.",
    ],
    metadata: {
      export_type: "hardened_wrapper",
      model_weights_exported: false,
      real_or_simulated: "demo_simulation",
    },
  },
  {
    id: "exp-agent-report",
    runId: "AH-2026-0507-001",
    filename: "refundbot_wave_report.json",
    type: "Verifier report",
    source: "agent-hardening",
    format: "json",
    size: "42 KB",
    generatedAt: "2026-05-07 14:32",
    realOrSimulated: "demo_simulation",
    limitations: [
      "Run uses deterministic demo behavior unless connected to a live target agent.",
      "Report describes observed wrapper behavior, not guaranteed future behavior.",
    ],
    metadata: {
      structured_logs: true,
      trace_count: 48,
      real_or_simulated: "demo_simulation",
    },
  },
  {
    id: "exp-agent-runner",
    runId: "AH-2026-0507-001",
    filename: "refundbot_guarded_runner.py",
    type: "Runtime runner",
    source: "agent-hardening",
    format: "py",
    size: "7 KB",
    generatedAt: "2026-05-07 14:33",
    realOrSimulated: "demo_simulation",
    limitations: [
      "Runner enforces wrapper constraints around the configured target.",
      "Runner is not a standalone language model.",
    ],
    metadata: {
      export_type: "runtime_runner",
      wrapper_only: true,
      real_or_simulated: "demo_simulation",
    },
  },
  {
    id: "exp-rl-card",
    runId: "RL-2026-0507-001",
    filename: "local_model_card.md",
    type: "Model card",
    source: "rl-lab",
    format: "md",
    size: "6 KB",
    generatedAt: "2026-05-07 15:04",
    realOrSimulated: "adapter_simulation",
    limitations: [
      "Demo Simulation Mode was used because no local model was uploaded.",
      "No OpenAI API model weights were trained.",
    ],
    metadata: {
      not_trained_on_openai_weights: true,
      real_or_simulated: "adapter_simulation",
      local_model_uploaded: false,
    },
  },
  {
    id: "exp-rl-reward",
    runId: "RL-2026-0507-001",
    filename: "reward_trace.csv",
    type: "Reward trace",
    source: "rl-lab",
    format: "csv",
    size: "22 KB",
    generatedAt: "2026-05-07 15:05",
    realOrSimulated: "adapter_simulation",
    limitations: [
      "Reward values are deterministic simulation values in demo mode.",
      "A real trace requires a selected local or open-weight model.",
    ],
    metadata: {
      reward_components: 9,
      not_trained_on_openai_weights: true,
      real_or_simulated: "adapter_simulation",
    },
  },
  {
    id: "exp-rl-adapter",
    runId: "RL-2026-0507-001",
    filename: "adapter_config.yaml",
    type: "Adapter config",
    source: "rl-lab",
    format: "yaml",
    size: "3 KB",
    generatedAt: "2026-05-07 15:05",
    realOrSimulated: "adapter_simulation",
    limitations: [
      "Adapter configuration is simulated until a local training dependency is available.",
      "Base model is recorded as frozen in the export metadata.",
    ],
    metadata: {
      frozen_base: true,
      not_trained_on_openai_weights: true,
      real_or_simulated: "adapter_simulation",
    },
  },
];

export default function ExportsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(artifacts[0].id);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filteredArtifacts = useMemo(
    () => artifacts.filter((artifact) => filter === "all" || artifact.source === filter),
    [filter],
  );

  const selectedArtifact =
    filteredArtifacts.find((artifact) => artifact.id === selectedId) ??
    filteredArtifacts[0] ??
    artifacts[0];

  const groupedByRun = useMemo(() => {
    return filteredArtifacts.reduce<Record<string, ExportArtifact[]>>((groups, artifact) => {
      groups[artifact.runId] = [...(groups[artifact.runId] ?? []), artifact];
      return groups;
    }, {});
  }, [filteredArtifacts]);

  const handleDownload = useCallback((artifact: ExportArtifact) => {
    setDownloadingId(artifact.id);
    window.setTimeout(() => {
      const payload = {
        artifact: artifact.filename,
        type: artifact.type,
        source: artifact.source,
        real_or_simulated: artifact.realOrSimulated,
        not_trained_on_openai_weights:
          artifact.source === "rl-lab" ? true : "not_applicable",
        limitations: artifact.limitations,
        metadata: artifact.metadata,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = artifact.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setDownloadingId(null);
    }, 300);
  }, []);

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
            <span className="af-brand-subtitle">Exported artifacts</span>
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
                <p className="af-section-label">Artifact registry</p>
                <h1 className="mt-3 text-[28px] font-semibold leading-tight text-[#1D1D1F] md:text-[34px]">
                  Exports
                </h1>
                <p className="mt-2 max-w-[780px] text-[14px] leading-6 text-[#575A60]">
                  Browse runtime packages, reports, reward traces, model cards,
                  and adapter configs with the metadata required to separate real
                  execution from simulation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="af-chip">real_or_simulated</span>
                <span className="af-chip">limitations</span>
                <span className="af-chip">metadata required</span>
              </div>
            </div>
          </section>

          <section className="af-metric-grid" aria-label="Export summary">
            <Kpi label="Artifacts" value={filteredArtifacts.length} suffix="visible" color="#1D1D1F" />
            <Kpi
              label="Runs"
              value={Object.keys(groupedByRun).length}
              suffix="grouped"
              color="#0284C7"
            />
            <Kpi
              label="RL safety"
              value="true"
              suffix="not OpenAI weights"
              color="#7C3AED"
            />
            <Kpi label="Limitations" value="100" suffix="percent" color="#21865A" />
          </section>

          <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(560px,1fr)_minmax(420px,0.72fr)]">
            <div className="af-panel-canvas min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCD8CC] px-4 py-3">
                <p className="af-section-label">Files by run</p>
                <span className="af-chip af-mono">{filteredArtifacts.length} artifacts</span>
              </div>

              <div className="grid gap-5 p-4">
                {Object.entries(groupedByRun).map(([runId, runArtifacts]) => (
                  <section key={runId} className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="af-mono text-[12px] font-bold text-[#1D1D1F]">{runId}</span>
                      <span
                        className="af-chip"
                        style={{ color: modeColor(runArtifacts[0].source) }}
                      >
                        {modeLabel(runArtifacts[0].source)}
                      </span>
                      <span className="af-meta">{runArtifacts.length} files</span>
                    </div>

                    <div className="grid gap-2">
                      {runArtifacts.map((artifact) => {
                        const active = selectedArtifact.id === artifact.id;
                        const downloading = downloadingId === artifact.id;
                        return (
                          <button
                            key={artifact.id}
                            type="button"
                            onClick={() => setSelectedId(artifact.id)}
                            className="grid min-h-[74px] min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-xl border px-3 py-2 text-left sm:grid-cols-[40px_minmax(0,1fr)_auto]"
                            style={{
                              background: active ? "#F0F8FF" : "#FDFDFD",
                              borderColor: active ? "rgba(37,99,235,0.34)" : "#DCD8CC",
                            }}
                          >
                            <span
                              className="af-mono flex h-10 w-10 items-center justify-center rounded-lg border text-[11px] font-bold"
                              style={{
                                borderColor: `${modeColor(artifact.source)}44`,
                                background: `${modeColor(artifact.source)}12`,
                                color: modeColor(artifact.source),
                              }}
                            >
                              {artifact.format.toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-semibold text-[#1D1D1F]">
                                {artifact.filename}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#7A7D85]">
                                <span>{artifact.type}</span>
                                <span className="af-mono">{artifact.size}</span>
                                <span>{artifact.generatedAt}</span>
                              </span>
                            </span>
                            <span
                              role="status"
                              className="af-chip col-start-2 min-w-0 justify-self-start sm:col-start-auto sm:justify-self-end"
                              style={{ color: artifact.source === "rl-lab" ? "#7C3AED" : "#2563EB" }}
                            >
                              {downloading ? "Preparing" : artifact.realOrSimulated}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <aside className="grid min-w-0 gap-4">
              <section className="af-panel-canvas min-w-0 overflow-hidden p-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="af-section-label">Selected artifact</p>
                    <h2 className="mt-2 truncate text-[21px] font-semibold leading-tight text-[#1D1D1F]">
                      {selectedArtifact.filename}
                    </h2>
                    <p className="mt-1 text-[13px] text-[#575A60]">{selectedArtifact.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedArtifact)}
                    disabled={downloadingId === selectedArtifact.id}
                    className={`af-button shrink-0 ${selectedArtifact.source === "rl-lab" ? "af-button-purple" : "af-button-primary"}`}
                  >
                    {downloadingId === selectedArtifact.id ? "Preparing" : "Download"}
                  </button>
                </div>

                <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <DetailCell label="Run" value={selectedArtifact.runId} mono />
                  <DetailCell label="Format" value={selectedArtifact.format.toUpperCase()} mono />
                  <DetailCell label="Source" value={modeLabel(selectedArtifact.source)} />
                  <DetailCell label="real_or_simulated" value={selectedArtifact.realOrSimulated} mono />
                </div>
              </section>

              <section className="af-panel-warm min-w-0 overflow-hidden p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="af-section-label">Limitations</p>
                  <span className="af-chip">Required</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedArtifact.limitations.map((limitation) => (
                    <div
                      key={limitation}
                      className="min-w-0 break-words rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2 text-[13px] leading-5 text-[#575A60]"
                    >
                      {limitation}
                    </div>
                  ))}
                </div>
              </section>

              <section className="af-panel-cool min-w-0 overflow-hidden p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="af-section-label">Metadata preview</p>
                  <span className="af-chip">Export contract</span>
                </div>
                <pre className="af-mono mt-3 max-w-full whitespace-pre-wrap break-all rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] p-3 text-[12px] leading-5 text-[#575A60]">
                  {JSON.stringify(
                    {
                      artifact: selectedArtifact.filename,
                      real_or_simulated: selectedArtifact.realOrSimulated,
                      not_trained_on_openai_weights:
                        selectedArtifact.source === "rl-lab" ? true : "not_applicable",
                      limitations: selectedArtifact.limitations,
                      metadata: selectedArtifact.metadata,
                    },
                    null,
                    2,
                  )}
                </pre>
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
    <div className="min-w-0 rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2">
      <span className="af-meta font-semibold">{label}</span>
      <span className={`mt-1 block text-[13px] font-semibold text-[#1D1D1F] ${mono ? "af-mono break-all" : "break-words"}`}>
        {value}
      </span>
    </div>
  );
}

function modeLabel(mode: ExportMode) {
  return mode === "agent-hardening" ? "Agent Hardening" : "RL Lab";
}

function modeColor(mode: ExportMode) {
  return mode === "agent-hardening" ? "#2563EB" : "#7C3AED";
}
