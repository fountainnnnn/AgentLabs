import { Suspense, lazy } from "react";
import { FastForward, Gauge } from "lucide-react";
import type { PlaybackState } from "@/lib/arenaPlayback";
import { TruthBadge } from "@/components/ui";

const PixiArenaWrapper = lazy(() => import("@/components/arena/PixiArenaWrapper"));

const SPEEDS = [1, 2, 4];

export default function ArenaStage({
  title,
  subtitle,
  playback,
  speed,
  onSpeed,
  onSkip,
  playing,
  accent,
  truth,
  truthDetail,
  plannedWaves,
}: {
  title: string;
  subtitle: string;
  playback: PlaybackState;
  speed: number;
  onSpeed: (speed: number) => void;
  onSkip: () => void;
  playing: boolean;
  accent: string;
  truth?: string;
  truthDetail?: string;
  plannedWaves: number;
}) {
  const b = playback.battle;
  const total = b.attacks.length;
  const counter =
    b.currentAttackIndex >= 0 && total > 0
      ? `Attack ${String(Math.min(b.currentAttackIndex + 1, total)).padStart(2, "0")}/${String(total).padStart(2, "0")}`
      : playback.finished
        ? "Run complete"
        : "Standing by";
  const waves = Array.from({ length: Math.max(plannedWaves, playback.waves.length) }, (_, i) => playback.waves.find((w) => w.wave === i + 1) ?? { wave: i + 1, total: 0, preFailed: null, postFailed: null, patched: false, status: "pending" as const });

  return (
    <div className="af-simulation-grid" data-testid="arena-stage">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-none text-[#1D1D1F]">{title}</h1>
          <p className="af-meta mt-2">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {truth && <TruthBadge value={truth} detail={truthDetail} />}
          <span className="af-chip af-mono" data-testid="attack-counter">
            {counter}
          </span>
          <span className="af-chip af-mono" style={{ color: accent }}>
            Gen {b.activeGenerationId}
          </span>
        </div>
      </div>

      <div className="af-simulation-frame relative">
        <Suspense fallback={<div className="grid h-full place-items-center af-meta">Loading arena</div>}>
          <PixiArenaWrapper battleState={b} animationSpeed={speed} className="h-full w-full" />
        </Suspense>
      </div>

      <div className="af-panel flex flex-wrap items-center gap-3 px-4 py-3" aria-live="polite">
        <span className="af-section-label">Narration</span>
        <span className="min-w-0 flex-1 text-[14px] text-[#1D1D1F]" data-testid="narration">
          {playback.narration}
        </span>
        <span className="flex items-center gap-1" role="group" aria-label="Playback speed">
          <Gauge size={15} className="text-[#7A7D85]" aria-hidden />
          {SPEEDS.map((s) => (
            <button key={s} type="button" className="af-button min-h-8 px-2" aria-pressed={speed === s} style={speed === s ? { color: accent, borderColor: accent } : undefined} onClick={() => onSpeed(s)}>
              {s}x
            </button>
          ))}
          <button type="button" className="af-button min-h-8 px-2" onClick={onSkip} disabled={!playing}>
            <FastForward size={14} aria-hidden /> Skip to results
          </button>
        </span>
      </div>

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Wave ladder">
        {waves.map((w) => {
          const active = w.wave === b.currentWave && playing;
          const breached = (w.preFailed ?? 0) > 0;
          return (
            <li
              key={w.wave}
              className="rounded-lg border px-3 py-2 text-[12px]"
              style={{ borderColor: active ? accent : "#DCD8CC", background: w.status === "pending" ? "#FAF9F6" : "#FDFDFD", opacity: w.status === "pending" ? 0.6 : 1 }}
            >
              <span className="af-mono block font-semibold">Wave {String(w.wave).padStart(2, "0")}</span>
              <span className="block" style={{ color: breached ? "#C2414B" : "#575A60" }}>
                {w.preFailed === null ? (w.status === "pending" ? "queued" : "running") : `${w.preFailed}/${w.total} breached`}
              </span>
              {w.patched && <span className="block text-[#7C3AED]">patched{w.postFailed !== null ? `, ${w.postFailed} left` : ""}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
