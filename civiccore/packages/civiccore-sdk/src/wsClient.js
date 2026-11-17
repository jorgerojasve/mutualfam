import { getConfig } from './config.js';
import { eventBus } from './eventBus.js';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.token = null;
    this.orgId = null;
    this.wasConnected = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[CivicCore WS] Conexión online restaurada, reconectando WebSocket...');
        this.reconnectAttempts = 0;
        this.connect();
      });

      window.addEventListener('focus', () => {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
          console.log('[CivicCore WS] Ventana en foco y WebSocket inactivo, reconectando...');
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
    }
  }

  connect(token, orgId) {
    const nextToken = token || this.token;
    const nextOrgId = orgId || this.orgId || '1';

    const orgChanged = this.orgId && String(this.orgId) !== String(nextOrgId);
    const tokenChanged = this.token && nextToken !== this.token;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (!orgChanged && !tokenChanged) {
        return; // Ya está conectado con la misma mutual y token
      }
      this.disconnect(false);
    }

    this.token = nextToken;
    this.orgId = nextOrgId;

    if (!this.token) return;

    const { baseURL } = getConfig();
    if (!baseURL) return;

    const cleanBase = baseURL.replace(/\/+$/, '');
    const wsBase = cleanBase.replace(/^http/, 'ws');
    const wsURL = `${wsBase}/ws?token=${encodeURIComponent(this.token)}&org_id=${encodeURIComponent(this.orgId)}`;

    try {
      this.ws = new WebSocket(wsURL);

      this.ws.onopen = () => {
        console.log(`[CivicCore WS] Conectado a mutual ${this.orgId}`);
        this.reconnectAttempts = 0;
        if (this.wasConnected) {
          eventBus.publish('RECONNECTED', { org_id: this.orgId });
        }
        this.wasConnected = true;

        // Mantener viva la conexión con ping cada 15 segundos contra proxys de Fly.io
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send('ping');
            } catch (_) {}
          }
        }, 15000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type) {
            if (data.type === 'PONG') return;
            console.log(`[CivicCore WS] Evento en vivo: ${data.type}`, data.payload);
            eventBus.publish(data.type, data.payload);
          }
        } catch (err) {
          // Si el mensaje recibido no es JSON (ej. pong plano), ignorar silenciosamente
        }
      };

      this.ws.onclose = (event) => {
        console.log('[CivicCore WS] Conexión cerrada', event.code, event.reason);
        clearInterval(this.pingInterval);
        this.ws = null;

        // 1000 = Cierre normal voluntario; 1008 = Token o membresía inválidos
        if (event.code !== 1000 && event.code !== 1008) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.warn('[CivicCore WS] Error en WebSocket:', error?.message || error);
      };
    } catch (err) {
      console.error('[CivicCore WS] Error al inicializar WebSocket:', err);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    clearTimeout(this.reconnectTimeout);
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 12000);
    this.reconnectAttempts++;
    console.log(`[CivicCore WS] Reintentando conexión en ${delay}ms... (Intento ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(clearAuth = true) {
    clearTimeout(this.reconnectTimeout);
    clearInterval(this.pingInterval);
    if (this.ws) {
      try {
        this.ws.close(1000, 'User logged out or switched mutual');
      } catch (_) {}
      this.ws = null;
    }
    if (clearAuth) {
      this.token = null;
      this.wasConnected = false;
    }
  }
}

export const wsClient = new WebSocketClient();
