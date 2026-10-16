import Constants from 'expo-constants';

/**
 * Utilidad de detección y configuración de entorno para la app móvil Mutual Familiar.
 */

export function getMobileEnvironment() {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').toLowerCase();
  if (apiUrl.includes('-qa') || apiUrl.includes('/qa') || apiUrl.includes('.qa.')) {
    return 'qa';
  }
  const appName = (Constants?.expoConfig?.name || '').toLowerCase();
  if (appName.includes('(qa)') || appName.includes('qa')) {
    return 'qa';
  }
  const pkg = (Constants?.expoConfig?.android?.package || '').toLowerCase();
  if (pkg.includes('.qa')) {
    return 'qa';
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'development';
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
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.4)',
        isProd: false,
        isQA: true,
      };
    case 'development':
      return {
        key: 'development',
        label: 'Desarrollo (DEV)',
        badgeText: 'DEV',
        color: '#38bdf8',
        bgColor: 'rgba(56, 189, 248, 0.15)',
        borderColor: 'rgba(56, 189, 248, 0.4)',
        isProd: false,
        isQA: false,
      };
    case 'production':
    default:
      return {
        key: 'production',
        label: 'Producción',
        badgeText: '',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.4)',
        isProd: true,
        isQA: false,
      };
  }
}
