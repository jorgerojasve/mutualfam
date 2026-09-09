import { create } from 'zustand';
import { authApi, saveToken, getToken, removeToken, saveBiometricToken, getBiometricToken } from '../services/api';

export const useAuthStore = create((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,  // Empieza en true para la pantalla de splash

  /**
   * Carga la sesión al abrir la app.
   * Si hay un token guardado lo valida con /auth/me para obtener el perfil real.
   */
  loadUser: async () => {
    try {
      const token = await getToken();
      if (token) {
        const rawUser = await authApi.me();
        const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
        set({ isAuthenticated: true, user, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      // Token expirado, inválido o error del sistema de almacenamiento
      try {
        await removeToken();
      } catch (storageError) {
        console.warn('Error al limpiar el token:', storageError);
      }
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  /**
   * Inicia sesión con email y contraseña reales.
   * Guarda el token JWT y carga el perfil del usuario.
   */
  login: async (email, password) => {
    const tokenResponse = await authApi.login(email, password);
    await saveToken(tokenResponse.access_token);
    await saveBiometricToken(tokenResponse.access_token); // Guardamos para huella
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    set({ isAuthenticated: true, user });
  },

  /**
   * Login biométrico: usa el token ya guardado en el dispositivo.
   * Si no hay token, lanza un error para informar al usuario.
   */
  loginBiometric: async () => {
    const token = await getBiometricToken();
    if (!token) throw new Error("No hay token biométrico");
    await saveToken(token); // Restauramos token normal para las peticiones
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    set({ isAuthenticated: true, user });
  },

  /**
   * Registra un nuevo socio y lo inicia sesión automáticamente.
   */
  register: async (userData) => {
    await authApi.register(userData);
    // Después del registro exitoso, iniciar sesión automáticamente
    const tokenResponse = await authApi.login(userData.email, userData.password);
    await saveToken(tokenResponse.access_token);
    await saveBiometricToken(tokenResponse.access_token); // Guardamos para huella
    const rawUser = await authApi.me();
    const user = { ...rawUser, nombre: rawUser.first_name, apellido: rawUser.last_name, cedula: rawUser.identifier };
    set({ isAuthenticated: true, user });
  },

  /**
   * Cierra sesión y elimina el token del dispositivo.
   */
  logout: async () => {
    // Borramos el token normal para que AppLoader no inicie sesión
    // pero dejamos el biometricToken en SecureStore
    await removeToken();
    set({ isAuthenticated: false, user: null });
  },
}));
