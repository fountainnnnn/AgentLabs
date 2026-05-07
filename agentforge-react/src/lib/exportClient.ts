// ─── Client-side Export Utilities ──────────────────────────────────────────────

/**
 * Trigger a file download in the browser.
 */
export function triggerDownload(
  data: any,
  filename: string,
  type: string = 'application/json',
): void {
  const blob =
    data instanceof Blob
      ? data
      : typeof data === 'string'
        ? new Blob([data], { type })
        : new Blob([JSON.stringify(data, null, 2)], { type });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Export data as a JSON file.
 */
export function exportJSON(data: any, filename: string): void {
  const jsonStr = JSON.stringify(data, null, 2);
  triggerDownload(jsonStr, filename.endsWith('.json') ? filename : `${filename}.json`, 'application/json');
}

/**
 * Export an array of rows as a CSV file.
 */
export function exportCSV(rows: Record<string, any>[], filename: string): void {
  if (rows.length === 0) {
    triggerDownload('', filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv');
    return;
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (cell: any): string => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCell(row[h])).join(','),
  );
  const csv = [headerLine, ...dataLines].join('\n');

  triggerDownload(csv, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv');
}

/**
 * Build a downloadable agent package containing the agent configuration
 * and its hardening report, plus a minimal runner script.
 */
export function buildAgentPackage(
  agentConfig: Record<string, any>,
  report: Record<string, any>,
): { agentJson: string; reportJson: string; runnerPy: string } {
  const agentJson = JSON.stringify(agentConfig, null, 2);
  const reportJson = JSON.stringify(report, null, 2);

  const runnerPy = `#!/usr/bin/env python3
"""AgentForge - Hardened Agent Runner
Generated: ${new Date().toISOString()}
"""

import json
import sys


def load_agent(path: str) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def load_report(path: str) -> dict:
    with open(path, "r") as f:
        return json.load(f)


def run_agent(agent: dict) -> None:
    name = agent.get("name", "unnamed-agent")
    version = agent.get("version", "0.0.0")
    print(f"[AgentForge] Running {name} v{version}")
    print(f"[AgentForge] Base model: {agent.get('baseModel', 'unknown')}")
    print(f"[AgentForge] Hardening patches: {len(agent.get('patches', []))}")
    print("[AgentForge] Agent ready.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: runner.py <agent.json> [report.json]")
        sys.exit(1)

    agent = load_agent(sys.argv[1])
    run_agent(agent)

    if len(sys.argv) > 2:
        report = load_report(sys.argv[2])
        print(f"[AgentForge] Report: {report.get('summary', {}).get('title', 'N/A')}")
`;

  return { agentJson, reportJson, runnerPy };
}

/**
 * Build a model card object from training config and final checkpoint data.
 */
export function buildModelCard(
  modelConfig: Record<string, any>,
  checkpoint: Record<string, any>,
): Record<string, any> {
  return {
    modelName: modelConfig.baseModel ?? modelConfig.name ?? 'Unknown',
    architecture: modelConfig.architecture ?? 'transformer',
    baseModel: modelConfig.baseModel ?? modelConfig.name ?? 'Unknown',
    fineTuning: {
      method: 'LoRA',
      adapterRank: modelConfig.adapterRank ?? modelConfig.loraRank ?? 8,
      loraAlpha: modelConfig.loraAlpha ?? 16,
      targetModules: modelConfig.loraTargetModules ?? ['q_proj', 'v_proj'],
    },
    training: {
      batchSize: modelConfig.batchSize ?? 32,
      learningRate: modelConfig.learningRate ?? 5e-5,
      totalSteps: checkpoint.step ?? modelConfig.trainingSteps ?? 1000,
      finalReward: checkpoint.reward ?? 0,
    },
    performance: {
      failureRate: checkpoint.failureRate ?? 0,
      refusalPrecision: checkpoint.refusalPrecision ?? 0,
      attackResistance: checkpoint.attackResistance ?? 0,
      consistencyScore: checkpoint.consistencyScore ?? 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Download multiple named files as individual downloads (browser limitation:
 * each file triggers its own download dialog).
 */
export function downloadBundle(files: Record<string, any>): void {
  const entries = Object.entries(files);
  for (let i = 0; i < entries.length; i++) {
    const [filename, data] = entries[i];
    // Determine content type from extension
    let type = 'application/octet-stream';
    if (filename.endsWith('.json')) type = 'application/json';
    else if (filename.endsWith('.csv')) type = 'text/csv';
    else if (filename.endsWith('.py')) type = 'text/x-python';
    else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) type = 'text/yaml';
    else if (filename.endsWith('.md')) type = 'text/markdown';

    // Stagger downloads slightly to avoid browser popup blocking
    setTimeout(() => {
      triggerDownload(data, filename, type);
    }, i * 300);
  }
}
