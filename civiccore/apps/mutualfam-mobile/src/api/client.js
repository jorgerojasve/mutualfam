import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// In Expo, EXPO_PUBLIC_ variables are automatically injected
const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8002/api/v1';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'X-Organization-ID': '1', // Hardcoded MVP para familia 1
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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
  updatePaymentMethods: async (paymentMethodsJson) => {
    const { data } = await apiClient.post('/config/payment_methods', { payment_methods_json: paymentMethodsJson });
    return data;
  },
  contributeToLoan: async (loanId, amount_usd) => {
    const { data } = await apiClient.post(`/loans/${loanId}/contribute`, { amount_usd });
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
  repayLoan: async (loanId) => {
    const { data } = await apiClient.post(`/loans/${loanId}/repay`);
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
  }
};

export default apiClient;
