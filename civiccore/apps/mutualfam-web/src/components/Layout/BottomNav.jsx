import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wallet, PiggyBank, Users, Settings } from 'lucide-react';

const BottomNav = () => {
  const navTabs = [
    { to: '/loans', icon: Wallet, label: 'Préstamos' },
    { to: '/funds', icon: PiggyBank, label: 'Fondos' },
    { to: '/members', icon: Users, label: 'Familia' },
    { to: '/settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <nav className="bottom-nav">
      {navTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <tab.icon size={22} className="bottom-nav-icon" />
          <span className="bottom-nav-label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;
