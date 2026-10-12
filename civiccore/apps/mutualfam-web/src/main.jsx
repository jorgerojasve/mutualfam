import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { initCivicCore } from '@civiccore/sdk';
import manifest from './manifest.js';
import { getEnvironmentConfig } from './utils/env.js';

// Título dinámico según el entorno
const envConfig = getEnvironmentConfig();
document.title = envConfig.isQA 
  ? 'MutualFam (QA) - Entorno de Pruebas' 
  : envConfig.isDev 
    ? 'MutualFam (Dev) - Desarrollo Local' 
    : 'MutualFam - Préstamos y Aportes Familiares';

// Adaptador de LocalStorage para la Web
initCivicCore({
  manifest,
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
