import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useAuthStore } from '@civiccore/sdk';
import { EnvTopBanner } from '../Common/EnvBadge';

const MainLayout = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="loading-screen flex items-center justify-center h-full w-full">
        <div className="loader"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content-wrapper">
        <EnvTopBanner />
        <Topbar />
        <main className="main-content">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
};

export default MainLayout;
