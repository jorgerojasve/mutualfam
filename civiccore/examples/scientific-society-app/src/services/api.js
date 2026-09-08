/**
 * MutualSol - Cliente API centralizado
 * Gestiona todas las llamadas HTTP al backend FastAPI,
 * inyecta el JWT automáticamente y maneja errores globalmente.
 */
import { saveToken, getToken, removeToken } from './storage';

// IP de tu computadora en la red local (vista en el QR de Expo)
const BASE_URL = 'http://172.16.0.12:8000/api/v1';

// Re-exportar para que authStore.js los pueda usar directamente
export { saveToken, getToken, removeToken };

// ─────────────────────────────────────────────
// Fetch Wrapper con Auth automática
// ─────────────────────────────────────────────

const request = async (endpoint, options = {}) => {
  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let rawText = '';
  try {
    rawText = await response.text();
    const data = JSON.parse(rawText);

    if (!response.ok) {
      const message = data?.detail || 'Ocurrió un error en el servidor.';
      throw new Error(message);
    }
    return data;
  } catch (error) {
    if (!response.ok) {
      throw new Error(`Error del servidor (${response.status}):\n${rawText.slice(0, 200)}`);
    }
    throw error;
  }
};

// ─────────────────────────────────────────────
// Módulo: Autenticación
// ─────────────────────────────────────────────

export const authApi = {
  // login usa x-www-form-urlencoded (requerido por OAuth2PasswordRequestForm de FastAPI)
  login: async (email, password) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    });

    let rawText = '';
    try {
      rawText = await response.text();
      const data = JSON.parse(rawText);
      if (!response.ok) throw new Error(data?.detail || 'Credenciales incorrectas');
      return data;
    } catch (error) {
      if (!response.ok) {
        throw new Error(`Error del servidor (${response.status}):\n${rawText.slice(0, 200)}`);
      }
      throw error;
    }
  },

  register: (userData) =>
    request('/membership/register', { method: 'POST', body: JSON.stringify(userData) }),

  me: () => request('/membership/me'),
};

// ─────────────────────────────────────────────
// Módulo: Créditos
// ─────────────────────────────────────────────

export const creditosApi = {
  solicitar: (data) =>
    request('/creditos', { method: 'POST', body: JSON.stringify(data) }),

  mios: () => request('/creditos/mis-creditos'),

  pagar: (creditoId) =>
    request(`/creditos/${creditoId}/pagar`, { method: 'POST' }),
};

// ─────────────────────────────────────────────
// Módulo: Gobernanza
// ─────────────────────────────────────────────

export const gobernanzaApi = {
  listarPropuestas: () => request('/gobernanza/propuestas'),

  crearPropuesta: (data) =>
    request('/gobernanza/propuestas', { method: 'POST', body: JSON.stringify(data) }),

  votar: (propuestaId, data) =>
    request(`/gobernanza/propuestas/${propuestaId}/votar`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ─────────────────────────────────────────────
// Módulo: Mercado
// ─────────────────────────────────────────────

export const mercadoApi = {
  listarOfertas: () => request('/mercado/ofertas'),

  crearOferta: (data) =>
    request('/mercado/ofertas', { method: 'POST', body: JSON.stringify(data) }),
};
