import { Link, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AgentHardeningPage from './pages/AgentHardeningPage';
import RLLabPage from './pages/RLLabPage';
import ReportsPage from './pages/ReportsPage';
import ExportsPage from './pages/ExportsPage';

function NotFound() {
  return (
    <main className="af-page grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-[24px] font-semibold">Page not found</h1>
        <Link className="af-button mt-4" to="/">Back to AgentLabs</Link>
      </div>
    </main>
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/agent-hardening" element={<AgentHardeningPage />} />
      <Route path="/rl-lab" element={<RLLabPage />} />
      <Route path="/lora-lab" element={<RLLabPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/exports" element={<ExportsPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
