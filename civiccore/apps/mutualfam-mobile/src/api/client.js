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

const forceLogout = async () => {
  try {
    await AsyncStorage.multiRemove(['jwt_token', 'refresh_token', 'active_org_id', 'org_id']);
    const { navigationRef } = require('../../App');
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  } catch (err) {
    console.warn("Error forcing logout:", err);
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Manejo de usuario no encontrado (base de datos limpiada o cuenta borrada)
    if (
      error.response &&
      error.response.status === 404 &&
      (error.response.data?.detail === "User not found" || error.response.data?.detail === "Usuario no encontrado")
    ) {
      await forceLogout();
      return Promise.reject(error);
    }

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
    
    // Si el error es 401 (Unauthorized)
    if (error.response && error.response.status === 401) {
      // Si ya se intentó refrescar y volvió a fallar con 401, la sesión es inválida
      if (originalRequest?._retry) {
        await forceLogout();
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No hay refresh token, forzamos cierre de sesión lógico
          await forceLogout();
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
        // Si el refresh falló (expiró, usuario eliminado, etc.), limpiamos sesión completa
        await forceLogout();
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
  getBanks: async () => {
    const { data } = await apiClient.get('/config/banks');
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
