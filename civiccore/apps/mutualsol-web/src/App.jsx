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
import BoardPanel from './pages/Board/BoardPanel';
import FundPage from './pages/Fund/FundPage';
import Transparency from './pages/Transparency/Transparency';
import WithdrawalPage from './pages/Membership/WithdrawalPage';
import OrganizationEvents from './pages/Membership/OrganizationEvents';
import FusionProcessDetail from './pages/Membership/FusionProcessDetail';
import MitosisPage from './pages/Membership/MitosisPage';
import MembersList from './pages/Membership/MembersList';
import Settings from './pages/Settings/Settings';
import CreditsPage from './pages/Finance/CreditsPage';
import PaymentsPage from './pages/Finance/PaymentsPage';
import DbManager from './pages/Dev/DbManager';
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
          <Route path="board-panel" element={<BoardPanel />} />
          <Route path="fund" element={<FundPage />} />
          
          {/* Transparency Route */}
          <Route path="transparency" element={<Transparency />} />
          {/* Finance & Modules */}
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="mercado" element={<div className="p-8">Mercado Solidario en construcción</div>} />
          <Route path="members" element={<MembersList />} />
          
          {/* Membership Routes */}
          <Route path="membership/withdrawal" element={<WithdrawalPage />} />
          <Route path="organization/events" element={<OrganizationEvents />} />
          <Route path="membership/events" element={<Navigate to="/organization/events" />} />
          <Route path="membership/fusion/:id" element={<FusionProcessDetail />} />
          <Route path="membership/mitosis/:id" element={<MitosisPage />} />
          <Route path="settings" element={<Settings />} />
          
          {/* Dev Routes */}
          <Route path="dev/db-manager" element={<DbManager />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
