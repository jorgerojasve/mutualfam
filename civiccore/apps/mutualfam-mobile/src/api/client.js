import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

let baseURL = process.env.EXPO_PUBLIC_API_URL;

if (!baseURL) {
  if (__DEV__) {
    // Entorno de desarrollo local (Docker local en puerto 8000)
    const hostUri = Constants?.expoConfig?.hostUri;
    console.log("hostUri detectado:", hostUri);
    if (hostUri) {
      // Teléfono físico o emulador vía Expo Go (extrae automáticamente la IP de la PC)
      baseURL = `http://${hostUri.split(':')[0]}:8000/api/v1`;
    } else if (Platform.OS === 'android') {
      // Emulador Android conectando al localhost de la máquina anfitriona
      baseURL = 'http://10.0.2.2:8000/api/v1';
    } else {
      // iOS Simulator o Web
      baseURL = 'http://localhost:8000/api/v1';
    }
  } else {
    // Compilación Release (APK standalone sin variable EXPO_PUBLIC_API_URL explícita)
    const pkg = (Constants?.expoConfig?.android?.package || '').toLowerCase();
    const appName = (Constants?.expoConfig?.name || '').toLowerCase();
    const isQA = pkg.includes('.qa') || appName.includes('(qa)') || appName.includes('qa');
    if (isQA) {
      baseURL = 'https://mutualfam-qa-backend.fly.dev/api/v1';
    } else {
      baseURL = 'https://mutualfam-backend.fly.dev/api/v1';
    }
  }
}

console.log("baseURL final en client.js:", baseURL);

export { baseURL };

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const orgId = await AsyncStorage.getItem('active_org_id');
    if (orgId) {
      config.headers['X-Organization-ID'] = orgId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Manejo de Fase 0: Si el usuario ya no pertenece a la mutual seleccionada
    if (error.response && error.response.status === 403 && error.response.data?.detail === "No perteneces a esta mutual") {
      await AsyncStorage.removeItem('active_org_id');
      const { navigationRef } = require('../../App');
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'SelectMutual' }],
        });
      }
      return Promise.reject(error);
    }
    
    // Si el error es 401 (Unauthorized) y no hemos intentado refrescar ya
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No hay refresh token, forzamos cierre de sesión lógico
          await AsyncStorage.multiRemove(['jwt_token', 'refresh_token']);
          
          const { navigationRef } = require('../../App');
          if (navigationRef.isReady()) {
            navigationRef.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
          return Promise.reject(error);
        }
        
        // Hacemos petición cruda con axios para no caer en el interceptor nuevamente
        const response = await axios.post(`${baseURL}/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        });
        
        const newAccessToken = response.data.access_token;
        await AsyncStorage.setItem('jwt_token', newAccessToken);
        
        // Reintentar la petición original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
        
      } catch (refreshError) {
        // Si el refresh falló (ej. expiró también), limpiamos sesión
        await AsyncStorage.multiRemove(['jwt_token', 'refresh_token']);
        
        // Importación lazy para evitar ciclos de dependencia con App.js
        const { navigationRef } = require('../../App');
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (email, password) => {
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);
    const { data } = await apiClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return data;
  },
  me: async () => {
    const { data } = await apiClient.get('/membership/me');
    return data;
  },
  register: async (email, password, fullName) => {
    const { data } = await apiClient.post('/membership/register', {
      email,
      password,
      full_name: fullName
    });
    return data;
  },
  getMembers: async (orgId) => {
    const { data } = await apiClient.get('/membership/members', { headers: { 'X-Organization-ID': orgId }});
    return data;
  }
};

export const loansApi = {
  getLoans: async () => {
    const { data } = await apiClient.get('/loans/');
    return data;
  },
  createLoan: async (payload) => {
    const { data } = await apiClient.post('/loans/', payload);
    return data;
  },
  cancelLoan: async (loanId) => {
    const { data } = await apiClient.delete(`/loans/${loanId}`);
    return data;
  },
  getPaymentMethods: async () => {
    const { data } = await apiClient.get('/config/payment_methods');
    return data;
  },
  getAppConfig: async () => {
    const { data } = await apiClient.get('/config/');
    return data;
  },
  updatePaymentMethods: async (paymentMethodsJson) => {
    const { data } = await apiClient.post('/config/payment_methods', { payment_methods_json: paymentMethodsJson });
    return data;
  },
  contributeToLoan: async (loanId, amount_usd) => {
    const { data } = await apiClient.post(`/loans/${loanId}/contribute`, { amount_usd });
    return data;
  },
  cancelContribution: async (contribId) => {
    const { data } = await apiClient.delete(`/loans/contributions/${contribId}`);
    return data;
  },
  notifyPayment: async (contribId, paymentData) => {
    const { data } = await apiClient.post(`/loans/contributions/${contribId}/notify_payment`, paymentData);
    return data;
  },
  verifyPayment: async (contribId) => {
    const { data } = await apiClient.post(`/loans/contributions/${contribId}/verify_payment`);
    return data;
  },
  notifyRepayment: async (contribId, repayData) => {
    const { data } = await apiClient.post(`/loans/contributions/${contribId}/repay`, repayData);
    return data;
  },
  verifyRepayment: async (repayId) => {
    const { data } = await apiClient.post(`/loans/repayments/${repayId}/verify`);
    return data;
  },
  uploadFile: async (fileUri) => {
    let filename = fileUri.split('/').pop();
    let match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1]}` : `image`;
    let formData = new FormData();
    formData.append('file', { uri: fileUri, name: filename, type });
    
    const res = await apiClient.post('/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  }
};

export const fundsApi = {
  getFunds: async () => {
    const { data } = await apiClient.get('/funds/');
    return data;
  },
  createFund: async (payload) => {
    const { data } = await apiClient.post('/funds/', payload);
    return data;
  }
};

export const colectasApi = {
  getColectas: async (estado = null) => {
    const params = estado ? { estado } : {};
    const { data } = await apiClient.get('/colectas/', { params });
    return data;
  },
  getColecta: async (id) => {
    const { data } = await apiClient.get(`/colectas/${id}`);
    return data;
  },
  getRates: async (tasaFija = null) => {
    const params = tasaFija ? { tasa_fija: tasaFija } : {};
    const { data } = await apiClient.get('/colectas/tasas', { params });
    return data;
  },
  createColecta: async (payload) => {
    const { data } = await apiClient.post('/colectas/', payload);
    return data;
  },
  pledgeCommitment: async (colectaId, montoUsd) => {
    const { data } = await apiClient.post(`/colectas/${colectaId}/compromisos`, { monto_usd: montoUsd });
    return data;
  },
  cancelCommitment: async (colectaId, compromisoId) => {
    const { data } = await apiClient.delete(`/colectas/${colectaId}/compromisos/${compromisoId}`);
    return data;
  },
  triggerPaymentNotifications: async (colectaId) => {
    const { data } = await apiClient.post(`/colectas/${colectaId}/notificar-cobro`);
    return data;
  },
  confirmPayment: async (colectaId, compromisoId, paymentData) => {
    const { data } = await apiClient.post(`/colectas/${colectaId}/compromisos/${compromisoId}/confirmar-pago`, paymentData);
    return data;
  },
  validateExpense: async (colectaId, expenseData) => {
    const { data } = await apiClient.post(`/colectas/${colectaId}/validar-gasto`, expenseData);
    return data;
  },
  cancelColecta: async (colectaId) => {
    const { data } = await apiClient.patch(`/colectas/${colectaId}/cancelar`);
    return data;
  }
};

export const governanceApi = {
  getPropuestas: async () => {
    const { data } = await apiClient.get('/gobernanza/propuestas');
    return data;
  },
  getPropuesta: async (id) => {
    const { data } = await apiClient.get(`/gobernanza/propuestas/${id}`);
    return data;
  },
  proponerIngreso: async (payload) => {
    const { data } = await apiClient.post('/gobernanza/proponer-ingreso', payload);
    return data;
  },
  proponerExpulsion: async (payload) => {
    const { data } = await apiClient.post('/gobernanza/proponer-expulsion', payload);
    return data;
  },
  votar: async (id, voto) => {
    const { data } = await apiClient.post(`/gobernanza/propuestas/${id}/votar`, { voto });
    return data;
  },
  publicarDefensa: async (id, defenseText) => {
    const { data } = await apiClient.post(`/gobernanza/propuestas/${id}/defensa`, { defense_text: defenseText });
    return data;
  },
  cerrarPropuesta: async (id) => {
    const { data } = await apiClient.post(`/gobernanza/propuestas/${id}/cerrar`);
    return data;
  },
  getCandidatosDisponibles: async (search = '') => {
    const params = search ? { q: search } : {};
    const { data } = await apiClient.get('/gobernanza/candidatos-disponibles', { params });
    return data;
  },
  getMiembrosExpulsables: async () => {
    const { data } = await apiClient.get('/gobernanza/miembros-expulsables');
    return data;
  }
};

export default apiClient;

