/**
 * Configuración global del SDK
 */

const defaultConfig = {
  // IP de tu computadora en la red local (para desarrollo móvil) o localhost para web
  baseURL: 'http://172.16.0.12:8001/api/v1',
  manifest: null,
  storage: {
    getItem: async (key) => null,
    setItem: async (key, value) => {},
    removeItem: async (key) => {}
  }
};

let currentConfig = { ...defaultConfig };

export const initCivicCore = (config) => {
  const { manifest, ...rest } = config;
  
  currentConfig = { 
    ...currentConfig, 
    ...rest,
    baseURL: manifest?.apiUrl || rest.baseURL || currentConfig.baseURL,
    manifest: manifest || null,
  };

  if (typeof window !== 'undefined' && manifest) {
    if (manifest.theme) {
      const root = document.documentElement;
      if (manifest.theme.primaryColor) root.style.setProperty('--accent-primary', manifest.theme.primaryColor);
      if (manifest.theme.secondaryColor) root.style.setProperty('--accent-secondary', manifest.theme.secondaryColor);
      if (manifest.theme.fontFamily) root.style.setProperty('--font-primary', manifest.theme.fontFamily);
    }
    
    if (manifest.name) {
      document.title = manifest.name;
    }
    
    if (manifest.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = manifest.faviconUrl;
    }
  }
};

export const getConfig = () => currentConfig;
export const getManifest = () => currentConfig.manifest;
