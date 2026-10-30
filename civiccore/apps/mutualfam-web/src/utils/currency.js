/**
 * Utilidades para manejo, parseo y formateo de montos en moneda bajo el estándar de Venezuela.
 * En Venezuela:
 * - Separador de miles: punto (.)
 * - Separador decimal: coma (,)
 * Ejemplos: "1.250,50" o "50,00"
 */

export function parseVEAmount(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      const clean = str.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    } else {
      const clean = str.replace(/,/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    }
  }

  if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2) {
      const clean = str.replace(/,/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    }
    const clean = str.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  }

  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2) {
      const clean = str.replace(/\./g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    }
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

export function formatVE(num, decimals = 2) {
  if (num === null || num === undefined || num === '') return '0,00';
  const n = typeof num === 'number' ? num : parseFloat(num);
  if (isNaN(n)) return '0,00';

  const fixed = n.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${withThousands},${decPart}` : withThousands;
}

export function formatCurrencyVE(num, currency = 'USD', decimals = 2) {
  const formatted = formatVE(num, decimals);
  if (currency === 'USD' || currency === '$') {
    return `$ ${formatted}`;
  }
  return `Bs. ${formatted}`;
}
