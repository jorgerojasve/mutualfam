import React from 'react';
import { Bell, LogOut, Search, User } from 'lucide-react';
import { useAuthStore, useManifest } from '@civiccore/sdk';
import { EnvBadge } from '../Common/EnvBadge';

const Topbar = () => {
  const { logout, user } = useAuthStore();
  const manifest = useManifest();

  return (
    <header className="topbar glass-panel">
      {/* Mobile Branding (visible only on mobile <= 768px) */}
      <div className="mobile-brand">
        <div className="mobile-logo-icon"></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="mobile-brand-title text-gradient">{manifest?.shortName || 'MFam'}</span>
          <EnvBadge size="small" />
        </div>
      </div>

      {/* Desktop Search (hidden on mobile <= 768px) */}
      <div className="topbar-search">
        <Search className="search-icon text-muted" size={18} />
        <input type="text" placeholder="Buscar préstamos, miembros..." className="search-input" />
      </div>
      
      <div className="topbar-actions">
        {/* Desktop EnvBadge (hidden on mobile) */}
        <div className="desktop-env-badge">
          <EnvBadge size="medium" showProd={true} />
        </div>
        
        <div className="notification-bell" title="Notificaciones">
          <Bell size={20} className="text-secondary" />
          <span className="notification-dot"></span>
        </div>
        
        <button className="btn btn-secondary btn-icon" onClick={logout} title="Cerrar Sesión">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
