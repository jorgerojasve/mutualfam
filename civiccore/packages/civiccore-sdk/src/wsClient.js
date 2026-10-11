import { getConfig } from './config.js';
import { eventBus } from './eventBus.js';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.token = null;
    this.orgId = null;
  }

  connect(token, orgId) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // Already connected or connecting
    }

    this.token = token || this.token;
    this.orgId = orgId || this.orgId || '1';

    if (!this.token) return;

    const { baseURL } = getConfig();
    // Convert http:// to ws:// and https:// to wss://
    const wsURL = baseURL.replace(/^http/, 'ws') + `/auth/ws?token=${encodeURIComponent(this.token)}&org_id=${encodeURIComponent(this.orgId)}`;

    try {
      this.ws = new WebSocket(wsURL);

      this.ws.onopen = () => {
        console.log('[CivicCore WS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.type) {
            // Forward WS message to local EventBus
            eventBus.publish(data.type, data.payload);
          }
        } catch (err) {
          console.error('[CivicCore WS] Error parsing message', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[CivicCore WS] Disconnected', event.code, event.reason);
        this.ws = null;
        
        // Don't reconnect if it was a normal closure or if missing token
        if (event.code !== 1000 && event.code !== 1008) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[CivicCore WS] Connection Error:', error);
      };
    } catch (err) {
      console.error('[CivicCore WS] Initialization failed:', err);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[CivicCore WS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    console.log(`[CivicCore WS] Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);

    clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close(1000, 'User logged out');
      this.ws = null;
    }
    this.token = null;
  }
}

export const wsClient = new WebSocketClient();
