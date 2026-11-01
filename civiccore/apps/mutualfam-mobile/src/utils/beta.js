import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { openSupportEmail } from './support';

// Por defecto, esta versión del producto se considera Beta (Fase 5 con familias reales)
export const DEFAULT_IS_BETA = true;

const ASYNC_BETA_STATE_KEY = 'mutualfam_is_beta_state';
const ASYNC_SEEN_WELCOME_KEY = 'mutualfam_seen_beta_welcome_v1';

let currentBetaState = {
  isBeta: DEFAULT_IS_BETA,
  phaseLabel: DEFAULT_IS_BETA ? 'Beta' : 'Estable',
  welcomeTitle: '¡Bienvenido a la Versión Beta!',
  welcomeMessage:
    'Estás utilizando la versión preliminar de Mutual Familiar. Gracias por ser parte del grupo de familias pioneras que nos ayuda a validar la plataforma con su uso y sugerencias.',
  supportEmail: 'mutualfam@gmail.com',
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...currentBetaState });
    } catch (_) {}
  });
}

/**
 * Carga el estado inicial de la fase desde AsyncStorage (para soporte offline inmediato).
 */
export async function initializeBetaState() {
  try {
    const stored = await AsyncStorage.getItem(ASYNC_BETA_STATE_KEY);
    if (stored !== null) {
      const isBeta = stored === 'true';
      currentBetaState = {
        ...currentBetaState,
        isBeta,
        phaseLabel: isBeta ? 'Beta' : 'Estable',
      };
      notifyListeners();
    }
  } catch (_) {}
  return currentBetaState;
}

/**
 * Sincroniza el estado recibido del backend (/config/ o /config/version).
 */
export async function syncBetaState(remotePhase) {
  if (!remotePhase) return;
  const isBeta = typeof remotePhase.is_beta === 'boolean' ? remotePhase.is_beta : DEFAULT_IS_BETA;
  currentBetaState = {
    isBeta,
    phaseLabel: remotePhase.phase_label || (isBeta ? 'Beta' : 'Estable'),
    welcomeTitle: remotePhase.welcome_title || currentBetaState.welcomeTitle,
    welcomeMessage: remotePhase.welcome_message || currentBetaState.welcomeMessage,
    supportEmail: remotePhase.support_email || currentBetaState.supportEmail,
  };
  try {
    await AsyncStorage.setItem(ASYNC_BETA_STATE_KEY, String(isBeta));
  } catch (_) {}
  notifyListeners();
}

/**
 * Comprueba si el usuario ya vio el modal de bienvenida a la Beta.
 */
export async function hasSeenBetaWelcome() {
  try {
    const val = await AsyncStorage.getItem(ASYNC_SEEN_WELCOME_KEY);
    return val === 'true';
  } catch (_) {
    return false;
  }
}

/**
 * Marca el modal de bienvenida como visto para no volver a mostrarlo en este dispositivo.
 */
export async function markBetaWelcomeSeen() {
  try {
    await AsyncStorage.setItem(ASYNC_SEEN_WELCOME_KEY, 'true');
  } catch (_) {}
}

/**
 * Muestra el diálogo informativo sobre la versión Beta con acceso directo a soporte.
 */
export function showBetaInfoAlert(userEmail = '', orgName = '') {
  Alert.alert(
    'Versión Beta de Mutual Familiar',
    'Esta aplicación se encuentra en fase de pruebas activas con usuarios y familias reales para afinar detalles antes del lanzamiento de la versión estable.\n\n¿Deseas enviar comentarios, sugerencias o reportar alguna incidencia al equipo de soporte?',
    [
      { text: 'Cerrar', style: 'cancel' },
      {
        text: 'Enviar Comentarios',
        onPress: () => {
          openSupportEmail({
            subject: 'Feedback sobre Versión Beta',
            userEmail,
            orgName,
            contextNote: 'Iniciado desde el indicador Beta de la aplicación móvil.',
          });
        },
      },
    ]
  );
}

/**
 * Hook de React para reaccionar a cambios en la fase de la aplicación (Beta vs Estable).
 */
export function useBetaPhase() {
  const [phase, setPhase] = useState({ ...currentBetaState });

  useEffect(() => {
    listeners.add(setPhase);
    initializeBetaState().then((s) => setPhase({ ...s }));
    return () => {
      listeners.delete(setPhase);
    };
  }, []);

  return phase;
}
