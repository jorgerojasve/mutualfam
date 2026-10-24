import Constants from 'expo-constants';

/**
 * Utilidad de detección y configuración de entorno para la app móvil Mutual Familiar.
 */

export function getMobileEnvironment() {
  // 1. Variable explícita de entorno (si está definida en .env o CI)
  const explicitEnv = (process.env.EXPO_PUBLIC_APP_ENV || '').toLowerCase().trim();
  if (explicitEnv === 'development' || explicitEnv === 'dev') {
    return 'development';
  }
  if (explicitEnv === 'qa') {
    return 'qa';
  }
  if (explicitEnv === 'production' || explicitEnv === 'prod') {
    return 'production';
  }

  // 2. Modo desarrollo local (Expo Go / Metro Bundler en rama de desarrollo)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // Si explícitamente se configuró una API remota de QA en .env
    const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').toLowerCase();
    if (apiUrl.includes('-qa') || apiUrl.includes('/qa') || apiUrl.includes('.qa.')) {
      return 'qa';
    }
    return 'development';
  }

  // 3. Compilación Release / Standalone APK
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').toLowerCase();
  if (apiUrl.includes('-qa') || apiUrl.includes('/qa') || apiUrl.includes('.qa.')) {
    return 'qa';
  }
  const appName = (Constants?.expoConfig?.name || '').toLowerCase();
  if (appName.includes('(qa)')) {
    return 'qa';
  }
  const pkg = (Constants?.expoConfig?.android?.package || '').toLowerCase();
  if (pkg.includes('.qa')) {
    return 'qa';
  }

  return 'production';
}

export function getMobileEnvironmentConfig() {
  const env = getMobileEnvironment();
  switch (env) {
    case 'development':
      return {
        key: 'development',
        label: 'Desarrollo (DEV)',
        badgeText: 'DEV',
        bannerText: '🛠️ ENTORNO DE DESARROLLO (DEV) • SERVIDOR LOCAL',
        color: '#38bdf8',
        bgColor: 'rgba(56, 189, 248, 0.15)',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        isProd: false,
        isQA: false,
        isDev: true,
      };
    case 'qa':
      return {
        key: 'qa',
        label: 'Pruebas (QA)',
        badgeText: 'QA',
        bannerText: '🧪 ENTORNO DE PRUEBAS (QA) • DATOS AISLADOS',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        isProd: false,
        isQA: true,
        isDev: false,
      };
    case 'production':
    default:
      return {
        key: 'production',
        label: 'Producción',
        badgeText: '',
        bannerText: '',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        isProd: true,
        isQA: false,
        isDev: false,
      };
  }
}
