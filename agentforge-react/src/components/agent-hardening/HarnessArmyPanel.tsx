
import type { WaveDefinition } from "@/types/agentforge";

interface HarnessArmyPanelProps {
  totalHarnesses: number;
  activeWaveHarnesses: number;
  categoriesCount: number;
  severityDistribution: { label: string; count: number; color: string }[];
  waves: WaveDefinition[];
  currentWave: number;
}

export default function HarnessArmyPanel({
  totalHarnesses,
  activeWaveHarnesses,
  categoriesCount,
  severityDistribution,
  waves,
  currentWave,
}: HarnessArmyPanelProps) {
  const nextBossWave = waves.find((w) => w.isBossWave && w.waveNumber > currentWave);
  const maxCount = Math.max(...severityDistribution.map((s) => s.count), 1);

  return (
    <div
      className="warm-card rounded-xl flex flex-col"
      style={{
        background: "#FBF5DF",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "10px",
      }}
    >
      {/* Header */}
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Harness Army
      </span>

      {/* Main stat grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Total harnesses */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Total
          </span>
          <span
            className="font-bold font-mono"
            style={{ fontSize: "28px", color: "#1D1D1F", lineHeight: 1.1 }}
          >
            {totalHarnesses}
          </span>
        </div>

        {/* Active wave */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Wave Active
          </span>
          <span
            className="font-bold font-mono"
            style={{ fontSize: "28px", color: "#0284C7", lineHeight: 1.1 }}
          >
            {activeWaveHarnesses}
          </span>
        </div>

        {/* Categories */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
            Categories
          </span>
          <span
            className="font-bold font-mono"
            style={{ fontSize: "28px", color: "#7C3AED", lineHeight: 1.1 }}
          >
            {categoriesCount}
          </span>
        </div>
      </div>

      {/* Severity distribution mini bars */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#7A7D85" }}>
          Severity Distribution
        </span>
        <div className="flex flex-col gap-1">
          {severityDistribution.map((s, i) => (
            <div key={`${s.label}-${i}`} className="flex items-center gap-2">
              <span className="text-[11px] font-medium w-12" style={{ color: "#575A60" }}>
                {s.label}
              </span>
              <div
                className="flex-1 rounded-full overflow-hidden"
                style={{ height: "6px", background: "rgba(215, 210, 200, 0.5)" }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: `${Math.max(4, (s.count / maxCount) * 100)}%`,
                    height: "100%",
                    background: s.color,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span className="text-[11px] font-mono font-medium w-6 text-right" style={{ color: "#575A60" }}>
                {s.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Boss wave countdown */}
      {nextBossWave && (
        <div
          className="rounded-lg flex items-center justify-between px-3 py-2"
          style={{
            background: "rgba(194, 65, 75, 0.08)",
            border: "1px solid rgba(194, 65, 75, 0.2)",
          }}
        >
          <span className="text-[12px] font-semibold" style={{ color: "#C2414B" }}>
            Boss Wave {nextBossWave.waveNumber} Approaching
          </span>
          <span className="text-[11px] font-mono font-bold" style={{ color: "#C2414B" }}>
            {nextBossWave.waveNumber - currentWave} wave{nextBossWave.waveNumber - currentWave !== 1 ? "s" : ""} away
          </span>
        </div>
      )}
    </div>
  );
}
