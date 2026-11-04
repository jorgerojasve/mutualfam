import { Linking, Alert } from 'react-native';

/**
 * Extrae un mensaje de error legible y seguro para mostrar en Alert.alert.
 * Maneja cadenas simples, errores estándar de axios y respuestas de FastAPI (incluyendo arrays de validación 422).
 */
export function getErrorMessage(error, defaultMessage = 'Ha ocurrido un error inesperado') {
  if (!error) return defaultMessage;

  // 1. Errores de red o conectividad (Axios sin respuesta, timeout, etc.)
  if (isNetworkError(error)) {
    if (error.code === 'ECONNABORTED' || (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'))) {
      return 'Tiempo de espera agotado al conectar con el servidor. Por favor verifica tu conexión o reintenta en unos segundos.';
    }
    return 'No se pudo conectar con el servidor. Por favor verifica tu conexión a internet o reintenta si el servicio se está iniciando.';
  }

  // 2. Extraer 'detail' estándar de FastAPI
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
    return detail.message || detail.msg || detail.detail || JSON.stringify(detail);
  }

  // 3. Extraer 'message' o 'error' de respuestas de API alternativas
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  } else if (typeof data === 'string' && data.trim() && data.length < 200 && !data.includes('<html')) {
    return data.trim();
  }

  // 4. Diagnóstico por código de estado HTTP
  if (error.response?.status) {
    const s = error.response.status;
    if (s === 401) return 'Tu sesión ha expirado o no es válida. Por favor vuelve a iniciar sesión.';
    if (s === 403) return 'No tienes autorización para realizar esta acción o se alcanzó un límite.';
    if (s === 404) return 'El recurso solicitado no fue encontrado o ya no está disponible.';
    if (s === 422) return 'Los datos ingresados no tienen el formato esperado. Por favor revísalos.';
    if (s === 502 || s === 503 || s === 504) {
      return `El servidor se está iniciando o no está disponible temporalmente (Error ${s}). Intenta de nuevo en unos instantes.`;
    }
    if (s >= 500) return 'Error interno del servidor. Por favor intenta más tarde.';
  }

  // 5. Fallback a error.message (evitando el texto crudo en inglés "Network Error")
  if (error.message && typeof error.message === 'string') {
    if (error.message.toLowerCase() === 'network error') {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
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

/**
 * Determina si el error corresponde a una falla de red, falta de conexión o timeout.
 */
export function isNetworkError(error) {
  if (!error) return false;
  // Axios: petición realizada pero no se recibió respuesta
  if (!error.response && error.request) return true;
  // Códigos de error estándar de red
  if (
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'ETIMEDOUT'
  ) {
    return true;
  }
  // Mensajes de texto comunes de errores de conectividad
  if (typeof error.message === 'string') {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('network error') ||
      msg.includes('failed to fetch') ||
      msg.includes('network request failed') ||
      msg.includes('timeout') ||
      msg.includes('sin conexión') ||
      msg.includes('connection refused')
    ) {
      return true;
    }
  }
  return false;
}
