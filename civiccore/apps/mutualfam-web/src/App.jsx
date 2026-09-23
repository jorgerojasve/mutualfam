import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@civiccore/sdk';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import LoansDashboard from './pages/Loans/LoansDashboard';
import FundsDashboard from './pages/Funds/FundsDashboard';
import Settings from './pages/Settings/Settings';
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
          <Route index element={<Navigate to="/loans" replace />} />
          
          {/* Mutual Fam Routes */}
          <Route path="loans" element={<LoansDashboard />} />
          <Route path="funds" element={<FundsDashboard />} />
          
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
