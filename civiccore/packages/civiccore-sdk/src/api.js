import { getConfig } from './config.js';

// ─────────────────────────────────────────────
// Fetch Wrapper con Auth automática
// ─────────────────────────────────────────────

const request = async (endpoint, options = {}) => {
  const { baseURL, storage } = getConfig();
  const token = await storage.getItem('jwt_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${baseURL}${endpoint}`, {
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
    // If we already parsed the JSON and threw an Error with the detail, rethrow it
    if (error.message && error.message !== 'Unexpected end of JSON input' && !error.message.startsWith('Unexpected token')) {
        throw error;
    }
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
  login: async (email, password) => {
    const { baseURL } = getConfig();
    const response = await fetch(`${baseURL}/auth/login`, {
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
  register: (userData) => request('/membership/register', { method: 'POST', body: JSON.stringify(userData) }),
  me: () => request('/membership/me'),
};

// ─────────────────────────────────────────────
// Módulo: Membresía
// ─────────────────────────────────────────────

export const membershipApi = {
  stats: () => request('/membership/stats')
};

// ─────────────────────────────────────────────
// Módulo: Gobernanza
// ─────────────────────────────────────────────

export const gobernanzaApi = {
  listarPropuestas: () => request('/governance/proposals'),
  obtenerPropuesta: (id) => request(`/governance/proposals/${id}`),
  crearPropuesta: (data) => request('/governance/proposals', { method: 'POST', body: JSON.stringify(data) }),
  votar: (propuestaId, vote_value, points_used = 0) =>
    request(`/governance/proposals/${propuestaId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote_value, points_used }),
    }),
  miVoto: (propuestaId) => request(`/governance/proposals/${propuestaId}/my-vote`),
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
// Módulo: Créditos y Mercado (Payments)
// ─────────────────────────────────────────────

export const creditosApi = {
  solicitar: (data) => request('/payments/credits', { method: 'POST', body: JSON.stringify(data) }),
  mios: (memberId) => request(`/payments/credits/${memberId}`),
  pagar: (creditoId) => request(`/payments/credits/${creditoId}/status`, { method: 'PATCH', body: JSON.stringify("paid") }),
};

export const mercadoApi = {
  listarOfertas: () => request('/mercado/ofertas'),
  crearOferta: (data) => request('/mercado/ofertas', { method: 'POST', body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────────
// CONFIG API
// ─────────────────────────────────────────────
export const configApi = {
  getVariables: () => request('/config/')
};
