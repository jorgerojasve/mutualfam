import { create } from 'zustand';
import { authApi } from './api.js';
import { getConfig } from './config.js';

export const useAuthStore = create((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,  // Empieza en true para la pantalla de splash

  loadUser: async () => {
    try {
      const { storage } = getConfig();
      const token = await storage.getItem('jwt_token');
      if (token) {
        const rawUser = await authApi.me();
        const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
        set({ isAuthenticated: true, user, isLoading: false });
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
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    const tokenResponse = await authApi.login(email, password);
    const { storage } = getConfig();
    await storage.setItem('jwt_token', tokenResponse.access_token);
    await storage.setItem('biometric_jwt_token', tokenResponse.access_token);
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    set({ isAuthenticated: true, user });
  },

  loginBiometric: async () => {
    const { storage } = getConfig();
    const token = await storage.getItem('biometric_jwt_token');
    if (!token) throw new Error("No hay token biométrico");
    await storage.setItem('jwt_token', token);
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    set({ isAuthenticated: true, user });
  },

  register: async (userData) => {
    await authApi.register(userData);
    const tokenResponse = await authApi.login(userData.email, userData.password);
    const { storage } = getConfig();
    await storage.setItem('jwt_token', tokenResponse.access_token);
    await storage.setItem('biometric_jwt_token', tokenResponse.access_token);
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    set({ isAuthenticated: true, user });
  },

  logout: async () => {
    const { storage } = getConfig();
    await storage.removeItem('jwt_token');
    set({ isAuthenticated: false, user: null });
  },
}));
