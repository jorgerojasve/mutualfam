import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import InviteLanding from './pages/Auth/InviteLanding';
import SelectMutual from './pages/Auth/SelectMutual';
import LoansDashboard from './pages/Loans/LoansDashboard';
import FundsDashboard from './pages/Funds/FundsDashboard';
import Settings from './pages/Settings/Settings';
import DbManager from './pages/Dev/DbManager';
import { useConfigStore } from '@civiccore/sdk';

import MembersList from './pages/Membership/MembersList';

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
        <Route path="/invite" element={<InviteLanding />} />
        <Route path="/download" element={<InviteLanding />} />
        <Route path="/select-mutual" element={<SelectMutual />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/loans" replace />} />
          
          {/* Mutual Fam Routes */}
          <Route path="loans" element={<LoansDashboard />} />
          <Route path="funds" element={<FundsDashboard />} />
          <Route path="members" element={<MembersList />} />
          <Route path="family" element={<Navigate to="/members" replace />} />
          
          <Route path="profile" element={<Settings />} />
          <Route path="settings" element={<Navigate to="/profile" replace />} />
          
          {/* Dev Routes */}
          <Route path="dev/db-manager" element={<DbManager />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
