import type { ReactNode } from "react";
import { CircleAlert, FlaskConical, ShieldCheck } from "lucide-react";
import type { BattleEvent } from "@/types/arena";

export function Panel({
  title,
  children,
  className = "af-panel",
  meta,
  icon,
  testId,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  testId?: string;
}) {
  return (
    <section className={`${className} p-4`} data-testid={testId} aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="af-section-label flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: string }) {
  return (
    <span className="af-chip" style={tone ? { color: tone } : undefined}>
      {children}
    </span>
  );
}

/** Always-visible label saying whether results come from a real model/LLM or a simulator. */
export function TruthBadge({ value, detail }: { value: string | undefined; detail?: string }) {
  const real = value === "real";
  return (
    <span
      className="af-chip"
      title={detail}
      data-testid="truth-badge"
      style={{ color: real ? "#21865A" : "#C77700", borderColor: real ? "rgba(33,134,90,0.35)" : "rgba(199,119,0,0.35)" }}
    >
      {real ? <ShieldCheck size={13} aria-hidden /> : <FlaskConical size={13} aria-hidden />}
      {real ? "Real" : "Simulated"}
      {detail ? <span className="af-mono text-[11px] font-medium text-[#7A7D85]">{detail}</span> : null}
    </span>
  );
}

export function Metric({ label, value, unit, color = "#1D1D1F", testId }: { label: string; value: ReactNode; unit?: string; color?: string; testId?: string }) {
  return (
    <div className="af-metric" data-testid={testId}>
      <span className="af-metric-label">{label}</span>
      <span className="af-metric-value af-mono" style={{ color }}>
        {value}
        {unit ? <span className="ml-1 text-[13px] font-semibold text-[#7A7D85]">{unit}</span> : null}
      </span>
    </div>
  );
}

export function EventLog({ events, empty = "No events yet." }: { events: BattleEvent[]; empty?: string }) {
  const visible = events.slice(-60).reverse();
  return (
    <div className="af-log max-h-[320px] overflow-y-auto" data-testid="event-log">
      {visible.length === 0 && <p className="af-meta">{empty}</p>}
      {visible.map((event) => (
        <div key={event.id} className="af-log-row">
          <span
            className="af-mono font-semibold uppercase"
            style={{ color: event.severity === "danger" ? "#C2414B" : event.severity === "success" ? "#21865A" : event.severity === "warning" ? "#C77700" : "#2563EB" }}
          >
            {event.kind}
          </span>
          <span className="af-mono break-words">{event.message}</span>
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-[rgba(194,65,75,0.3)] bg-[rgba(194,65,75,0.06)] px-3 py-2 text-[13px] text-[#C2414B]">
      <CircleAlert size={15} className="mt-0.5 flex-shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Simple loss curve; the series is drawn as an SVG polyline (data, not an icon). */
export function LossChart({ points }: { points: { step: number; loss: number }[] }) {
  if (points.length < 2) {
    return <p className="af-meta">The loss curve appears once training starts.</p>;
  }
  const w = 360;
  const h = 110;
  const maxStep = points[points.length - 1].step;
  const losses = points.map((p) => p.loss);
  const max = Math.max(...losses);
  const min = Math.min(...losses);
  const span = Math.max(max - min, 1e-6);
  const path = points.map((p) => `${((p.step / maxStep) * (w - 8) + 4).toFixed(1)},${(h - 6 - ((p.loss - min) / span) * (h - 14)).toFixed(1)}`).join(" ");
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full rounded-lg border border-[#DCD8CC] bg-[#FDFDFD]" role="img" aria-label="Training loss curve">
        <polyline points={path} fill="none" stroke="#7C3AED" strokeWidth="2" />
      </svg>
      <figcaption className="af-meta mt-1 flex justify-between af-mono">
        <span>step 1: {points[0].loss.toFixed(3)}</span>
        <span>
          step {maxStep}: {points[points.length - 1].loss.toFixed(3)}
        </span>
      </figcaption>
    </figure>
  );
}

export function pct(value: number | undefined | null, digits = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

export function downloadName(kind: string): string {
  return kind.replace(/_/g, " ");
}
