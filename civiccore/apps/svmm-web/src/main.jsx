import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { initCivicCore } from '@civiccore/sdk';
import manifest from './manifest.js';

// Inicializar el SDK para entorno web
initCivicCore({
  manifest,
  baseURL: 'http://localhost:8002/api/v1', // Puerto backend SVMM
  storage: {
    getItem: async (key) => localStorage.getItem(key),
    setItem: async (key, value) => localStorage.setItem(key, value),
    removeItem: async (key) => localStorage.removeItem(key)
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
