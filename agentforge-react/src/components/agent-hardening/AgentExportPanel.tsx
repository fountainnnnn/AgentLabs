
import { useState, useCallback } from "react";

interface AgentExportPanelProps {
  onExportAgent: () => void;
  onExportReport: () => void;
  onExportRunner: () => void;
  onExportBundle: () => void;
}

type ExportTarget = "agent" | "report" | "runner" | "bundle";

const EXPORT_ACTIONS: Record<ExportTarget, { label: string; action: () => void }> = {
  agent: { label: "Export agent.json", action: () => {} },
  report: { label: "Export report.json", action: () => {} },
  runner: { label: "Export runner.py", action: () => {} },
  bundle: { label: "Export bundle.zip", action: () => {} },
};

export default function AgentExportPanel({
  onExportAgent,
  onExportReport,
  onExportRunner,
  onExportBundle,
}: AgentExportPanelProps) {
  const [exported, setExported] = useState<ExportTarget | null>(null);

  const handleExport = useCallback(
    (target: ExportTarget) => {
      const handlers: Record<ExportTarget, () => void> = {
        agent: onExportAgent,
        report: onExportReport,
        runner: onExportRunner,
        bundle: onExportBundle,
      };
      handlers[target]();
      setExported(target);
      setTimeout(() => setExported(null), 2500);
    },
    [onExportAgent, onExportReport, onExportRunner, onExportBundle]
  );

  const buttons: { target: ExportTarget; label: string }[] = [
    { target: "agent", label: "Export agent.json" },
    { target: "report", label: "Export report.json" },
    { target: "runner", label: "Export runner.py" },
    { target: "bundle", label: "Export bundle.zip" },
  ];

  return (
    <div
      className="cool-card rounded-xl flex flex-col"
      style={{
        background: "#F2F8FC",
        border: "1px solid #DCD8CC",
        padding: "12px",
        gap: "8px",
      }}
    >
      {/* Header */}
      <span
        className="text-[11px] font-bold tracking-widest uppercase"
        style={{ color: "#7A7D85", letterSpacing: "0.08em" }}
      >
        Export
      </span>

      {/* Export buttons grid */}
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((btn) => (
          <button
            key={btn.target}
            type="button"
            onClick={() => handleExport(btn.target)}
            className="h-9 rounded-lg text-[12px] font-semibold transition-all"
            style={{
              background: exported === btn.target ? "rgba(33, 134, 90, 0.12)" : "#FFFFFF",
              color: exported === btn.target ? "#21865A" : "#575A60",
              border: exported === btn.target ? "1px solid rgba(33, 134, 90, 0.3)" : "1px solid #DCD8CC",
            }}
          >
            {exported === btn.target ? "Exported" : btn.label}
          </button>
        ))}
      </div>

      {/* Status feedback */}
      {exported && (
        <div
          className="text-[11px] font-medium text-center animate-fade-in-up"
          style={{ color: "#21865A" }}
        >
          {EXPORT_ACTIONS[exported].label} exported successfully
        </div>
      )}
    </div>
  );
}
