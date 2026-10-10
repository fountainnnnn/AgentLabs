import { useEffect, useRef, useState } from "react";
import { Cpu, Database, Download, FileJson, FileText, FlaskConical, GitCompare, Play, ScrollText, Upload } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import WorkspaceShell from "@/components/layout/WorkspaceShell";
import ArenaStage from "@/components/arena/ArenaStage";
import { Chip, ErrorNote, EventLog, LossChart, Metric, Panel, pct } from "@/components/ui";
import { api, type Artifact, type Comparison, type DatasetInfo, type LoraCapabilities, type LoraModel, type Run, type TargetSpec } from "@/lib/api";
import { usePlayback } from "@/lib/usePlayback";
import { titleCase } from "@/lib/arenaPlayback";

const PROVIDER_ID = "__provider__";

export default function RLLabPage() {
  const { state, play, skip, playing, speed, setSpeed, reset } = usePlayback("Select a model and load a dataset.");
  const [models, setModels] = useState<LoraModel[]>([]);
  const [caps, setCaps] = useState<LoraCapabilities | null>(null);
  const [modelId, setModelId] = useState("demo-sim-small-lm");
  const [dataset, setDataset] = useState<DatasetInfo | null>(null);
  const [baseline, setBaseline] = useState<Run | null>(null);
  const [training, setTraining] = useState<Run | null>(null);
  const [checkpoint, setCheckpoint] = useState<Run | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [rank, setRank] = useState(8);
  const [steps, setSteps] = useState(40);
  const [learningRate, setLearningRate] = useState(2e-4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .loraModels()
      .then((r) => {
        setModels(r.models);
        setCaps(r.capabilities);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const model = models.find((m) => m.id === modelId);
  const isProvider = modelId === PROVIDER_ID;
  const target: TargetSpec = isProvider ? { type: "provider" } : model?.source === "simulation" ? { type: "simulated" } : { type: "local", model_id: modelId };
  const truth = isProvider ? undefined : model?.truth_mode === "real_local_model" ? "real" : "simulated";

  const resetFlow = () => {
    setBaseline(null);
    setTraining(null);
    setCheckpoint(null);
    setComparison(null);
    setArtifacts([]);
    reset("Model or dataset changed. Run a baseline evaluation.");
  };

  const chooseModel = (id: string) => {
    setModelId(id);
    resetFlow();
  };

  const loadDemo = async () => {
    setError(null);
    try {
      setDataset(await api.demoDataset());
      resetFlow();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      setDataset(await api.uploadDataset(file));
      resetFlow();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const runStep = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const followTo = async (runId: string, resetArena: boolean) => {
    await play(runId, { reset: resetArena, label: "Run queued" });
    const run = await api.getRun(runId);
    if (run.status === "failed") throw new Error(run.error ?? "Run failed");
    return run;
  };

  const runBaseline = () =>
    runStep("baseline", async () => {
      if (!dataset) return;
      setCheckpoint(null);
      setComparison(null);
      const started = await api.startEvaluation({ dataset_id: dataset.id, target, max_cases: 32 });
      setBaseline(await followTo(started.run_id, true));
    });

  const runTraining = () =>
    runStep("training", async () => {
      if (!dataset) return;
      const started = await api.startTraining({ dataset_id: dataset.id, target, rank, steps, learning_rate: learningRate, batch_size: 4 });
      const run = await followTo(started.run_id, false);
      setTraining(run);
      setArtifacts(await api.listArtifacts(run.id));
    });

  const runCheckpoint = () =>
    runStep("checkpoint", async () => {
      if (!dataset || !training || !baseline) return;
      const started = await api.startEvaluation({ dataset_id: dataset.id, target, max_cases: 32, checkpoint_run_id: training.id, baseline_run_id: baseline.id });
      setCheckpoint(await followTo(started.run_id, false));
      setComparison(await api.comparison(training.id));
      const exported = await api.exportTraining(training.id);
      setArtifacts(exported.artifacts);
    });

  const bm = baseline?.summary.metrics;
  const cm = checkpoint?.summary.metrics;
  const disabled = playing || busy !== null;

  return (
    <WorkspaceShell>
      <AppHeader />
      <main className="af-workspace">
        <aside className="af-left-panel" aria-label="LoRA lab controls">
          <div className="af-left-panel-inner">
            <Panel title="Model" className="af-panel-lavender" icon={<Cpu size={14} aria-hidden />} testId="model-panel" meta={<Chip tone={caps?.mode === "real_local_model" ? "#21865A" : "#C77700"}>{caps?.mode === "real_local_model" ? "Real Local Model Mode" : "Adapter Simulation Mode"}</Chip>}>
              <fieldset className="grid gap-2" disabled={disabled}>
                <legend className="sr-only">Target model</legend>
                {models.map((m) => (
                  <label key={m.id} className="af-row-button flex cursor-pointer items-start gap-3 px-3 py-2" style={{ opacity: m.available ? 1 : 0.55 }}>
                    <input type="radio" name="model" checked={modelId === m.id} disabled={!m.available} onChange={() => chooseModel(m.id)} className="mt-1" />
                    <span className="min-w-0 text-[13px]">
                      <span className="block font-semibold">{m.name}</span>
                      <span className="af-meta block">{m.description}</span>
                      <span className="af-mono text-[11px]" style={{ color: m.truth_mode === "real_local_model" ? "#21865A" : "#C77700" }}>
                        {m.truth_mode}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="af-row-button flex cursor-pointer items-start gap-3 px-3 py-2">
                  <input type="radio" name="model" checked={isProvider} onChange={() => chooseModel(PROVIDER_ID)} className="mt-1" />
                  <span className="text-[13px]">
                    <span className="block font-semibold">Configured LLM provider</span>
                    <span className="af-meta block">Adversarial evaluation only. API models are never fine-tuned.</span>
                  </span>
                </label>
              </fieldset>
              {caps && (
                <ul className="af-meta mt-3 grid list-disc gap-1 pl-4">
                  {caps.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Dataset" className="af-panel-warm" icon={<Database size={14} aria-hidden />} testId="dataset-panel" meta={dataset ? <Chip>{dataset.summary.total_samples} samples</Chip> : null}>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" className="af-button" onClick={() => void loadDemo()} disabled={disabled}>
                  Load demo dataset
                </button>
                <button type="button" className="af-button" onClick={() => fileRef.current?.click()} disabled={disabled}>
                  <Upload size={14} aria-hidden /> Upload JSON, JSONL, CSV
                </button>
                <input ref={fileRef} type="file" accept=".json,.jsonl,.csv" className="hidden" data-testid="dataset-upload" onChange={(e) => void upload(e.target.files?.[0])} />
              </div>
              {dataset && (
                <div className="mt-3 grid gap-2 text-[12px]">
                  <p className="af-body">
                    {dataset.name}: {dataset.summary.should_refuse} adversarial, {dataset.summary.benign_or_grounded} benign or grounded.
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(dataset.summary.categories).map(([k, v]) => (
                      <Chip key={k}>
                        {titleCase(k)} {v}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {!dataset && <p className="af-meta mt-3">Samples need prompt, target, should_refuse and optional forbidden_outputs.</p>}
            </Panel>

            <Panel title="Pipeline" icon={<Play size={14} aria-hidden />} testId="pipeline-panel">
              <ol className="grid gap-3 text-[13px]">
                <li className="grid gap-2">
                  <span className="font-semibold">1. Baseline adversarial evaluation</span>
                  <button type="button" className="af-button af-button-purple" onClick={() => void runBaseline()} disabled={disabled || !dataset}>
                    {busy === "baseline" ? "Evaluating" : "Run baseline"}
                  </button>
                </li>
                <li className="grid gap-2">
                  <span className="font-semibold">2. Train LoRA adapter (base frozen)</span>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="grid gap-1">
                      <span className="af-meta">Rank</span>
                      <select value={rank} onChange={(e) => setRank(Number(e.target.value))} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-2 py-1" disabled={disabled}>
                        {[4, 8, 16, 32].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="af-meta">Steps</span>
                      <select value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-2 py-1" disabled={disabled}>
                        {[10, 20, 40, 80, 160].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="af-meta">Learning rate</span>
                      <select value={learningRate} onChange={(e) => setLearningRate(Number(e.target.value))} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-2 py-1" disabled={disabled}>
                        {[1e-4, 2e-4, 5e-4, 1e-3].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button type="button" className="af-button af-button-purple" onClick={() => void runTraining()} disabled={disabled || !baseline || isProvider}>
                    {busy === "training" ? "Training" : isProvider ? "Not available for API models" : "Train adapter"}
                  </button>
                </li>
                <li className="grid gap-2">
                  <span className="font-semibold">3. Evaluate checkpoint and export</span>
                  <button type="button" className="af-button af-button-purple" onClick={() => void runCheckpoint()} disabled={disabled || !training}>
                    {busy === "checkpoint" ? "Evaluating" : "Evaluate checkpoint"}
                  </button>
                </li>
              </ol>
              <div className="mt-3">
                <ErrorNote message={error} />
              </div>
            </Panel>

            <Panel title="Training" className="af-panel-lavender" icon={<FlaskConical size={14} aria-hidden />} testId="training-panel">
              <LossChart points={state.lossPoints} />
              {training && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <dt className="af-meta">Trainable params</dt>
                  <dd className="af-mono m-0">{Number(training.summary.trainable_params ?? 0).toLocaleString()}</dd>
                  <dt className="af-meta">Frozen params</dt>
                  <dd className="af-mono m-0">{Number(training.summary.frozen_params ?? 0).toLocaleString()}</dd>
                  <dt className="af-meta">Target modules</dt>
                  <dd className="af-mono m-0">{(training.summary.target_modules ?? []).join(", ")}</dd>
                  <dt className="af-meta">Mode</dt>
                  <dd className="af-mono m-0">{training.truth_mode}</dd>
                </dl>
              )}
            </Panel>

            <Panel title="Training Log" icon={<ScrollText size={14} aria-hidden />} meta={<Chip>{state.battle.events.length}</Chip>}>
              <EventLog events={state.battle.events} empty="Evaluation batches, adapter steps and checkpoints are logged here." />
            </Panel>

            <Panel title="Export Artifacts" className="af-panel-cool" icon={<Download size={14} aria-hidden />} testId="lora-exports" meta={<Chip>not_trained_on_openai_weights</Chip>}>
              {artifacts.length === 0 ? (
                <p className="af-meta">Model card, training report, reward trace, adapter config and a zip bundle appear after training.</p>
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

        <section className="af-right-panel" aria-label="LoRA lab arena">
          <ArenaStage
            title="LoRA Training Arena"
            subtitle={`${isProvider ? "Configured LLM provider" : (model?.name ?? "Model")}: baseline, adapter training, checkpoint evaluation`}
            playback={state}
            speed={speed}
            onSpeed={setSpeed}
            onSkip={skip}
            playing={playing}
            accent="#7C3AED"
            truth={baseline?.real_or_simulated ?? truth}
            truthDetail={baseline?.truth_mode ?? model?.truth_mode}
            plannedWaves={4}
          />
          <div className="af-metric-grid mt-3">
            <Metric label="Baseline pass rate" value={pct(bm?.pass_rate)} testId="baseline-pass-rate" />
            <Metric label="Checkpoint pass rate" value={pct(cm?.pass_rate)} color="#7C3AED" testId="checkpoint-pass-rate" />
            <Metric label="Reward" value={cm ? `${bm?.reward?.toFixed(2)} to ${cm.reward.toFixed(2)}` : (bm?.reward?.toFixed(2) ?? "--")} color="#21865A" />
            <Metric label="Leakage rate" value={cm ? `${pct(bm?.leakage_rate)} to ${pct(cm.leakage_rate)}` : pct(bm?.leakage_rate)} color="#C2414B" />
          </div>
          {comparison && (
            <Panel title="Baseline vs checkpoint" className="af-panel mt-3" icon={<GitCompare size={14} aria-hidden />} testId="comparison">
              <p className="af-body mb-3">
                {comparison.comparison.improvements} cases fixed, {comparison.comparison.regressions} regressed. Failure rate {comparison.comparison.before_failure_rate}% to {comparison.comparison.after_failure_rate}%.
                <a className="ml-3 inline-flex items-center gap-1 font-semibold text-[#2563EB]" href={api.reportHtmlUrl(comparison.checkpoint_run_id)} target="_blank" rel="noreferrer">
                  <FileText size={13} aria-hidden /> Printable checkpoint report
                </a>
              </p>
              <div className="overflow-x-auto">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Prompt</th>
                      <th>Base response</th>
                      <th>Adapter response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows
                      .filter((r) => r.base_passed !== r.adapter_passed)
                      .slice(0, 8)
                      .map((r) => (
                        <tr key={r.case_id}>
                          <td>{titleCase(r.category)}</td>
                          <td className="max-w-[240px]">{r.prompt}</td>
                          <td className="max-w-[220px]" style={{ color: r.base_passed ? "#21865A" : "#C2414B" }}>
                            {r.base_response}
                          </td>
                          <td className="max-w-[220px]" style={{ color: r.adapter_passed ? "#21865A" : "#C2414B" }}>
                            {r.adapter_response}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </section>
      </main>
    </WorkspaceShell>
  );
}
