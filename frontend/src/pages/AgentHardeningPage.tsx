import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileJson, FileText, GitBranch, Play, ScrollText, ShieldAlert, Upload, Wrench } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import ArenaStage from "@/components/arena/ArenaStage";
import { Chip, ErrorNote, EventLog, Metric, Panel } from "@/components/ui";
import { api, type AgentConfig, type AgentSummary, type Artifact, type Run } from "@/lib/api";
import { usePlayback } from "@/lib/usePlayback";

const DEMO_ID = "agent_demo_refundbot";
type PublicConfig = Omit<AgentConfig, "secrets"> & { secrets_count?: number };

export default function AgentHardeningPage() {
  const { state, play, skip, playing, speed, setSpeed } = usePlayback("Load an agent and start a hardening run.");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentId, setAgentId] = useState(DEMO_ID);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [waves, setWaves] = useState(3);
  const [casesPerWave, setCasesPerWave] = useState(8);
  const [run, setRun] = useState<Run | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [truth, setTruth] = useState<{ value: string; detail: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshAgents = useCallback(() => api.listAgents().then(setAgents).catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    void refreshAgents();
  }, [refreshAgents]);
  useEffect(() => {
    api.getAgent(agentId).then((a) => setConfig(a.config as PublicConfig)).catch((e: Error) => setError(e.message));
  }, [agentId]);

  const adoptAgent = async (created: AgentSummary) => {
    await refreshAgents();
    setAgentId(created.id);
    setError(null);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      await adoptAgent(await api.uploadAgent(file));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onPaste = async () => {
    try {
      await adoptAgent(await api.createAgent(JSON.parse(pasted)));
      setPasted("");
    } catch (e) {
      setError(e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : (e as Error).message);
    }
  };

  const startRun = async () => {
    setError(null);
    setArtifacts([]);
    setRun(null);
    try {
      const started = await api.startHardening({ agent_id: agentId, waves, cases_per_wave: casesPerWave });
      setTruth({ value: started.real_or_simulated, detail: started.truth_mode.split(":")[0] });
      const final = await play(started.run_id, { label: "Run queued" });
      const finished = await api.getRun(started.run_id);
      setRun(finished);
      if (finished.status === "completed") setArtifacts(await api.listArtifacts(started.run_id));
      if (final.failed || finished.error) setError(finished.error ?? "Run failed");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const b = state.battle;
  const summary = run?.summary ?? {};
  const latest = state.patches[state.patches.length - 1];

  return (
    <WorkspaceShell>
      <AppHeader />
      <main className="af-workspace">
        <aside className="af-left-panel" aria-label="Agent hardening controls">
          <div className="af-left-panel-inner">
            <Panel title="Agent Source" className="af-panel-cool" icon={<ShieldAlert size={14} aria-hidden />} testId="agent-source" meta={<Chip>{config?.version ?? "v0"}</Chip>}>
              <label className="grid gap-1 text-[13px]">
                <span className="font-semibold text-[#575A60]">Target agent</span>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2" disabled={playing}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.source === "demo" ? "(demo)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {config && (
                <div className="mt-3 grid gap-2 text-[12px]">
                  <p className="af-body line-clamp-3">{config.description || "Uploaded agent configuration."}</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip>{config.tools.length} tools</Chip>
                    <Chip>{config.policies.length} policies</Chip>
                    <Chip>{config.secrets_count ?? 0} secrets (hidden)</Chip>
                    <Chip>{config.system_prompt.length.toLocaleString()} char prompt</Chip>
                  </div>
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" className="af-button" onClick={() => setAgentId(DEMO_ID)} disabled={playing}>
                  Load RefundBot demo
                </button>
                <button type="button" className="af-button" onClick={() => fileRef.current?.click()} disabled={playing}>
                  <Upload size={14} aria-hidden /> Upload agent.json
                </button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-testid="agent-upload" onChange={(e) => void onUpload(e.target.files?.[0])} />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-[#575A60]">Paste an agent config</summary>
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={5}
                  className="af-mono mt-2 w-full rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] p-2 text-[12px]"
                  placeholder='{"name": "My agent", "system_prompt": "...", "tools": [{"name": "lookup_order"}], "secrets": ["..."]}'
                  aria-label="Agent config JSON"
                />
                <button type="button" className="af-button mt-2" onClick={() => void onPaste()} disabled={!pasted.trim() || playing}>
                  Use pasted config
                </button>
              </details>
            </Panel>

            <Panel title="Hardening Run" className="af-panel-warm" icon={<Play size={14} aria-hidden />}>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <label className="grid gap-1">
                  <span className="font-semibold text-[#575A60]">Waves</span>
                  <select value={waves} onChange={(e) => setWaves(Number(e.target.value))} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2" disabled={playing}>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="font-semibold text-[#575A60]">Attacks per wave</span>
                  <select value={casesPerWave} onChange={(e) => setCasesPerWave(Number(e.target.value))} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2" disabled={playing}>
                    {[4, 6, 8].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="af-meta mt-3">
                Each wave attacks the current generation, verifies replies with 11 deterministic rules, patches the wrapper if anything breaches, and retests the same attacks. A final regression suite compares v0 with the hardened generation on every case.
              </p>
              <button type="button" className="af-button af-button-primary mt-3 w-full" onClick={() => void startRun()} disabled={playing}>
                <Play size={15} aria-hidden /> {playing ? "Run in progress" : "Start hardening run"}
              </button>
              <div className="mt-3">
                <ErrorNote message={error} />
              </div>
            </Panel>

            <Panel title="Agent Generations" icon={<GitBranch size={14} aria-hidden />} testId="generations">
              <ol className="grid gap-2">
                <li className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2">
                  <span className="af-mono font-bold text-[#2563EB]">v0</span>
                  <span className="text-[13px]">Original agent as loaded</span>
                </li>
                {state.patches.map((p, i) => (
                  <li key={p.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-lg border px-3 py-2" style={{ borderColor: i === state.patches.length - 1 ? "rgba(124,58,237,0.4)" : "#DCD8CC", background: "#FDFDFD" }}>
                    <span className="af-mono font-bold text-[#7C3AED]">v{i + 1}</span>
                    <span className="min-w-0 text-[13px]">
                      <span className="block font-semibold">{p.title.replace(/^v\d+: /, "")}</span>
                      <span className="af-meta">
                        {p.addedRules.length} rules, {p.restrictedTools.length} tool gates, {p.outputFilters.length} filters
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel title="Latest Patch" className="af-panel-lavender" icon={<Wrench size={14} aria-hidden />} testId="latest-patch">
              {!latest ? (
                <p className="af-meta">No patch yet. Patches are generated from failing cases.</p>
              ) : (
                <div className="grid gap-2 text-[12px]">
                  <p className="font-semibold text-[13px]">{latest.title}</p>
                  {latest.addedRules.map((rule) => (
                    <pre key={rule} className="af-mono m-0 whitespace-pre-wrap rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] p-2 text-[11px]">
                      + {rule}
                    </pre>
                  ))}
                  {latest.restrictedTools.length > 0 && <p>Tool gate: {latest.restrictedTools.join(", ")}</p>}
                  {latest.outputFilters.length > 0 && <p>Output filters: {latest.outputFilters.join(", ")}</p>}
                </div>
              )}
            </Panel>

            <Panel title="Evaluation Log" icon={<ScrollText size={14} aria-hidden />} meta={<Chip>{b.events.length}</Chip>}>
              <EventLog events={b.events} empty="Start a run to stream attack, verifier, patch and retest events." />
            </Panel>

            <Panel title="Export Package" className="af-panel-cool" icon={<Download size={14} aria-hidden />} testId="export-panel">
              {artifacts.length === 0 ? (
                <p className="af-meta">Artifacts appear when a run completes: hardened agent.json, report, runner.py and a zip bundle. No model weights are exported.</p>
              ) : (
                <ul className="grid gap-2">
                  {artifacts.map((a) => (
                    <li key={a.id}>
                      <a className="af-button w-full justify-between" href={api.downloadUrl(a)} download={a.filename}>
                        <span className="flex items-center gap-2">
                          <FileJson size={14} aria-hidden />
                          {a.filename}
                        </span>
                        <span className="af-meta">{a.real_or_simulated}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </aside>

        <section className="af-right-panel" aria-label="Agent hardening arena">
          <ArenaStage
            title="Agent Hardening Arena"
            subtitle={config ? `${config.name}: attack, verify, patch, retest` : "Loading agent"}
            playback={state}
            speed={speed}
            onSpeed={setSpeed}
            onSkip={skip}
            playing={playing}
            accent="#2563EB"
            truth={truth?.value}
            truthDetail={truth?.detail}
            plannedWaves={waves}
          />
          <div className="af-metric-grid mt-3">
            <Metric label="Integrity" value={b.integrity} unit="%" />
            <Metric label="Attacks blocked" value={b.metrics.passed} color="#21865A" testId="metric-passed" />
            <Metric label="Breaches" value={b.metrics.failed} color="#C2414B" testId="metric-failed" />
            <Metric
              label="Failure rate v0 to final"
              value={state.regression ? `${state.regression.before_failure_rate}% to ${state.regression.after_failure_rate}%` : "--"}
              color="#7C3AED"
              testId="metric-regression"
            />
          </div>
          {run?.status === "completed" && (
            <div className="af-panel mt-3 flex flex-wrap items-center justify-between gap-3 p-4" data-testid="run-summary">
              <p className="text-[14px]">
                {summary.agent}: {summary.total_cases} attacks, {summary.improvements} fixed, {summary.regressions} regressions, final generation v{summary.final_generation}.
              </p>
              <span className="flex gap-2">
                <a className="af-button" href={api.reportHtmlUrl(run.id)} target="_blank" rel="noreferrer">
                  <FileText size={14} aria-hidden /> Printable report
                </a>
                <Link className="af-button" to={`/reports?run=${run.id}`}>
                  Open in Reports
                </Link>
              </span>
            </div>
          )}
        </section>
      </main>
    </WorkspaceShell>
  );
}
