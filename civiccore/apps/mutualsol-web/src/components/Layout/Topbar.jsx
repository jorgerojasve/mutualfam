import React from 'react';
import { Bell, LogOut, Search } from 'lucide-react';
import { useAuthStore } from '@civiccore/sdk';

const Topbar = () => {
  const { logout } = useAuthStore();

  return (
    <header className="topbar glass-panel">
      <div className="topbar-search">
        <Search className="search-icon text-muted" size={18} />
        <input type="text" placeholder="Buscar propuestas, miembros..." className="search-input" />
      </div>
      
      <div className="topbar-actions">
        <div className="notification-bell">
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
