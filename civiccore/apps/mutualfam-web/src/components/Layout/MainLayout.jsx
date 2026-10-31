import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useAuthStore } from '@civiccore/sdk';
import { EnvTopBanner } from '../Common/EnvBadge';
import { WifiOff, RefreshCw } from 'lucide-react';

const MainLayout = () => {
  const { isAuthenticated, isLoading, isOffline } = useAuthStore();

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
        {isOffline && (
          <div className="offline-banner-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <WifiOff size={15} color="#fbbf24" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fbbf24' }}>
                Sin conexión de red · Intenta de nuevo cuando tengas conexión
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-retry-offline"
            >
              <RefreshCw size={12} />
              <span>Reintentar</span>
            </button>
          </div>
        )}
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
