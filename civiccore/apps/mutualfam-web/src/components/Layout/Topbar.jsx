import React from 'react';
import { Bell, LogOut, Search } from 'lucide-react';
import { useAuthStore, useManifest } from '@civiccore/sdk';
import { EnvBadge } from '../Common/EnvBadge';
import MutualSwitcher from './MutualSwitcher';

const Topbar = () => {
  const { logout } = useAuthStore();
  const manifest = useManifest();

  return (
    <header className="topbar glass-panel">
      {/* Mutual Switcher principal (homologado con Android) */}
      <div className="topbar-left">
        <MutualSwitcher />
      </div>

      {/* Desktop Search (oculto en móvil <= 768px) */}
      <div className="topbar-search">
        <Search className="search-icon text-muted" size={18} />
        <input type="text" placeholder="Buscar préstamos, miembros..." className="search-input" />
      </div>
      
      <div className="topbar-actions">
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
