import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

let NotificationsModule = null;

function getNotificationsModule() {
  // En Expo Go (Android), los módulos nativos de FCM fueron retirados por Expo en SDK 53+.
  // Evitamos cargar la librería nativa para no buscar módulos inexistentes en Expo Go.
  if (isRunningInExpoGo()) {
    return null;
  }

  if (!NotificationsModule) {
    try {
      NotificationsModule = require('expo-notifications');
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (error) {
      console.warn('⚠️ [Notifications] No se pudo inicializar expo-notifications:', error?.message || error);
      return null;
    }
  }

  return NotificationsModule;
}

/**
 * Configura los canales de notificación en Android (requerido para Android 8.0+ / API 26+).
 */
async function setupAndroidNotificationChannel(Notifications) {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificaciones Mutual Familiar',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
      });
    } catch (channelError) {
      console.warn('⚠️ [Notifications] Error configurando canal de notificación:', channelError?.message || channelError);
    }
  }
}

/**
 * Registra el dispositivo ante el servicio de push de Expo y envía el token a la API.
 * Nota: En Expo Go (Android), los módulos nativos de FCM fueron eliminados desde SDK 53.
 * La carga es diferida (lazy require), por lo que en Expo Go nunca se intenta cargar
 * la librería nativa ni genera errores. En APK / Development Build funcionará al 100%.
 */
export async function registerForPushNotificationsAsync() {
  if (isRunningInExpoGo()) {
    console.log(
      'ℹ️ [Notifications] Notificaciones remotas no están disponibles en Expo Go en Android (eliminadas desde SDK 53). Estarán activas al compilar el APK.'
    );
    return null;
  }

  const Notifications = getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  if (!Device.isDevice) {
    console.log('ℹ️ [Notifications] Se requiere un dispositivo físico para recibir notificaciones push.');
    return null;
  }

  try {
    // Configurar canal en Android antes de solicitar token o mostrar notificaciones
    await setupAndroidNotificationChannel(Notifications);

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('ℹ️ [Notifications] Permiso de notificaciones no otorgado por el usuario.');
      return null;
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '4dacbcd7-b02a-4f4a-ba89-1800624a2f88';

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;

    if (token) {
      await client.post('/membership/push-token', { token });
      await AsyncStorage.setItem('push_token', token);
      console.log('✅ [Notifications] Push token registrado en backend:', token);
    }
    return token;
  } catch (error) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.includes('Firebase') || errorMsg.includes('googleServicesFile') || errorMsg.includes('Default FirebaseApp')) {
      console.warn(
        '⚠️ [Notifications] Para recibir notificaciones en APK de producción/QA en Android se requiere configurar Firebase (google-services.json).'
      );
    } else {
      console.warn('⚠️ [Notifications] Error registrando push token:', errorMsg);
    }
    return null;
  }
}

/**
 * Desregistra el token del backend al cerrar sesión.
 */
export async function unregisterPushNotificationsAsync() {
  try {
    const token = await AsyncStorage.getItem('push_token');
    if (token) {
      await client.delete(`/membership/push-token?token=${encodeURIComponent(token)}`);
      await AsyncStorage.removeItem('push_token');
      console.log('ℹ️ [Notifications] Push token desregistrado del backend');
    }
  } catch (error) {
    console.warn('⚠️ [Notifications] Error desregistrando push token:', error?.message || error);
  }
}

