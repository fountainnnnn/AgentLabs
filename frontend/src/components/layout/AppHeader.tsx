import { useEffect, useState, type FormEvent } from "react";
import { NavLink, Link } from "react-router-dom";
import { Bot, FileText, FlaskConical, KeyRound, Package, Server } from "lucide-react";
import { api, type Health } from "@/lib/api";

const NAV = [
  { to: "/agent-hardening", label: "Agent Hardening", icon: Bot },
  { to: "/rl-lab", label: "LoRA Lab", icon: FlaskConical },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/exports", label: "Exports", icon: Package },
];

export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.health().then(setHealth).catch((e: Error) => setError(e.message));
  }, []);
  return { health, error };
}

export default function AppHeader() {
  const { health, error } = useHealth();
  return (
    <header className="af-topbar flex w-full flex-shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-2">
      <Link to="/" aria-label="AgentLabs home" className="af-brand-link">
        <img src="/assets/agentlabs/brand/agentlabs-mark.png" alt="" aria-hidden="true" className="af-brand-logo" />
        <span className="min-w-0">
          <span className="af-brand-word">AgentLabs</span>
          <span className="af-brand-subtitle">Adversarial hardening for agents and models</span>
        </span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `af-button af-button-quiet ${isActive ? "text-[#1D1D1F]" : ""}`}>
            <Icon size={15} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2" data-testid="provider-status">
        <span className="af-status-chip" title={health?.llm.warning ?? health?.llm.base_url ?? undefined}>
          <Server size={13} aria-hidden />
          {error ? "Backend offline" : health ? (health.llm.live ? health.llm.provider : "Mock provider (offline)") : "Connecting"}
        </span>
        {health && (
          <span className="af-status-chip">
            <FlaskConical size={13} aria-hidden />
            {health.lora_mode === "real_local_model" ? "Real LoRA available" : "LoRA simulation"}
          </span>
        )}
      </div>
      <AccessGate />
    </header>
  );
}

/** Shown only when the deployment requires an access token and this browser has no session. */
function AccessGate() {
  const [needed, setNeeded] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.session().then((s) => setNeeded(s.auth_required && !s.authenticated)).catch(() => undefined);
  }, []);
  if (!needed) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.login(token);
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(29,29,31,0.35)] p-4" role="dialog" aria-modal="true" aria-label="Access token">
      <form onSubmit={submit} className="af-panel grid w-full max-w-[380px] gap-3 p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold">
          <KeyRound size={16} aria-hidden /> Access token required
        </h2>
        <p className="af-body">This deployment is protected. Enter the access token configured by the operator.</p>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className="rounded-lg border border-[#DCD8CC] bg-[#FDFDFD] px-3 py-2" aria-label="Access token" />
        {error && <p className="text-[13px] text-[#C2414B]">{error}</p>}
        <button type="submit" className="af-button af-button-primary">
          Unlock
        </button>
      </form>
    </div>
  );
}
