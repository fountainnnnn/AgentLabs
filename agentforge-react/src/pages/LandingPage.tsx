import { useNavigate } from "react-router-dom";

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
    label: "Agent wrapper defense",
    description:
      "Upload an API-based agent, run adversarial harnesses, apply guardrail patches, and create an exportable runtime package.",
    primaryLabel: "Start Agent Hardening",
    secondaryLabel: "Run Demo Agent",
    href: "/agent-hardening",
    panel: "#F2F8FC",
    accent: "#2563EB",
    proof: ["Wrapper export", "Regression traces", "Guardrail patching"],
  },
  {
    title: "LLM Reinforcement Lab",
    label: "Local model improvement",
    description:
      "Upload a small local or open-weight LLM, or use demo mode. Score reward signals, run checkpoint evaluation, and create exportable training artifacts.",
    primaryLabel: "Start RL Lab",
    secondaryLabel: "Run Demo Lab",
    href: "/rl-lab",
    panel: "#F4F1F8",
    accent: "#7C3AED",
    proof: ["Demo Simulation Mode", "Reward signals", "Checkpoint evaluation"],
  },
];

export default function ModeSelectionPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-dvh bg-[#FCFCF7] text-[#1D1D1F]"
      style={{
        fontFamily:
          "Bahnschrift, Geist, 'Segoe UI Variable', 'SF Pro Display', 'SF Pro Text', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontVariantLigatures: "common-ligatures",
      }}
    >
      <header className="border-b border-[#DCD8CC] bg-[#FAF9F6]">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="group flex min-w-0 items-center gap-3 rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF9F6]"
            aria-label="AgentForge home"
          >
            <img
              src="/assets/agentforge/brand/agentforge-logo.png"
              alt=""
              aria-hidden="true"
              className="h-9 w-9 flex-shrink-0 object-contain transition duration-200 group-hover:scale-[1.03]"
            />
            <span className="min-w-0">
              <span className="block text-[18px] font-semibold leading-none">
                AgentForge
              </span>
              <span className="mt-1 block text-[12px] font-medium text-[#575A60]">
                Adversarial training for agents and models
              </span>
            </span>
          </button>

          <div className="hidden items-center gap-2 lg:flex">
            <Chip label="Demo ready" />
            <Chip label="OpenAI API optional" />
            <Chip label="Local LLM supported" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-6 lg:hidden">
          <Chip label="Demo ready" />
          <Chip label="OpenAI API optional" />
          <Chip label="Local LLM supported" />
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-65px)] grid-rows-[minmax(0,1fr)_auto] overflow-x-hidden">
        <section className="grid min-h-[560px] border-b border-[#DCD8CC] lg:grid-cols-[0.35fr_0.65fr]">
          <div className="flex flex-col justify-between border-[#DCD8CC] px-4 py-8 sm:px-6 lg:border-r lg:py-8">
            <div className="max-w-[560px]">
              <p className="text-[13px] font-semibold leading-5 text-[#7A7D85]">
                Mode selection
              </p>
              <h1 className="mt-3 text-[36px] font-semibold leading-[1.04] text-[#1D1D1F] sm:text-[44px]">
                Choose the training surface.
              </h1>
              <p className="mt-5 max-w-[42rem] text-[15px] leading-7 text-[#575A60]">
                AgentForge turns adversarial checks into a visible loop: spawn
                harnesses, attack or evaluate, verify results, improve the
                target, retest, and export the evidence.
              </p>
            </div>

            <p className="mt-10 max-w-[34rem] border-t border-[#DCD8CC] pt-4 text-[13px] font-medium leading-5 text-[#33363D]">
              Agent mode exports hardened wrappers. RL Lab mode targets uploaded
              or local open-weight models.
            </p>
          </div>

          <div className="grid min-h-0 grid-rows-[minmax(240px,0.9fr)_auto] gap-3 p-4 sm:p-5">
            <figure className="relative min-h-[240px] overflow-hidden rounded-[20px] border border-[#DCD8CC] bg-[#FAF9F6] lg:min-h-[300px]">
              <img
                src="/assets/agentforge/brand/menu-arena-plate.png"
                alt="Generated tactical arena visualization showing adversarial harness waves approaching a defended agent core."
                className="absolute inset-0 h-full w-full object-cover"
              />
            </figure>

            <section className="grid gap-4 xl:grid-cols-2">
              {modes.map((mode) => (
                <ModeCard
                  key={mode.title}
                  {...mode}
                  onPrimary={() => navigate(mode.href)}
                  onSecondary={() => navigate(mode.href)}
                />
              ))}
            </section>
          </div>
        </section>

        <section className="bg-[#FAF9F6] px-4 py-4 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center">
            <p className="text-[13px] font-semibold text-[#575A60]">
              Process
            </p>
            <ol className="grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-7">
              {processSteps.map((step, index) => (
                <li
                  key={step}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-center border-t border-[#DCD8CC] pt-2 text-[12px] font-semibold text-[#33363D]"
                >
                  <span
                    className="font-mono text-[11px] text-[#7A7D85]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

function ModeCard({
  title,
  label,
  description,
  primaryLabel,
  secondaryLabel,
  panel,
  accent,
  proof,
  onPrimary,
  onSecondary,
}: {
  title: string;
  label: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  panel: string;
  accent: string;
  proof: string[];
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <article
      className="group flex min-h-[276px] flex-col rounded-xl border border-[#DCD8CC] transition duration-200 hover:-translate-y-0.5 hover:border-[#C7C2B8]"
      style={{ backgroundColor: panel }}
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-[13px] font-semibold leading-5" style={{ color: accent }}>
            {label}
          </p>
          <span
            className="h-2 w-16 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
        </div>

        <h2 className="max-w-[28rem] text-[24px] font-semibold leading-[1.12] text-[#1D1D1F] sm:text-[28px]">
          {title}
        </h2>
        <p className="mt-3 max-w-[38rem] text-[14px] leading-6 text-[#575A60]">
          {description}
        </p>

        <dl className="mt-4 grid gap-2 border-y border-[#DCD8CC] py-3">
          {proof.map((item) => (
            <div
              key={item}
              className="grid grid-cols-[12px_minmax(0,1fr)] items-center gap-3 text-[13px] font-medium text-[#33363D]"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accent }}
                aria-hidden="true"
              />
              <dd>{item}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-2 border-t border-[#DCD8CC] p-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPrimary}
          className="min-h-11 rounded-lg px-4 text-[14px] font-semibold text-white transition duration-200 hover:brightness-95 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            backgroundColor: accent,
            ["--tw-ring-color" as string]: accent,
          }}
        >
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={onSecondary}
          className="min-h-11 rounded-lg border bg-[#FDFDFD] px-4 text-[14px] font-semibold transition duration-200 hover:bg-[#FAF9F6] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            borderColor: `${accent}55`,
            color: accent,
            ["--tw-ring-color" as string]: accent,
          }}
        >
          {secondaryLabel}
        </button>
      </div>
    </article>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 text-[12px] font-semibold text-[#575A60]">
      {label}
    </span>
  );
}
