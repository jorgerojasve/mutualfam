/**
 * Utilidad de detección y configuración de entorno para MutualFam Web.
 * Detecta si la aplicación se ejecuta en:
 * - 'development' (localhost / Vite dev)
 * - 'qa' (dominio con -qa, API con -qa, o VITE_APP_ENV=qa)
 * - 'production' (producción limpia)
 */

export function getAppEnvironment() {
  const envVar = (import.meta.env.VITE_APP_ENV || '').toLowerCase();
  if (envVar === 'qa') return 'qa';
  if (envVar === 'production' || envVar === 'prod') return 'production';
  if (envVar === 'development' || envVar === 'dev') return 'development';

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
      return 'development';
    }
    if (host.includes('-qa') || host.includes('.qa.') || host.includes('qa-') || host.includes('qa.')) {
      return 'qa';
    }
  }

  const apiUrl = (import.meta.env.VITE_API_URL || '')
    .toString()
    .trim()
    .replace(/[\r\n\t]/g, '')
    .toLowerCase();
  if (apiUrl.includes('-qa') || apiUrl.includes('/qa')) {
    return 'qa';
  }

  if (import.meta.env.DEV) {
    return 'development';
  }

  return 'production';
}

export function getEnvironmentConfig() {
  const env = getAppEnvironment();
  switch (env) {
    case 'qa':
      return {
        key: 'qa',
        label: 'QA (Pruebas)',
        badgeText: 'QA',
        appName: 'MutualFam QA',
        tagline: 'Entorno de Validación y Pruebas (QA)',
        color: '#f59e0b', // Amber 500
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        bannerText: '🧪 Entorno de Pruebas (QA) • Los datos son ficticios y no representan dinero real',
        isProd: false,
        isQA: true,
        isDev: false,
      };
    case 'development':
      return {
        key: 'development',
        label: 'DESARROLLO',
        badgeText: 'DEV',
        appName: 'MutualFam Dev',
        tagline: 'Entorno Local de Desarrollo (DEV)',
        color: '#3b82f6', // Blue 500
        bgColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        bannerText: '🛠️ Modo de Desarrollo Local (DEV) • Base de datos local',
        isProd: false,
        isQA: false,
        isDev: true,
      };
    case 'production':
    default:
      return {
        key: 'production',
        label: 'Producción',
        badgeText: '',
        appName: 'MutualFam',
        tagline: 'Gestión de préstamos y aportes familiares',
        color: '#10b981', // Emerald 500
        bgColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        bannerText: null,
        isProd: true,
        isQA: false,
        isDev: false,
      };
  }
}
