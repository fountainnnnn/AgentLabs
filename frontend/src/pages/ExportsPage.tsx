import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, RefreshCw } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import { ErrorNote, Panel } from "@/components/ui";
import { api, type Artifact } from "@/lib/api";

function size(bytes = 0): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function ExportsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.listArtifacts().then(setArtifacts).catch((e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="af-page">
      <AppHeader />
      <main className="af-page-main">
        <div className="af-container-wide grid gap-4">
          <Panel
            title="Exported artifacts"
            className="af-panel-canvas"
            testId="artifact-list"
            meta={
              <button type="button" className="af-button min-h-8" onClick={() => void load()} aria-label="Refresh artifacts">
                <RefreshCw size={14} aria-hidden />
              </button>
            }
          >
            <p className="af-body mb-3">
              Agent hardening exports a hardened wrapper (agent.json, runner.py, reports). LoRA exports contain adapter weights only when training was real; simulated runs export a labelled placeholder. Base model weights are never exported, and API models are never trained.
            </p>
            <ErrorNote message={error} />
            {artifacts.length === 0 ? (
              <p className="af-meta">No artifacts in this browser session yet. Complete a run in <Link className="text-[#2563EB]" to="/agent-hardening">Agent Hardening</Link> or the <Link className="text-[#2563EB]" to="/rl-lab">LoRA Lab</Link>.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Kind</th>
                      <th>Run</th>
                      <th>real_or_simulated</th>
                      <th>Size</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {artifacts.map((a) => (
                      <tr key={a.id}>
                        <td className="af-mono">{a.filename}</td>
                        <td>{a.kind.replace(/_/g, " ")}</td>
                        <td>
                          <Link className="af-mono text-[#2563EB]" to={`/reports?run=${a.run_id}`}>
                            {a.run_id}
                          </Link>
                        </td>
                        <td style={{ color: a.real_or_simulated === "real" ? "#21865A" : "#C77700" }}>{a.real_or_simulated}</td>
                        <td className="af-mono">{size(a.size_bytes)}</td>
                        <td>
                          <a className="af-button min-h-8" href={api.downloadUrl(a)} download={a.filename}>
                            <Download size={14} aria-hidden /> Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
