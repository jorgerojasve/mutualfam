import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';
const BIO_TOKEN_KEY = 'biometric_token';

// expo-secure-store es la forma oficial y más segura de guardar tokens en Expo
export const saveToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export const saveBiometricToken = (token) => SecureStore.setItemAsync(BIO_TOKEN_KEY, token);
export const getBiometricToken = () => SecureStore.getItemAsync(BIO_TOKEN_KEY);
export const removeBiometricToken = () => SecureStore.deleteItemAsync(BIO_TOKEN_KEY);
