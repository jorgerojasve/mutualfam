/**
 * Configuración global del SDK
 */

const defaultConfig = {
  // IP de tu computadora en la red local (para desarrollo móvil) o localhost para web
  baseURL: 'http://172.16.0.12:8001/api/v1',
  storage: {
    getItem: async (key) => null,
    setItem: async (key, value) => {},
    removeItem: async (key) => {}
  }
};

let currentConfig = { ...defaultConfig };

export const initCivicCore = (config) => {
  currentConfig = { ...currentConfig, ...config };
};

export const getConfig = () => currentConfig;
