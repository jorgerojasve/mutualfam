/**
 * MutualSol - Cliente API centralizado
 * Gestiona todas las llamadas HTTP al backend FastAPI,
 * inyecta el JWT automáticamente y maneja errores globalmente.
 */
import { saveToken, getToken, removeToken, saveBiometricToken, getBiometricToken, removeBiometricToken } from './storage';

// IP de tu computadora en la red local (vista en el QR de Expo)
const BASE_URL = 'http://172.16.0.12:8001/api/v1';

// Re-exportar para que authStore.js los pueda usar directamente
export { saveToken, getToken, removeToken, saveBiometricToken, getBiometricToken, removeBiometricToken };

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
// Módulo: Créditos (ahora en Payments de CivicCore)
// ─────────────────────────────────────────────

export const creditosApi = {
  solicitar: (data) =>
    request('/payments/credits', { method: 'POST', body: JSON.stringify(data) }), // Requires member_id to be added by the caller or backend!

  mios: (memberId) => request(`/payments/credits/${memberId}`),

  pagar: (creditoId) =>
    request(`/payments/credits/${creditoId}/status`, { method: 'PATCH', body: JSON.stringify("paid") }),
};

// ─────────────────────────────────────────────
// Módulo: Gobernanza
// ─────────────────────────────────────────────

export const gobernanzaApi = {
  listarPropuestas: () => request('/governance/proposals'),

  crearPropuesta: (data) =>
    request('/governance/proposals', { method: 'POST', body: JSON.stringify(data) }),

  votar: (propuestaId, vote_value, points_used = 0) =>
    request(`/governance/proposals/${propuestaId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_value, points_used }),
    }),
    
  miVoto: (propuestaId) => request(`/governance/proposals/${propuestaId}/my-vote`),
  
  // Nuevos endpoints de Meta-Gobernanza y Coalescencia
  buscarSimilares: (q) => request(`/governance/proposals/search?q=${encodeURIComponent(q)}`),
  
  solicitarFusion: (id, target_id, as_citation = false) => 
    request(`/governance/proposals/${id}/merge`, {
      method: 'POST',
      body: JSON.stringify({ target_proposal_id: target_id, as_citation })
    }),
    
  iniciarReferendo: (id) => request(`/governance/proposals/${id}/start-referendum`, { method: 'POST' }),
  
  calcularResultados: (id) => request(`/governance/proposals/${id}/results`, { method: 'POST' }),

  listarComentarios: (id) => request(`/governance/proposals/${id}/comments`),
  
  crearComentario: (id, content) => request(`/governance/proposals/${id}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, is_anonymous: false })
  }),

  misPuntos: () => request('/governance/my-points')
};

// ─────────────────────────────────────────────
// CONFIG API
// ─────────────────────────────────────────────
export const configApi = {
  getVariables: () => request('/config/')
};

// ─────────────────────────────────────────────
// Módulo: Mercado
// ─────────────────────────────────────────────

export const mercadoApi = {
  listarOfertas: () => request('/mercado/ofertas'),

  crearOferta: (data) =>
    request('/mercado/ofertas', { method: 'POST', body: JSON.stringify(data) }),
};
