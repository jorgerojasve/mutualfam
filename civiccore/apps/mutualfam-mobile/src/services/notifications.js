import * as Device from 'expo-device';
import { isRunningInExpoGo } from 'expo';
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

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData?.data;

    if (token) {
      await client.post('/membership/push-token', { token });
      console.log('✅ [Notifications] Push token registrado en backend:', token);
    }
    return token;
  } catch (error) {
    console.warn('⚠️ [Notifications] Error registrando push token:', error?.message || error);
    return null;
  }
}
