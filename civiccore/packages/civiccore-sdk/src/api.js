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
  stats: () => request('/membership/stats'),
  solicitarBaja: () => request('/membership/withdrawal/request', { method: 'POST' }),
  cancelarBaja: () => request('/membership/withdrawal/cancel', { method: 'POST' }),
  estadoBaja: () => request('/membership/withdrawal/status'),
  estadoExpulsion: (memberId) => request(`/membership/expulsion/${memberId}`),
  obtenerEventosOrganizacion: () => request('/membership/organization/events'),
  
  // Fusion Processes
  getFusionProcesses: () => request('/membership/organization/fusion-processes'),
  getFusionProcess: (id) => request(`/membership/organization/fusion-processes/${id}`),
  advanceFusionProcess: (id, stage) => request(`/membership/organization/fusion-processes/${id}/advance`, {
    method: 'POST',
    body: JSON.stringify({ stage })
  }),
  updateFusionData: (id, data) => request(`/membership/organization/fusion-processes/${id}/data`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  uploadFusionSnapshot: async (id, file) => {
    const { baseURL, storage } = getConfig();
    const token = await storage.getItem('jwt_token');
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${baseURL}/membership/organization/fusion-processes/${id}/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });
    
    let rawText = '';
    try {
      rawText = await response.text();
      const data = JSON.parse(rawText);
      if (!response.ok) throw new Error(data?.detail || 'Error al subir snapshot.');
      return data;
    } catch (error) {
      if (error.message && error.message !== 'Unexpected end of JSON input') throw error;
      if (!response.ok) throw new Error(`Error del servidor (${response.status})`);
      throw error;
    }
  }
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
  editarPropuesta: (id, data) => request(`/governance/proposals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  editarDefensa: (id, defense_text) => request(`/governance/proposals/${id}/defense`, { method: 'PUT', body: JSON.stringify({ defense_text }) }),
  obtenerVersiones: (id) => request(`/governance/proposals/${id}/versions`),
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
  solicitar: (memberId, data) => request(`/payments/credits?member_id=${memberId}`, { method: 'POST', body: JSON.stringify(data) }),
  mios: (memberId) => request(`/payments/credits/${memberId}`),
  listarTodas: () => request('/payments/credits'),
  cambiarEstado: (creditoId, status) => request(`/payments/credits/${creditoId}/status?status=${status}`, { method: 'PATCH' }),
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

// ─────────────────────────────────────────────
// Módulo: Gobernanza Representativa (Junta, Comités, Delegados)
// ─────────────────────────────────────────────

export const boardApi = {
  getCurrentBoard: () => request('/governance/board'),
  createElection: (data) => request('/governance/board/elections', { method: 'POST', body: JSON.stringify(data) })
};

export const committeesApi = {
  list: () => request('/governance/committees'),
  propose: (data) => request('/governance/committees', { method: 'POST', body: JSON.stringify(data) })
};

export const delegatesApi = {
  assign: (data) => request('/governance/delegations', { method: 'POST', body: JSON.stringify(data) }),
  myDelegations: () => request('/governance/delegations/mine'),
  revoke: (id) => request(`/governance/delegations/${id}`, { method: 'DELETE' })
};
