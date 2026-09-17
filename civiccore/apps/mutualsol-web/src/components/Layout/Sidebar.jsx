import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Gavel, Shield, Wallet, Users, Settings, Store, Database, Handshake } from 'lucide-react';
import { useAuthStore, useConfigStore, useManifest } from '@civiccore/sdk';

const Sidebar = () => {
  const { user } = useAuthStore();
  const { terminology } = useConfigStore();
  const manifest = useManifest();
  const m = manifest?.modules || {};

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', show: true },
    { to: '/governance', icon: Gavel, label: terminology.governance, show: m.governance !== false },
    { to: '/transparency', icon: Shield, label: terminology.transparency, show: m.transparency !== false },
    { to: '/credits', icon: Wallet, label: 'Créditos', show: m.credits !== false },
    { to: '/mercado', icon: Store, label: 'Mercado', show: m.mercado !== false },
    { to: '/members', icon: Users, label: terminology.members, show: m.members !== false },
    { to: '/organization/events', icon: Handshake, label: 'Fusión de Mutuales', show: m.fusion !== false },
    { to: '/settings', icon: Settings, label: 'Configuración', show: true },
  ].filter(item => item.show);
  
  // En dev mode, mostrar el DB Manager
  if (import.meta.env.DEV) {
    navItems.push({ to: '/dev/db-manager', icon: Database, label: 'DB Manager (Dev)' });
  }

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-container">
          {manifest?.logo ? (
            <img src={manifest.logo} alt={manifest.shortName} className="sidebar-logo-img" />
          ) : (
            <>
              <div className="logo-icon"></div>
              <h2 className="logo-text text-gradient">{manifest?.shortName || 'CivicCore'}</h2>
            </>
          )}
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.to} className="nav-item">
              <NavLink 
                to={item.to} 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <item.icon className="nav-icon" size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">{user?.nombre?.charAt(0) || 'U'}</div>
          <div className="user-info">
            <p className="user-name">{user?.nombre} {user?.apellido}</p>
            <p className="user-role text-muted">{user?.role === 'admin' ? 'Administrador' : 'Miembro'}</p>
          </div>
          <Settings size={18} className="settings-icon text-muted" />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
