import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants from 'expo-constants';

// En Desarrollo auto-detectamos la IP local si no hay URL explícita
let baseURL = process.env.EXPO_PUBLIC_API_URL;

if (!baseURL) {
  const hostUri = Constants?.expoConfig?.hostUri;
  if (hostUri) {
    baseURL = `http://${hostUri.split(':')[0]}:8000/api/v1`;
  } else {
    baseURL = 'http://localhost:8000/api/v1';
  }
}

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
    
    // Si el error es 401 (Unauthorized) y no hemos intentado refrescar ya
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No hay refresh token, forzamos cierre de sesión lógico
          await AsyncStorage.multiRemove(['jwt_token', 'refresh_token']);
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

export default apiClient;
