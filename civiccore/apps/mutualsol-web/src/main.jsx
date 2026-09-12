import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { initCivicCore } from '@civiccore/sdk';

// Adaptador de LocalStorage para la Web
initCivicCore({
  storage: {
    getItem: async (key) => localStorage.getItem(key),
    setItem: async (key, val) => localStorage.setItem(key, val),
    removeItem: async (key) => localStorage.removeItem(key)
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
