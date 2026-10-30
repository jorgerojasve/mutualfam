/**
 * Utilidades para manejo, parseo y formateo de montos en moneda bajo el estándar de Venezuela.
 * En Venezuela:
 * - Separador de miles: punto (.)
 * - Separador decimal: coma (,)
 * Ejemplos: "1.250,50" o "50,00"
 */

/**
 * Parsea un texto ingresado por el usuario a número de punto flotante.
 * Tolera tanto comas como puntos decimales para ser compatible con cualquier teclado virtual.
 *
 * @param {string|number} val 
 * @returns {number|null}
 */
export function parseVEAmount(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

  // Si contiene tanto punto como coma: determinamos cuál es el separador decimal por posición
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Formato VE: 1.250,50 -> eliminar puntos de miles y sustituir coma por punto
      const clean = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    } else {
      // Formato US: 1,250.50 -> eliminar comas y parsear
      const clean = str.replace(/,/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    }
  }

  // Si solo contiene comas (ej: "50,50" o "1250,5")
  if (str.includes(',')) {
    // Si hay múltiples comas, asumimos miles con coma y la última decimal, o simplemente limpiamos
    const parts = str.split(',');
    if (parts.length > 2) {
      // Múltiples comas: e.g. 1,250,000 -> 1250000
      const clean = str.replace(/,/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    }
    const clean = str.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  }

  // Si solo contiene puntos
  if (str.includes('.')) {
    const parts = str.split('.');
    // Si tiene múltiples puntos: 1.250.000 -> miles
    if (parts.length > 2) {
      const clean = str.replace(/\./g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    }
    // Si tiene un solo punto:
    // En teclados virtuales de teléfonos en inglés, el usuario tipea "." para indicar decimal (ej: "50.5" o "100.25")
    // Lo interpretamos directamente como decimal estándar
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  // Número entero directo (ej: "50", "1000")
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Formatea un número flotante al estándar venezolano:
 * Miles con punto (.) y decimales con coma (,).
 *
 * @param {number|string} num 
 * @param {number} decimals Cantidad de decimales (por defecto 2)
 * @returns {string} Ej: "1.250,50"
 */
export function formatVE(num, decimals = 2) {
  if (num === null || num === undefined || num === '') return '0,00';
  const n = typeof num === 'number' ? num : parseFloat(num);
  if (isNaN(n)) return '0,00';

  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${withThousands},${decPart}` : withThousands;
}

/**
 * Formatea agregando símbolo de moneda.
 * @param {number|string} num 
 * @param {'USD'|'VES'|'Bs.'|'$'} currency 
 * @param {number} decimals 
 * @returns {string} Ej: "$ 50,00" o "Bs. 2.710,00"
 */
export function formatCurrencyVE(num, currency = 'USD', decimals = 2) {
  const formatted = formatVE(num, decimals);
  if (currency === 'USD' || currency === '$') {
    return `$ ${formatted}`;
  }
  return `Bs. ${formatted}`;
}
