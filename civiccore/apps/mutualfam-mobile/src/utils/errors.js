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
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  if (error.message && typeof error.message === 'string') {
    return error.message;
  }
  return defaultMessage;
}
