import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { baseURL, authApi } from '../api/client';

/**
 * Cliente WebSocket de eventos en tiempo real por mutual.
 * - Se conecta a la mutual activa y reconecta con backoff si se cae.
 * - Al volver la app a primer plano reconecta y emite 'RECONNECTED' para refrescar datos.
 * - Los componentes se suscriben con `subscribeRealtime(tipo, callback)`.
 */
const listeners = new Map();
let ws = null;
let currentOrgId = null;
let retryTimer = null;
let retryCount = 0;
let pingTimer = null;
let appStateSub = null;
let wasOpenBefore = false;
let pongTimer = null;

const emit = (type, payload) => {
  (listeners.get(type) || []).forEach((cb) => {
    try { cb(payload); } catch (e) { console.warn('[RT] listener error', e); }
  });
};

export const subscribeRealtime = (type, cb) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(cb);
  return () => listeners.get(type)?.delete(cb);
};

const cleanupSocket = () => {
  clearInterval(pingTimer);
  clearTimeout(pongTimer);
  if (ws) {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try { ws.close(); } catch (e) {}
    ws = null;
  }
};

const open = async () => {
  if (!currentOrgId) return;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  const token = await AsyncStorage.getItem('jwt_token');
  if (!token) {
    console.log('[RT] sin token todavía, reintentando');
    scheduleRetry();
    return;
  }

  const url = baseURL.replace(/^http/, 'ws') +
    `/ws?token=${encodeURIComponent(token)}&org_id=${encodeURIComponent(currentOrgId)}`;
  const orgAtOpen = currentOrgId;
  const socket = new WebSocket(url);
  ws = socket;

  let opened = false;
  socket.onopen = () => {
    opened = true;
    console.log('[RT] conectado a mutual', orgAtOpen);
    retryCount = 0;
    // Si hubo una caída previa, pudimos perdernos eventos: refrescar.
    if (wasOpenBefore) emit('RECONNECTED');
    wasOpenBefore = true;
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket.readyState !== 1) return;
      socket.send('ping');
      clearTimeout(pongTimer);
      pongTimer = setTimeout(() => {
        console.log('[RT] sin PONG, reconectando');
        if (ws === socket) { cleanupSocket(); retryCount = 0; open(); }
      }, 8000);
    }, 15000);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === 'PONG') { clearTimeout(pongTimer); return; }
      console.log('[RT] evento', data?.type);
      if (data?.type) emit(data.type, data.payload);
    } catch (e) {}
  };

  socket.onerror = (e) => console.log('[RT] error', e?.message || '');

  socket.onclose = async (event) => {
    console.log('[RT] cerrado', event?.code, opened ? '' : '(rechazado)');
    clearInterval(pingTimer);
    if (ws === socket) ws = null;
    // Rechazo antes de abrir: probablemente token vencido; una llamada HTTP dispara el refresh
    if (!opened) { try { await authApi.me(); } catch (e) {} }
    // 1008 = token o membresía inválidos; el interceptor HTTP se encarga de renovar sesión
    if (currentOrgId === orgAtOpen) scheduleRetry();
  };
};

const scheduleRetry = () => {
  clearTimeout(retryTimer);
  const delay = Math.min(1000 * Math.pow(2, retryCount), 15000);
  retryCount += 1;
  retryTimer = setTimeout(open, delay);
};

export const connectRealtime = (orgId) => {
  if (!orgId) return;
  const id = String(orgId);
  if (id !== currentOrgId) {
    cleanupSocket();
    wasOpenBefore = false;
  }
  currentOrgId = id;
  retryCount = 0;
  open();

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && currentOrgId) {
        if (!ws || ws.readyState > 1) { retryCount = 0; open(); }
        else emit('RECONNECTED'); // conexión pudo estar zombie en segundo plano
      }
    });
  }
};

export const disconnectRealtime = () => {
  currentOrgId = null;
  clearTimeout(retryTimer);
  cleanupSocket();
  wasOpenBefore = false;
};
