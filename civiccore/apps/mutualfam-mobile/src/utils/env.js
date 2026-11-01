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
    case 'qa':
      return {
        key: 'qa',
        label: 'Pruebas (QA)',
        badgeText: 'QA',
        bannerText: '🧪 ENTORNO DE PRUEBAS (QA) • DATOS AISLADOS',
        color: '#10b981', // Verde esmeralda para QA
        bgColor: 'rgba(16, 185, 129, 0.18)',
        borderColor: 'rgba(16, 185, 129, 0.45)',
        screenBg: '#06231c', // Verde bosque esmeralda oscuro
        cardBg: '#0c332b',
        cardBorder: 'rgba(16, 185, 129, 0.22)',
        accentColor: '#10b981',
        tabBarBg: '#082820',
        headerBg: '#051c17',
        isProd: false,
        isQA: true,
        isDev: false,
      };
    case 'development':
      return {
        key: 'development',
        label: 'Desarrollo (DEV)',
        badgeText: 'DEV',
        bannerText: '🛠️ ENTORNO DE DESARROLLO (DEV) • LOCAL',
        color: '#f59e0b', // Ámbar/Amarillo para DEV
        bgColor: 'rgba(245, 158, 11, 0.18)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
        screenBg: '#1c150c', // Carbón ámbar oscuro
        cardBg: '#2a1f10',
        cardBorder: 'rgba(245, 158, 11, 0.22)',
        accentColor: '#f59e0b',
        tabBarBg: '#21170a',
        headerBg: '#181208',
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
        bannerText: '',
        color: '#3b82f6', // Azul para Producción
        bgColor: 'rgba(59, 130, 246, 0.15)',
        borderColor: 'rgba(59, 130, 246, 0.4)',
        screenBg: '#0f172a', // Slate 900 actual
        cardBg: '#1e293b', // Slate 800 actual
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        accentColor: '#3b82f6',
        tabBarBg: '#1e293b',
        headerBg: '#0b1220',
        isProd: true,
        isQA: false,
        isDev: false,
      };
  }
}
