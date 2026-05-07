import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import AgentHardeningPage from './pages/AgentHardeningPage';
import RLLabPage from './pages/RLLabPage';
import ReportsPage from './pages/ReportsPage';
import ExportsPage from './pages/ExportsPage';

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/agent-hardening" element={<AgentHardeningPage />} />
      <Route path="/rl-lab" element={<RLLabPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/exports" element={<ExportsPage />} />
    </Routes>
  );
}
