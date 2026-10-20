import Constants from 'expo-constants';
import axios from 'axios';
import { baseURL } from '../api/client';

let cachedVersion = null;

/**
 * Obtiene la versión actual configurada en el cliente móvil.
 */
export const getCurrentAppVersion = () => {
  if (cachedVersion) return cachedVersion;

  try {
    cachedVersion = Constants?.expoConfig?.version;
  } catch (_) {}

  if (!cachedVersion) {
    try {
      const appJson = require('../../app.json');
      cachedVersion = appJson?.expo?.version;
    } catch (_) {}
  }

  return cachedVersion || '1.0.17';
};

/**
 * Compara dos versiones semver (ej: "1.0.3" vs "1.0.9").
 * Retorna:
 *  -1 si v1 < v2
 *   0 si v1 === v2
 *   1 si v1 > v2
 */
export const compareVersions = (v1, v2) => {
  if (!v1 || !v2) return 0;
  const cleanV1 = String(v1).replace(/^v/, '').trim();
  const cleanV2 = String(v2).replace(/^v/, '').trim();

  const parts1 = cleanV1.split('-')[0].split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = cleanV2.split('-')[0].split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
};

/**
 * Consulta al backend (/config/version) para saber si existe una nueva versión
 * y si la versión actual es menor al mínimo requerido (obligatoria).
 */
export const checkForAppUpdate = async () => {
  const currentVersion = getCurrentAppVersion();
  try {
    const response = await axios.get(`${baseURL}/config/version`, { timeout: 5000 });
    const data = response.data || {};

    const latestVersion = data.latest_version || currentVersion;
    const minVersion = data.min_version || '1.0.0';
    const downloadUrl = data.download_url || `${baseURL}/config/latest-apk`;
    const releaseNotes = data.release_notes || '';

    // Hay actualización si la última versión es estrictamente mayor a la instalada
    const hasUpdate = compareVersions(currentVersion, latestVersion) < 0;

    // Es obligatoria si la versión actual es menor que el mínimo requerido
    const isMandatory = compareVersions(currentVersion, minVersion) < 0;

    return {
      hasUpdate,
      isMandatory,
      currentVersion,
      latestVersion,
      minVersion,
      releaseNotes,
      downloadUrl,
    };
  } catch (error) {
    console.warn('[appUpdates] No se pudo verificar la actualización:', error?.message || error);
    return {
      hasUpdate: false,
      isMandatory: false,
      currentVersion,
      error: error?.message || 'Error de conexión',
    };
  }
};
