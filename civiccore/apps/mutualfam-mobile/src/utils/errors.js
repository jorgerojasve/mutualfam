import { Linking, Alert } from 'react-native';

/**
 * Extrae un mensaje de error legible y seguro para mostrar en Alert.alert.
 * Maneja cadenas simples, errores estándar de axios y respuestas de FastAPI (incluyendo arrays de validación 422).
 */
export function getErrorMessage(error, defaultMessage = 'Ha ocurrido un error inesperado') {
  if (!error) return defaultMessage;

  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === 'string' ? item : item?.msg || JSON.stringify(item)))
      .join('\n');
  }
  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }
  return defaultMessage;
}

/**
 * Determina si el error devuelto por la API corresponde a una restricción de límites (mutuales o miembros).
 */
export function isLimitError(error) {
  const detail = error?.response?.data?.detail;
  return Boolean(
    detail &&
    typeof detail === 'object' &&
    (detail.code === 'LIMIT_MUTUALS' || detail.code === 'LIMIT_MEMBERS')
  );
}

/**
 * Muestra un diálogo interactivo al usuario cuando se excede un límite del sistema,
 * ofreciendo un botón para contactar al equipo de desarrollo por email con asunto y cuerpo prellenados.
 * Retorna true si el error fue procesado como un límite, o false en caso contrario.
 */
export function handleLimitError(error, fallbackTitle = 'Límite alcanzado', userContext = {}) {
  const detail = error?.response?.data?.detail;
  if (!detail || typeof detail !== 'object' || !detail.code) {
    return false;
  }

  const { code, message, contact_email } = detail;
  if (code !== 'LIMIT_MUTUALS' && code !== 'LIMIT_MEMBERS') {
    return false;
  }

  const email = contact_email || 'mutualfam@gmail.com';
  const isMutualLimit = code === 'LIMIT_MUTUALS';

  const subject = isMutualLimit
    ? 'Solicitud de asistencia: Crear nueva mutual / Entorno propio'
    : 'Solicitud de asistencia: Límite de miembros en mutual';

  const body = isMutualLimit
    ? `Hola equipo de desarrollo,\n\nHe alcanzado el límite de creación de mutuales y me gustaría solicitar asistencia técnica para configurar nuestro propio entorno independiente:\n- Despliegue de backend propio\n- Configuración de bot de Telegram independiente\n- Repositorio propio\n\nUsuario: ${userContext.email || ''}\n\nQuedo a la espera de su respuesta. ¡Muchas gracias!`
    : `Hola equipo de desarrollo,\n\nNuestra mutual ha alcanzado la capacidad máxima de miembros permitida en esta instancia. Nos gustaría recibir asistencia técnica para evaluar una ampliación o la migración a un entorno propio (backend, bot y repositorio).\n\nMutual: ${userContext.mutualName || ''}\nUsuario: ${userContext.email || ''}\n\nQuedo a la espera de su respuesta. ¡Muchas gracias!`;

  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  Alert.alert(
    fallbackTitle || (isMutualLimit ? 'Límite de Creación' : 'Capacidad Máxima Alcanzada'),
    message || 'Se ha alcanzado un límite establecido en la plataforma.',
    [
      { text: 'Cerrar', style: 'cancel' },
      {
        text: 'Contactar por Email',
        onPress: () => {
          Linking.openURL(mailtoUrl).catch(() => {
            Alert.alert('Contacto', `Por favor envía un correo directamente a: ${email}`);
          });
        }
      }
    ]
  );

  return true;
}

