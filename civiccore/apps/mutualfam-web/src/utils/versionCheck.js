import packageJson from '../../package.json';

export const CURRENT_APP_VERSION = packageJson.version || '1.1.77';

/**
 * Consulta /version.json con cache-busting estricto para ver si Vercel/Producción tiene
 * una versión más reciente desplegada.
 */
export async function checkForWebUpdate() {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!res.ok) return { hasUpdate: false };
    const remote = await res.json();
    if (!remote || !remote.version) return { hasUpdate: false };

    const hasUpdate = remote.version !== CURRENT_APP_VERSION;
    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: remote.version,
      buildTime: remote.buildTime,
    };
  } catch (e) {
    return { hasUpdate: false, error: e };
  }
}

/**
 * Limpia cachés de Service Worker / CacheStorage del navegador y recarga la página.
 */
export async function applyWebUpdate(targetVersion = null) {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (_) {}

  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
  } catch (_) {}

  // Recarga forzada con parámetro anti-caché
  const url = new URL(window.location.href);
  url.searchParams.set('_v', targetVersion || Date.now());
  window.location.href = url.toString();
  // Fallback directo
  window.location.reload();
}
