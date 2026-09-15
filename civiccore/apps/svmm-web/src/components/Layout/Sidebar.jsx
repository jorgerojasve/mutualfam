import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Gavel, Shield, Wallet, Users, Settings, Store } from 'lucide-react';
import { useAuthStore, useConfigStore } from '@civiccore/sdk';

const Sidebar = () => {
  const { user } = useAuthStore();
  const { terminology } = useConfigStore();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/governance', icon: Gavel, label: terminology.governance },
    { to: '/transparency', icon: Shield, label: terminology.transparency },
    { to: '/credits', icon: Wallet, label: 'Apoyos Financieros' },
    { to: '/members', icon: Users, label: terminology.members },
    { to: '/organization/events', icon: LayoutDashboard, label: 'Eventos Org.' },
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon"></div>
          <h2 className="logo-text text-gradient">SVMM</h2>
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
