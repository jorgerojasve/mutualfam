import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import GovernanceList from './pages/Governance/GovernanceList';
import ProposalDetail from './pages/Governance/ProposalDetail';
import CreateProposal from './pages/Governance/CreateProposal';
import Transparency from './pages/Transparency/Transparency';
import WithdrawalPage from './pages/Membership/WithdrawalPage';
import OrganizationEvents from './pages/Membership/OrganizationEvents';
import FusionProcessDetail from './pages/Membership/FusionProcessDetail';
import Settings from './pages/Settings/Settings';
import CreditsPage from './pages/Finance/CreditsPage';
import { useConfigStore } from '@civiccore/sdk';

function App() {
  const { loadUser } = useAuthStore();
  const { loadConfigs } = useConfigStore();

  useEffect(() => {
    loadUser();
    loadConfigs();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          
          {/* Governance Routes */}
          <Route path="governance" element={<GovernanceList />} />
          <Route path="governance/create" element={<CreateProposal />} />
          <Route path="governance/:id" element={<ProposalDetail />} />
          
          {/* Transparency Route */}
          <Route path="transparency" element={<Transparency />} />
          
          <Route path="credits" element={<CreditsPage />} />
          <Route path="mercado" element={<div className="p-8">Mercado Solidario en construcción</div>} />
          <Route path="members" element={<div className="p-8">Directorio de Miembros en construcción</div>} />
          
          {/* Membership Routes */}
          <Route path="membership/withdrawal" element={<WithdrawalPage />} />
          <Route path="organization/events" element={<OrganizationEvents />} />
          <Route path="membership/events" element={<Navigate to="/organization/events" />} />
          <Route path="membership/fusion/:id" element={<FusionProcessDetail />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
