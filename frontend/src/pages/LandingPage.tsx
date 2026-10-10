import { Link, useNavigate } from "react-router-dom";

const processSteps = [
  "Upload",
  "Spawn Harnesses",
  "Attack or Evaluate",
  "Verify or Score",
  "Patch or Train",
  "Retest",
  "Export",
];

const modes = [
  {
    title: "Agentic AI Tool Hardening",
    eyebrow: "API agent defense",
    description:
      "Upload an API-based agent, spawn adversarial harnesses, patch weak guardrails, retest across waves, and export a hardened runtime package.",
    primaryLabel: "Start Agent Hardening",
    secondaryLabel: "Run Demo Agent",
    href: "/agent-hardening",
    accent: "#2563EB",
    panelClass: "af-panel-cool",
    tags: [
      "Prompt Guard",
      "Tool Safety",
      "Deterministic Verifiers",
      "Regression Testing",
      "Agent Export",
    ],
  },
  {
    title: "LLM Reinforcement Lab",
    eyebrow: "Local model improvement",
    description:
      "Upload a small local or open-weight LLM or run the demo lab. Evaluate behavior with adversarial harnesses, score outputs with reward signals, run checkpoint evaluation, and exportable training artifacts.",
    primaryLabel: "Start RL Lab",
    secondaryLabel: "Run Demo Lab",
    href: "/rl-lab",
    accent: "#7C3AED",
    panelClass: "af-panel-lavender",
    tags: [
      "Local LLM Upload",
      "LoRA Adapter",
      "Reward Optimization",
      "Frozen Base",
      "Checkpoint Evaluation",
      "Accuracy and Speed",
    ],
  },
];

const capabilityRows = [
  ["Target", "API-based agent wrappers", "Local or open-weight LLMs"],
  ["Improvement", "Prompts, tool schemas, verifiers, output filters", "Reward scoring, adapter updates, checkpoint evaluation"],
  ["Evidence", "Harness traces, verifier failures, patch diffs", "Reward trace, penalties, checkpoint metrics"],
  ["Artifacts", "Hardened runtime package and test report", "Training report, model card, adapter config"],
];

const readinessRows = [
  ["Runtime", "Runs without an OpenAI API key using deterministic demo data"],
  ["Simulation", "RL Lab labels demo and adapter simulation mode clearly"],
  ["Exports", "Artifacts include metadata, limitations, and real_or_simulated"],
];

export default function ModeSelectionPage() {
  const navigate = useNavigate();

  return (
    <div className="af-page">
      <header className="af-topbar flex items-center justify-between gap-4 px-5">
        <Link to="/" className="af-brand-link" aria-label="AgentForge home">
          <img
            src="/assets/agentforge/brand/agentforge-logo.png"
            alt=""
            aria-hidden="true"
            className="af-brand-logo"
          />
          <span>
            <span className="af-brand-word">AgentForge</span>
            <span className="af-brand-subtitle">
              Adversarial training for agents and models
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          <Link className="af-button af-button-quiet" to="/reports">
            Reports
          </Link>
          <Link className="af-button af-button-quiet" to="/exports">
            Exports
          </Link>
        </nav>
      </header>

      <main className="af-page-main">
        <div className="af-container-wide grid gap-4">
          <section className="grid gap-4 xl:grid-cols-[0.42fr_0.58fr]">
            <div className="af-panel-canvas flex min-h-[420px] flex-col justify-between p-6">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Chip label="Demo ready" />
                  <Chip label="OpenAI API optional" />
                  <Chip label="Local LLM supported" />
                  <Chip label="Wrapper export" />
                  <Chip label="RL Lab simulation" />
                </div>
                <p className="af-section-label mt-10">AI evaluation workbench</p>
                <h1 className="mt-4 max-w-[720px] text-[36px] font-semibold leading-[1.06] text-[#1D1D1F] md:text-[44px]">
                  Adversarial training for agents and models.
                </h1>
                <p className="mt-5 max-w-[680px] text-[15px] leading-7 text-[#575A60]">
                  Run structured attacks, inspect failures, apply targeted
                  hardening or adapter updates, and export evidence that says
                  exactly what was real and what was simulated.
                </p>
              </div>

              <p className="mt-8 border-t border-[#DCD8CC] pt-4 text-[13px] font-semibold leading-5 text-[#33363D]">
                Agent mode exports hardened wrappers. RL Lab mode targets uploaded
                or local open-weight models.
              </p>
            </div>

            <figure className="af-panel-canvas relative min-h-[420px] overflow-hidden">
              <img
                src="/assets/agentforge/brand/menu-arena-plate.png"
                alt="Generated tactical arena visualization showing adversarial harness waves approaching a defended agent core."
                className="absolute inset-0 h-full w-full object-cover"
              />
            </figure>
          </section>

          <section className="grid gap-4 xl:grid-cols-2" aria-label="Product modes">
            {modes.map((mode) => (
              <ModeCard
                key={mode.title}
                {...mode}
                onPrimary={() => navigate(mode.href)}
                onSecondary={() => navigate(mode.href)}
              />
            ))}
          </section>

          <section className="af-panel-canvas p-4">
            <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center">
              <p className="af-section-label">Process</p>
              <ol className="grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-7">
                {processSteps.map((step, index) => (
                  <li
                    key={step}
                    className="grid min-h-10 grid-cols-[32px_minmax(0,1fr)] items-center border-t border-[#DCD8CC] pt-2 text-[12px] font-semibold text-[#33363D]"
                  >
                    <span className="af-mono text-[11px] text-[#7A7D85]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="af-panel-canvas overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#DCD8CC] px-4 py-3">
                <p className="af-section-label">Capability matrix</p>
                <span className="af-chip">Truthful exports</span>
              </div>
              <div className="overflow-x-auto">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th>Agent Hardening</th>
                      <th>RL Lab</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capabilityRows.map(([capability, agent, lab]) => (
                      <tr key={capability}>
                        <td className="font-semibold text-[#1D1D1F]">{capability}</td>
                        <td>{agent}</td>
                        <td>{lab}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="af-panel-warm p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="af-section-label">Demo readiness</p>
                <span className="af-status-chip">
                  <span className="af-status-dot" />
                  Ready
                </span>
              </div>
              <div className="mt-4 grid gap-2">
                {readinessRows.map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-t border-[#DCD8CC] pt-3 text-[13px]"
                  >
                    <span className="font-semibold text-[#1D1D1F]">{label}</span>
                    <span className="leading-5 text-[#575A60]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ModeCard({
  title,
  eyebrow,
  description,
  primaryLabel,
  secondaryLabel,
  href,
  panelClass,
  accent,
  tags,
  onPrimary,
  onSecondary,
}: {
  title: string;
  eyebrow: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  href: string;
  panelClass: string;
  accent: string;
  tags: string[];
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <article className={`${panelClass} flex min-h-[360px] flex-col p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold leading-5" style={{ color: accent }}>
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-[560px] text-[28px] font-semibold leading-[1.12] text-[#1D1D1F]">
            {title}
          </h2>
        </div>
        <span
          className="mt-2 h-2 w-20 rounded-[3px]"
          style={{ background: accent }}
          aria-hidden="true"
        />
      </div>

      <p className="mt-4 max-w-[720px] text-[14px] leading-6 text-[#575A60]">
        {description}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="af-chip">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto grid gap-2 border-t border-[#DCD8CC] pt-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPrimary}
          className={`af-button ${accent === "#7C3AED" ? "af-button-purple" : "af-button-primary"} min-h-11`}
        >
          {primaryLabel}
        </button>
        <button type="button" onClick={onSecondary} className="af-button min-h-11">
          {secondaryLabel}
        </button>
      </div>
      <Link to={href} className="sr-only">
        Open mode workspace
      </Link>
    </article>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="af-chip">{label}</span>;
}
