import { create } from 'zustand';
import { authApi, membershipApi } from './api.js';
import { getConfig } from './config.js';
import { wsClient } from './wsClient.js';

const resolveActiveOrg = async (rawUser, storage) => {
  const orgs = rawUser.organizations || [];
  const storedOrgId = (await storage.getItem('active_org_id')) || (await storage.getItem('organizationId'));
  
  let targetOrg = null;
  if (orgs.length > 0) {
    if (storedOrgId) {
      targetOrg = orgs.find(o => String(o.id) === String(storedOrgId)) || null;
    }
    if (!targetOrg) {
      targetOrg = orgs[0];
    }
    await storage.setItem('organizationId', String(targetOrg.id));
    await storage.setItem('active_org_id', String(targetOrg.id));
  } else {
    await storage.removeItem('active_org_id');
  }
  return { orgs, targetOrg };
};

export const useAuthStore = create((set, get) => ({
  isAuthenticated: false,
  user: null,
  activeOrg: null,
  organizations: [],
  isLoading: true,

  loadUser: async () => {
    try {
      const { storage } = getConfig();
      const token = await storage.getItem('jwt_token');
      if (token) {
        const rawUser = await authApi.me();
        const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
        const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
        set({ isAuthenticated: true, user, organizations: orgs, activeOrg: targetOrg, isLoading: false });
        
        // Conectar WS
        if (targetOrg?.id) {
          wsClient.connect(token, String(targetOrg.id));
        }
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      const { storage } = getConfig();
      try {
        await storage.removeItem('jwt_token');
      } catch (storageError) {
        console.warn('Error al limpiar el token:', storageError);
      }
      set({ isAuthenticated: false, user: null, activeOrg: null, organizations: [], isLoading: false });
    }
  },

  selectOrg: async (org) => {
    if (!org) return;
    const { storage } = getConfig();
    await storage.setItem('organizationId', String(org.id));
    await storage.setItem('active_org_id', String(org.id));
    set({ activeOrg: org });
    
    const token = await storage.getItem('jwt_token');
    if (token) {
      wsClient.connect(token, String(org.id));
    }
  },

  refreshUser: async () => {
    try {
      const { storage } = getConfig();
      const rawUser = await authApi.me();
      const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
      const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
      set({ user, organizations: orgs, activeOrg: targetOrg });
      return { user, organizations: orgs, activeOrg: targetOrg };
    } catch (e) {
      console.warn("Could not refresh user", e);
    }
  },

  joinOrg: async (tokenOrCode) => {
    const res = await membershipApi.joinOrganization(tokenOrCode);
    const { storage } = getConfig();
    if (res?.organization_id) {
      await storage.setItem('organizationId', String(res.organization_id));
      await storage.setItem('active_org_id', String(res.organization_id));
    }
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
    set({ user, organizations: orgs, activeOrg: targetOrg });
    return res;
  },

  createOrg: async (name, description = '') => {
    const res = await membershipApi.createOrganization({ name, description });
    const { storage } = getConfig();
    if (res?.organization_id) {
      await storage.setItem('organizationId', String(res.organization_id));
      await storage.setItem('active_org_id', String(res.organization_id));
    }
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
    set({ user, organizations: orgs, activeOrg: targetOrg });
    return res;
  },

  login: async (email, password) => {
    const tokenResponse = await authApi.login(email, password);
    const { storage } = getConfig();
    await storage.setItem('jwt_token', tokenResponse.access_token);
    await storage.setItem('biometric_email', email);
    await storage.setItem('biometric_password', password);
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
    set({ isAuthenticated: true, user, organizations: orgs, activeOrg: targetOrg });

    if (targetOrg?.id) {
      wsClient.connect(tokenResponse.access_token, String(targetOrg.id));
    }
  },

  loginBiometric: async () => {
    const { storage } = getConfig();
    const email = await storage.getItem('biometric_email');
    const password = await storage.getItem('biometric_password');
    if (!email || !password) throw new Error("No hay credenciales biométricas guardadas");
    const tokenResponse = await authApi.login(email, password);
    await storage.setItem('jwt_token', tokenResponse.access_token);
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
    set({ isAuthenticated: true, user, organizations: orgs, activeOrg: targetOrg });

    if (targetOrg?.id) {
      wsClient.connect(tokenResponse.access_token, String(targetOrg.id));
    }
  },

  register: async (userData) => {
    await authApi.register(userData);
    const tokenResponse = await authApi.login(userData.email, userData.password);
    const { storage } = getConfig();
    await storage.setItem('jwt_token', tokenResponse.access_token);
    await storage.setItem('biometric_email', userData.email);
    await storage.setItem('biometric_password', userData.password);
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    const { orgs, targetOrg } = await resolveActiveOrg(rawUser, storage);
    set({ isAuthenticated: true, user, organizations: orgs, activeOrg: targetOrg });

    if (targetOrg?.id) {
      wsClient.connect(tokenResponse.access_token, String(targetOrg.id));
    }
  },

  logout: async () => {
    const { storage } = getConfig();
    await storage.removeItem('jwt_token');
    await storage.removeItem('biometric_email');
    await storage.removeItem('biometric_password');
    await storage.removeItem('active_org_id');
    set({ isAuthenticated: false, user: null, activeOrg: null, organizations: [] });
    
    wsClient.disconnect();
  },
}));
