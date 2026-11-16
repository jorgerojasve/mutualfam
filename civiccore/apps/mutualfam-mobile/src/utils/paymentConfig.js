import AsyncStorage from '@react-native-async-storage/async-storage';
import { loansApi } from '../api/client';

export const CACHED_PAYMENT_CONFIG_KEY = 'cached_user_payment_methods';

/**
 * Lee la configuración de métodos de pago guardada localmente en AsyncStorage.
 * @returns {Promise<Object>}
 */
export const getPersistedPaymentConfig = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHED_PAYMENT_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('Error reading persisted payment config:', e);
    return {};
  }
};

/**
 * Guarda la configuración de métodos de pago en AsyncStorage.
 * @param {Object} config
 */
export const setPersistedPaymentConfig = async (config) => {
  try {
    if (config && typeof config === 'object') {
      await AsyncStorage.setItem(CACHED_PAYMENT_CONFIG_KEY, JSON.stringify(config));
    }
  } catch (e) {
    console.warn('Error writing persisted payment config:', e);
  }
};

/**
 * Normaliza nombres de métodos de pago para comparaciones uniformes.
 */
export const normalizePaymentMethodKey = (method) => {
  if (!method) return '';
  const m = String(method).toLowerCase().trim();
  if (m === 'pago_movil' || m === 'pago movil' || m === 'pagomovil') return 'Pago Móvil';
  if (m === 'transferencia' || m === 'transferencia bancaria' || m === 'transferencia_bancaria') return 'Transferencia Bancaria';
  if (m === 'binance' || m === 'binance_pay' || m === 'usdt') return 'Binance';
  if (m === 'zelle') return 'Zelle';
  if (m === 'efectivo' || m === 'efectivo usd' || m === 'efectivo_usd') return 'Efectivo USD';
  if (m === 'efectivo bolívares' || m === 'efectivo_ves' || m === 'efectivo bs' || m === 'efectivo ves') return 'Efectivo Bolívares';
  return method;
};

/**
 * Determina si un método corresponde a "moneda dura" (USD en efectivo, USDT, Zelle)
 * que permite aportes antes de la fecha de pago/liquidación en colectas.
 */
export const isHardCurrencyMethod = (method) => {
  if (!method) return false;
  const m = String(method).toLowerCase().trim();
  if (!m) return false;
  if (
    m.includes('bolívar') ||
    m.includes('bolivar') ||
    m.includes('pago móvil') ||
    m.includes('pago movil') ||
    m.includes('pago_movil') ||
    m.includes('transferencia') ||
    m.includes('ves') ||
    m.includes('(bs)') ||
    m.includes(' bs') ||
    m.includes('_bs') ||
    m === 'bs'
  ) {
    return false;
  }
  return (
    m.includes('efectivo usd') ||
    m.includes('efectivo_usd') ||
    m.includes('usd') ||
    m.includes('usdt') ||
    m.includes('binance') ||
    m.includes('zelle') ||
    m === 'efectivo'
  );
};

/**
 * Formatea el resumen de nómina de billetes y seriales para registro de pagos.
 */
export const formatCashPaymentSummary = (payroll = {}, serials = '', deliveryNote = '') => {
  const denominations = [100, 50, 20, 10, 5, 1];
  const breakdownParts = [];
  let total = 0;
  denominations.forEach((den) => {
    const count = parseInt(payroll[den], 10) || 0;
    if (count > 0) {
      breakdownParts.push(`${count}x$${den}`);
      total += count * den;
    }
  });

  const shortRef = breakdownParts.length > 0
    ? `Nómina: ${breakdownParts.join(', ')} ($${total} USD)`
    : (serials && serials.trim() ? `Seriales: ${serials.trim()}` : 'Efectivo USD en mano');

  const details = [];
  if (breakdownParts.length > 0) {
    details.push(`Nómina: ${breakdownParts.join(', ')} (Total: $${total} USD)`);
  }
  if (serials && serials.trim()) {
    details.push(`Seriales: ${serials.trim()}`);
  }
  if (deliveryNote && deliveryNote.trim()) {
    details.push(`Entrega: ${deliveryNote.trim()}`);
  }

  return {
    total,
    shortRef,
    fullNote: details.join(' | ') || 'Entrega en efectivo USD',
  };
};

/**
 * Verifica si un objeto de configuración contiene al menos un método de pago válido y completo.
 * @param {Object|string} config
 * @returns {boolean}
 */
export const hasConfiguredPaymentMethods = (config) => {
  if (!config) return false;
  let obj = config;
  if (typeof config === 'string') {
    try {
      obj = JSON.parse(config);
    } catch (_) {
      return false;
    }
  }
  if (!obj || typeof obj !== 'object') return false;

  return Object.entries(obj).some(([key, val]) => {
    const normKey = normalizePaymentMethodKey(key);
    if (normKey === 'Pago Móvil') {
      return Boolean(val && typeof val === 'object' && val.banco && val.cedula && val.telefono);
    }
    if (normKey === 'Transferencia Bancaria') {
      return Boolean(
        val &&
        typeof val === 'object' &&
        val.banco &&
        val.numero_cuenta &&
        String(val.numero_cuenta).replace(/\D/g, '').length === 20 &&
        val.cedula &&
        val.titular
      );
    }
    if (normKey === 'Efectivo USD') {
      if (val && typeof val === 'object') {
        const tel = String(val.telefono || '').trim();
        const lug = String(val.lugar || val.zona_entrega || '').trim();
        return Boolean(tel && lug);
      }
      return typeof val === 'string' && val.trim().length > 0;
    }
    if (typeof val === 'string') {
      return val.trim().length > 0;
    }
    if (val && typeof val === 'object') {
      return Object.keys(val).length > 0;
    }
    return Boolean(val);
  });
};

/**
 * Obtiene la lista de métodos de pago válidamente configurados.
 * @param {Object|string} config
 * @returns {Array<string>}
 */
export const getAvailablePaymentMethods = (config) => {
  if (!config) return [];
  let obj = config;
  if (typeof config === 'string') {
    try {
      obj = JSON.parse(config);
    } catch (_) {
      return [];
    }
  }
  if (!obj || typeof obj !== 'object') return [];

  const methods = [];
  for (const [key, val] of Object.entries(obj)) {
    const normKey = normalizePaymentMethodKey(key);
    if (normKey === 'Pago Móvil') {
      if (val && typeof val === 'object' && val.banco && val.cedula && val.telefono) {
        if (!methods.includes(normKey)) methods.push(normKey);
      }
    } else if (normKey === 'Transferencia Bancaria') {
      if (
        val &&
        typeof val === 'object' &&
        val.banco &&
        val.numero_cuenta &&
        String(val.numero_cuenta).replace(/\D/g, '').length === 20 &&
        val.cedula &&
        val.titular
      ) {
        if (!methods.includes(normKey)) methods.push(normKey);
      }
    } else if (normKey === 'Efectivo USD') {
      if (val && typeof val === 'object') {
        const tel = String(val.telefono || '').trim();
        const lug = String(val.lugar || val.zona_entrega || '').trim();
        if (tel && lug) {
          if (!methods.includes(normKey)) methods.push(normKey);
        }
      } else if (typeof val === 'string' && val.trim().length > 0) {
        if (!methods.includes(normKey)) methods.push(normKey);
      }
    } else if (typeof val === 'string' && val.trim().length > 0) {
      if (!methods.includes(normKey)) methods.push(normKey);
    } else if (val && typeof val === 'object' && Object.keys(val).length > 0) {
      if (!methods.includes(normKey)) methods.push(normKey);
    }
  }
  return methods;
};

/**
 * Carga la configuración de pagos del usuario:
 * 1. Intenta desde el servidor via API y persiste en caché AsyncStorage si tiene éxito.
 * 2. Si falla (sin conexión / error de red), recurre inmediatamente a la configuración persistida en AsyncStorage.
 * 3. Si no hay en storage, recurre al fallback previo en memoria.
 * @param {Object} fallbackConfig Configuración previa en memoria
 * @returns {Promise<Object>}
 */
export const loadUserPaymentConfig = async (fallbackConfig = null) => {
  try {
    const res = await loansApi.getPaymentMethods();
    const rawJson = res?.payment_methods_json || '{}';
    const parsed = JSON.parse(rawJson);
    if (parsed && typeof parsed === 'object') {
      // Guardar en persistencia local para acceso offline
      await setPersistedPaymentConfig(parsed);
      return parsed;
    }
  } catch (e) {
    console.warn('Network error loading payment methods, falling back to local storage:', e);
  }

  // Recurrir a persistencia en AsyncStorage
  const cached = await getPersistedPaymentConfig();
  if (cached && Object.keys(cached).length > 0) {
    return cached;
  }

  // Si no hay en storage, recurrir al fallback previo en memoria
  if (fallbackConfig && typeof fallbackConfig === 'object' && Object.keys(fallbackConfig).length > 0) {
    return fallbackConfig;
  }

  return {};
};

