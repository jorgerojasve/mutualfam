import { Linking, Alert, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getCurrentAppVersion } from '../services/appUpdates';
import { getMobileEnvironmentConfig } from './env';

export const SUPPORT_EMAIL = 'mutualfam@gmail.com';

/**
 * Abre la aplicación de correo preferida del usuario con destinatario, asunto y cuerpo
 * prellenados con metadatos técnicos útiles para el diagnóstico en la fase Beta.
 * 
 * Si el dispositivo no tiene un cliente de correo configurado o falla al abrir la URL,
 * ofrece automáticamente copiar la dirección de soporte al portapapeles.
 * 
 * @param {Object} options
 * @param {string} options.subject - Asunto descriptivo del mensaje
 * @param {string} options.userEmail - Correo electrónico del usuario (opcional)
 * @param {string} options.orgName - Nombre de la mutual activa (opcional)
 * @param {string} options.contextNote - Contexto adicional o pantalla donde se originó (opcional)
 */
export async function openSupportEmail({
  subject = 'Consulta / Soporte Beta',
  userEmail = '',
  orgName = '',
  contextNote = '',
} = {}) {
  const version = getCurrentAppVersion();
  const envConfig = getMobileEnvironmentConfig();

  const formattedSubject = `[MutualFam Beta v${version}] ${subject}`;

  const bodyLines = [
    'Escribe aquí tu consulta, duda o reporte:',
    '[Describe lo que necesitas o el fallo que experimentaste...]',
    '',
    '--------------------------------------------------',
    'Información técnica de diagnóstico (Beta):',
    `- Aplicación: Mutual Familiar`,
    `- Versión instalada: v${version}`,
    `- Entorno: ${envConfig.label || 'Producción'}`,
    `- Dispositivo: ${Platform.OS.toUpperCase()} (v${Platform.Version})`,
  ];

  if (userEmail) {
    bodyLines.push(`- Usuario: ${userEmail}`);
  }
  if (orgName) {
    bodyLines.push(`- Mutual activa: ${orgName}`);
  }
  if (contextNote) {
    bodyLines.push(`- Pantalla/Contexto: ${contextNote}`);
  }

  bodyLines.push('--------------------------------------------------');

  const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(formattedSubject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;

  try {
    const supported = await Linking.canOpenURL(mailtoUrl);
    if (supported) {
      await Linking.openURL(mailtoUrl);
      return;
    }
  } catch (err) {
    // Si canOpenURL falla en algunas versiones de Android, intentamos abrir directamente
    try {
      await Linking.openURL(mailtoUrl);
      return;
    } catch (_) {}
  }

  // Fallback si no hay app de correo instalada o configurada
  showSupportEmailFallback();
}

/**
 * Diálogo de contingencia que muestra el correo oficial de soporte
 * y permite copiarlo con 1 toque al portapapeles.
 */
export function showSupportEmailFallback() {
  Alert.alert(
    'Contacto de Soporte',
    `Escríbenos directamente a nuestro correo oficial:\n\n${SUPPORT_EMAIL}\n\n¿Deseas copiar la dirección al portapapeles?`,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Copiar Correo',
        onPress: async () => {
          try {
            await Clipboard.setStringAsync(SUPPORT_EMAIL);
            Alert.alert('Copiado', 'Dirección mutualfam@gmail.com copiada al portapapeles.');
          } catch (_) {
            Alert.alert('Correo de Soporte', SUPPORT_EMAIL);
          }
        },
      },
    ]
  );
}
