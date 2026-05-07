import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ModeSelectionPage() {
  const navigate = useNavigate();
  const [showAgentUpload, setShowAgentUpload] = useState(false);
  const [showRLUpload, setShowRLUpload] = useState(false);

  return (
    <div
      className="flex flex-col min-h-screen w-full overflow-y-auto"
      style={{ background: "#FCFCF7" }}
    >
      {/* ---------- Top header ---------- */}
      <header className="flex items-center justify-between w-full px-8 py-5">
        <div className="flex items-baseline gap-3">
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: "24px", color: "#1D1D1F" }}
          >
            AgentForge
          </h1>
          <span style={{ fontSize: "13px", color: "#7A7D85" }}>
            Adversarial training for agents and models
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-success">Local demo ready</span>
          <span className="badge badge-info">GPT-5.5 API optional</span>
        </div>
      </header>

      {/* ---------- Main content ---------- */}
      <main style={{ maxWidth: "1120px", margin: "0 auto", padding: "0 32px", width: "100%" }}>
        {/* Two mode cards in a row */}
        <div className="grid grid-cols-2 gap-6" style={{ marginTop: "48px" }}>
          {/* --- Card 1: Agentic AI Tool Hardening --- */}
          <div
            className="flex flex-col rounded-card surface-card"
            style={{
              background: "#F2F8FC",
              borderLeft: "4px solid #2563EB",
            }}
          >
            <div className="flex flex-col p-5 gap-4">
              <h2
                className="font-semibold"
                style={{ fontSize: "18px", color: "#1D1D1F" }}
              >
                Agentic AI Tool Hardening
              </h2>
              <p style={{ fontSize: "13px", color: "#575A60", lineHeight: "1.6" }}>
                Stress-test your AI agent against prompt injection, role
                impersonation, tool abuse, and policy extraction attacks.
                Deploy deterministic verifiers and export hardened wrappers
                for production guardrails.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/agent-hardening")}
                  className="h-9 px-5 rounded-btn text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#2563EB", border: "none" }}
                >
                  Start Agent Hardening
                </button>
                <button
                  onClick={() => navigate("/agent-hardening")}
                  className="h-9 px-5 rounded-btn text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "transparent",
                    color: "#2563EB",
                    border: "1px solid #2563EB",
                  }}
                >
                  Run Demo Agent
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-info">Prompt Guard</span>
                <span className="badge badge-info">Tool Safety</span>
                <span className="badge badge-info">Deterministic Verifiers</span>
                <span className="badge badge-info">Agent Export</span>
              </div>
            </div>

            {/* Collapsible upload section */}
            <button
              onClick={() => setShowAgentUpload(!showAgentUpload)}
              className="flex items-center justify-between px-5 py-2.5 text-xs font-semibold w-full text-left"
              style={{
                color: "#7A7D85",
                borderTop: "1px solid #DCD8CC",
                background: "rgba(255,255,255,0.35)",
              }}
            >
              <span>Upload Configuration</span>
              <span style={{ transform: showAgentUpload ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                &#9662;
              </span>
            </button>
            {showAgentUpload && (
              <div
                className="flex flex-col gap-3 px-5 pb-5"
                style={{ background: "rgba(255,255,255,0.35)" }}
              >
                <UploadRow label="agent.json" hint="Click to upload" />
                <UploadRow label="System Prompt" hint="Paste or upload .txt" />
                <UploadRow label="Tool Schema" hint="Paste or upload .json" />
                <button
                  className="h-8 px-4 rounded-btn text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "#FBF5DF",
                    color: "#575A60",
                    border: "1px solid #DCD8CC",
                  }}
                >
                  Load Demo RefundBot
                </button>
              </div>
            )}
          </div>

          {/* --- Card 2: LLM Reinforcement Lab --- */}
          <div
            className="flex flex-col rounded-card surface-card"
            style={{
              background: "#F4F1F8",
              borderLeft: "4px solid #7C3AED",
            }}
          >
            <div className="flex flex-col p-5 gap-4">
              <h2
                className="font-semibold"
                style={{ fontSize: "18px", color: "#1D1D1F" }}
              >
                LLM Reinforcement Lab
              </h2>
              <p style={{ fontSize: "13px", color: "#575A60", lineHeight: "1.6" }}>
                Fine-tune open-weight language models using reinforcement
                learning. Define reward signals, freeze base layers, train
                lightweight adapters, and export checkpoints for downstream
                deployment.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/rl-lab")}
                  className="h-9 px-5 rounded-btn text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#7C3AED", border: "none" }}
                >
                  Start RL Lab
                </button>
                <button
                  onClick={() => navigate("/rl-lab")}
                  className="h-9 px-5 rounded-btn text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "transparent",
                    color: "#7C3AED",
                    border: "1px solid #7C3AED",
                  }}
                >
                  Run Demo Lab
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-purple">Reward Signals</span>
                <span className="badge badge-purple">Frozen Base</span>
                <span className="badge badge-purple">Adapter Training</span>
                <span className="badge badge-purple">Checkpoint Export</span>
              </div>
            </div>

            {/* Collapsible upload section */}
            <button
              onClick={() => setShowRLUpload(!showRLUpload)}
              className="flex items-center justify-between px-5 py-2.5 text-xs font-semibold w-full text-left"
              style={{
                color: "#7A7D85",
                borderTop: "1px solid #DCD8CC",
                background: "rgba(255,255,255,0.35)",
              }}
            >
              <span>Upload Configuration</span>
              <span style={{ transform: showRLUpload ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                &#9662;
              </span>
            </button>
            {showRLUpload && (
              <div
                className="flex flex-col gap-3 px-5 pb-5"
                style={{ background: "rgba(255,255,255,0.35)" }}
              >
                <SelectRow label="Base Model" options={["Llama-3.2-3B", "Mistral-7B-v0.3", "Phi-3.5-mini", "Qwen-2.5-7B"]} />
                <UploadRow label="Dataset" hint="Upload .jsonl" />
                <UploadRow label="Policy File" hint="Upload initial policy" />
                <button
                  className="h-8 px-4 rounded-btn text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "#FBF5DF",
                    color: "#575A60",
                    border: "1px solid #DCD8CC",
                  }}
                >
                  Run Demo Simulation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---------- 6-step process strip ---------- */}
        <div
          className="flex items-center justify-between rounded-card px-8 py-5"
          style={{ background: "#FBF5DF", marginTop: "48px" }}
        >
          {[
            { num: 1, label: "Upload" },
            { num: 2, label: "Spawn\nHarnesses" },
            { num: 3, label: "Attack" },
            { num: 4, label: "Verify" },
            { num: 5, label: "Patch\nor Train" },
            { num: 6, label: "Export" },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2 flex-1">
              <div
                className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
                style={{
                  width: "28px",
                  height: "28px",
                  background: "#FFFFFF",
                  color: "#7A7D85",
                  border: "1px solid #DCD8CC",
                }}
              >
                {step.num}
              </div>
              <span
                className="text-xs font-medium whitespace-pre-line"
                style={{ color: "#575A60", lineHeight: "1.3" }}
              >
                {step.label}
              </span>
              {i < 5 && (
                <div
                  className="flex-1 h-px mx-2"
                  style={{ background: "#DCD8CC" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* ---------- Bottom note ---------- */}
        <p
          className="text-xs mt-4 mb-8 text-center"
          style={{ color: "#7A7D85" }}
        >
          Agent API mode exports hardened wrappers. LLM Lab mode targets
          open-weight models.
        </p>
      </main>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function UploadRow({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      className="flex items-center justify-between h-9 px-3 rounded-btn text-xs"
      style={{
        background: "#FFFFFF",
        border: "1px dashed #DCD8CC",
        color: "#7A7D85",
      }}
    >
      <span className="font-medium" style={{ color: "#575A60" }}>
        {label}
      </span>
      <span>{hint}</span>
    </div>
  );
}

function SelectRow({
  label,
  options,
}: {
  label: string;
  options: string[];
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium" style={{ color: "#575A60", minWidth: "80px" }}>
        {label}
      </span>
      <select
        className="flex-1 h-9 px-3 rounded-btn text-xs"
        style={{
          background: "#FFFFFF",
          border: "1px solid #DCD8CC",
          color: "#1D1D1F",
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
