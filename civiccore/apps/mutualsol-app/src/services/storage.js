import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';

// expo-secure-store es la forma oficial y más segura de guardar tokens en Expo
export const saveToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
