/**
 * Utilidades para manejo seguro de fechas locales en calendarios y selectores.
 * Evita desfasajes de un día causados por conversiones a UTC (como .toISOString()).
 */

/**
 * Formatea un objeto Date a formato 'YYYY-MM-DD' según la zona horaria local.
 * @param {Date|string|number} date
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const formatLocalDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Parsea un string 'YYYY-MM-DD' a un objeto Date local al mediodía (12:00:00).
 * Fijar las 12:00 evita desbordes de fecha por zonas horarias o cambios de hora.
 * @param {string} dateStr
 * @returns {Date}
 */
export const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const clean = String(dateStr).split('T')[0].replace(/\//g, '-').trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }
  return new Date();
};

/**
 * Formatea una hora en formato 'HH:MM' (24 horas) a formato 'hh:mm AM/PM'.
 * Soporta entradas como '14:00', '12:00', '08:30', o cadenas que ya contengan AM/PM.
 * @param {string} timeStr
 * @returns {string} Hora en formato 'hh:mm AM/PM' (ej. '02:00 PM', '09:30 AM')
 */
export const formatTimeAMPM = (timeStr) => {
  if (!timeStr) return '';
  const clean = String(timeStr).trim();
  if (/am|pm/i.test(clean)) {
    return clean.toUpperCase();
  }
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (isNaN(hours)) return clean;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};
