import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileText, RefreshCw } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { Chip, ErrorNote, Metric, Panel, TruthBadge, pct } from "@/components/ui";
import { api, type Run } from "@/lib/api";
import { titleCase } from "@/lib/arenaPlayback";

const KIND_LABEL: Record<string, string> = { hardening: "Agent hardening", model_eval: "Model evaluation", lora_training: "LoRA training" };

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const [runs, setRuns] = useState<Run[]>([]);
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = params.get("run");

  const load = () => api.listRuns().then(setRuns).catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!selected) {
      setReport(null);
      return;
    }
    api.getReport(selected).then(setReport).catch((e: Error) => setError(e.message));
  }, [selected]);

  return (
    <div className="af-page">
      <AppHeader />
      <main className="af-page-main">
        <div className="af-container-wide grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Panel title="Runs" className="af-panel-canvas" testId="run-list" meta={<button type="button" className="af-button min-h-8" onClick={() => void load()} aria-label="Refresh runs"><RefreshCw size={14} aria-hidden /></button>}>
            <ErrorNote message={error} />
            {runs.length === 0 && (
              <p className="af-meta">
                No runs in this browser session yet. Start one in <Link className="text-[#2563EB]" to="/agent-hardening">Agent Hardening</Link> or the <Link className="text-[#2563EB]" to="/rl-lab">LoRA Lab</Link>.
              </p>
            )}
            <ul className="grid gap-2">
              {runs.map((run) => (
                <li key={run.id}>
                  <button type="button" className="af-row-button grid gap-1 px-3 py-2" style={selected === run.id ? { borderColor: "#2563EB" } : undefined} onClick={() => setParams({ run: run.id })}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">{run.name}</span>
                      <Chip tone={run.status === "failed" ? "#C2414B" : run.status === "completed" ? "#21865A" : "#C77700"}>{run.status}</Chip>
                    </span>
                    <span className="af-meta flex justify-between gap-2">
                      <span>{KIND_LABEL[run.kind] ?? run.kind}</span>
                      <span>{run.real_or_simulated}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="grid content-start gap-4" data-testid="report-detail">
            {!report ? <Panel title="Report" className="af-panel-canvas"><p className="af-meta">Select a run to see its report.</p></Panel> : <ReportView report={report} />}
          </div>
        </div>
      </main>
    </div>
  );
}

function ReportView({ report }: { report: Record<string, any> }) {
  const run: Run = report.run;
  return (
    <>
      <section className="af-panel-canvas grid gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="af-section-label">{KIND_LABEL[run.kind] ?? run.kind} report</p>
            <h1 className="mt-2 text-[24px] font-semibold">{run.name}</h1>
            <p className="af-meta af-mono mt-1">
              {run.id} | {run.provider}
            </p>
          </div>
          <span className="flex flex-wrap gap-2">
            <TruthBadge value={report.real_or_simulated} detail={report.truth_mode?.split(":")[0]} />
            <a className="af-button" href={api.reportHtmlUrl(run.id)} target="_blank" rel="noreferrer">
              <FileText size={14} aria-hidden /> Printable report
            </a>
          </span>
        </div>
        {run.error && <p className="text-[13px] text-[#C2414B]">{run.error}</p>}
      </section>
      {run.kind === "hardening" && <HardeningReport report={report} />}
      {run.kind === "model_eval" && <EvalReport report={report} />}
      {run.kind === "lora_training" && <TrainingReport report={report} />}
      <Panel title="Limitations" className="af-panel-warm">
        <ul className="af-body grid list-disc gap-1 pl-5">
          {(report.limitations ?? []).map((line: string) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function HardeningReport({ report }: { report: Record<string, any> }) {
  const s = report.run.summary ?? {};
  return (
    <>
      <div className="af-metric-grid">
        <Metric label="v0 failure rate" value={s.failure_rate_before ?? "--"} unit="%" color="#C2414B" />
        <Metric label={`v${s.final_generation ?? 0} failure rate`} value={s.failure_rate_after ?? "--"} unit="%" color="#21865A" />
        <Metric label="Cases fixed" value={s.improvements ?? 0} />
        <Metric label="Regressions" value={s.regressions ?? 0} />
      </div>
      <Panel title="Category breakdown" className="af-panel">
        <div className="overflow-x-auto">
          <table className="af-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Cases</th>
                <th>v0 failure</th>
                <th>Final failure</th>
              </tr>
            </thead>
            <tbody>
              {(report.category_breakdown ?? []).map((row: any) => (
                <tr key={row.category}>
                  <td>{titleCase(row.category)}</td>
                  <td className="af-mono">{row.total}</td>
                  <td className="af-mono text-[#C2414B]">{row.before_failure_rate}%</td>
                  <td className="af-mono text-[#21865A]">{row.after_failure_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Failure clusters" className="af-panel-cool" testId="failure-clusters">
        <ul className="grid gap-2">
          {(report.failure_clusters ?? []).map((c: any) => (
            <li key={c.failure_category} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] p-3 text-[13px]">
              <span className="flex justify-between">
                <span className="font-semibold">{titleCase(c.failure_category)}</span>
                <span className="af-mono">{c.count}</span>
              </span>
              <span className="af-meta block">{Object.entries(c.categories).map(([k, v]) => `${titleCase(k)} ${v}`).join(", ")}</span>
              {c.example && <span className="af-mono mt-1 block text-[12px] text-[#575A60]">{c.example.reason}</span>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Patch diffs" className="af-panel-lavender" testId="patch-diffs">
        {(report.patch_list ?? []).length === 0 && <p className="af-meta">No patches were needed.</p>}
        {(report.patch_list ?? []).map((p: any) => (
          <div key={p.generation} className="mb-3 grid gap-2">
            <p className="text-[13px] font-semibold">
              {p.title} <span className="af-meta">wave {p.wave}, {p.source}</span>
            </p>
            <p className="af-meta">{p.rationale}</p>
            <pre className="af-mono m-0 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] p-3 text-[11px]">
              {(p.changes.added_system_rules ?? []).map((r: string) => `+ ${r}`).join("\n")}
              {Object.keys(p.changes.tool_policies ?? {}).length ? `\n+ tool_policies ${JSON.stringify(p.changes.tool_policies)}` : ""}
              {(p.changes.added_output_filters ?? []).length ? `\n+ output_filters ${(p.changes.added_output_filters ?? []).map((f: any) => f.type ?? f.pattern).join(", ")}` : ""}
            </pre>
          </div>
        ))}
      </Panel>
      <Panel title="Before and after examples" className="af-panel">
        <div className="grid gap-3">
          {(report.failure_examples ?? []).slice(0, 8).map((ex: any) => (
            <article key={ex.case_id} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] text-[13px]">
              <header className="flex justify-between border-b border-[#ECE8DE] px-3 py-2">
                <span className="font-semibold">{titleCase(ex.category)}</span>
                <span style={{ color: ex.after_passed ? "#21865A" : "#C2414B" }}>{ex.after_passed ? "fixed" : "still failing"}</span>
              </header>
              <p className="px-3 py-2">{ex.prompt}</p>
              <div className="grid border-t border-[#ECE8DE] md:grid-cols-2">
                <p className="m-0 px-3 py-2 text-[#C2414B]">
                  <b>v0:</b> {ex.before_response}
                </p>
                <p className="m-0 border-[#ECE8DE] px-3 py-2 text-[#21865A] md:border-l">
                  <b>Hardened:</b> {ex.after_response}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

function EvalReport({ report }: { report: Record<string, any> }) {
  const m = report.metrics ?? {};
  return (
    <>
      <div className="af-metric-grid">
        <Metric label="Pass rate" value={pct(m.pass_rate)} />
        <Metric label="Reward" value={m.reward?.toFixed?.(2) ?? "--"} color="#21865A" />
        <Metric label="Refusal accuracy" value={pct(m.refusal_accuracy)} />
        <Metric label="Leakage rate" value={pct(m.leakage_rate)} color="#C2414B" />
      </div>
      <Panel title="Category scores" className="af-panel">
        <div className="flex flex-wrap gap-2">
          {Object.entries(report.category_scores ?? {}).map(([k, v]) => (
            <Chip key={k}>
              {titleCase(k)} {pct(v as number)}
            </Chip>
          ))}
        </div>
      </Panel>
      <Panel title="Cases" className="af-panel">
        <div className="overflow-x-auto">
          <table className="af-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Prompt</th>
                <th>Response</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {(report.cases ?? []).slice(0, 40).map((c: any, i: number) => (
                <tr key={`${c.case_id}-${i}`}>
                  <td>{titleCase(c.category)}</td>
                  <td className="max-w-[260px]">{c.prompt}</td>
                  <td className="max-w-[260px]">{c.response}</td>
                  <td style={{ color: c.passed ? "#21865A" : "#C2414B" }}>{c.passed ? "pass" : c.failure_category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function TrainingReport({ report }: { report: Record<string, any> }) {
  const t = report.training ?? {};
  return (
    <div className="af-metric-grid">
      <Metric label="Initial loss" value={t.initial_loss?.toFixed?.(3) ?? "--"} />
      <Metric label="Final loss" value={t.final_loss?.toFixed?.(3) ?? "--"} color="#7C3AED" />
      <Metric label="Trainable params" value={Number(t.trainable_params ?? 0).toLocaleString()} />
      <Metric label="Steps" value={t.params?.steps ?? "--"} />
    </div>
  );
}
