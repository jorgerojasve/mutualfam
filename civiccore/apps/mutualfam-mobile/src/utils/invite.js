import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Debe coincidir con INVITE_CODE_ALPHABET del backend (sin 0/O, 1/I/L).
const SHORT_CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;
// Tokens antiguos generados con secrets.token_urlsafe(16).
const LEGACY_TOKEN_REGEX = /^[A-Za-z0-9_-]{16,64}$/;
// Solo confiamos en el portapapeles si contiene nuestro enlace de invitación,
// para no confundir cualquier palabra copiada con un código.
const INVITE_LINK_REGEX = /(invite\?token=|mutualfam:\/\/join\/)([A-Za-z0-9_-]+)/;
// Código suelto con el formato exacto que muestra el Landing ("K7P3-QX9M").
const FORMATTED_CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

const DISMISSED_KEY = 'clipboard_invite_dismissed';

/**
 * Extrae el código de invitación de lo que el usuario escriba o pegue:
 * "K7P3-QX9M", "k7p3 qx9m", el enlace completo de WhatsApp o un token antiguo.
 * Devuelve null si no parece una invitación válida.
 */
export function extractInviteCode(rawText) {
  if (!rawText) return null;
  let candidate = String(rawText).trim();

  const linkMatch = candidate.match(INVITE_LINK_REGEX);
  if (linkMatch) {
    candidate = linkMatch[2];
  }

  const compact = candidate.replace(/[\s-]/g, '').toUpperCase();
  if (SHORT_CODE_REGEX.test(compact)) return compact;
  if (LEGACY_TOKEN_REGEX.test(candidate)) return candidate;
  return null;
}

/** "K7P3QX9M" -> "K7P3-QX9M" (los tokens antiguos se devuelven tal cual). */
export function formatInviteCode(code) {
  if (code && SHORT_CODE_REGEX.test(code)) {
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }
  return code || '';
}

/**
 * Busca un enlace de invitación en el portapapeles (copiado por el Landing Page
 * o desde el mensaje de WhatsApp). Ignora códigos que el usuario ya descartó.
 */
export async function getInviteFromClipboard({ includeDismissed = false } = {}) {
  try {
    // hasStringAsync no dispara el aviso de "pegado desde portapapeles" en Android 12+
    const hasString = await Clipboard.hasStringAsync();
    if (!hasString) return null;

    const text = await Clipboard.getStringAsync();
    if (!text) return null;
    const trimmed = text.trim();
    if (!INVITE_LINK_REGEX.test(trimmed) && !FORMATTED_CODE_REGEX.test(trimmed)) return null;

    const code = extractInviteCode(trimmed);
    if (!code) return null;

    if (!includeDismissed) {
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (dismissed === code) return null;
    }
    return code;
  } catch (e) {
    console.warn('No se pudo leer el portapapeles', e);
    return null;
  }
}

/** Lee el portapapeles sin filtrar por enlace (para el botón "Pegar"). */
export async function pasteInviteFromClipboard() {
  try {
    const text = await Clipboard.getStringAsync();
    return { text: text || '', code: extractInviteCode(text) };
  } catch (e) {
    return { text: '', code: null };
  }
}

export async function dismissClipboardInvite(code) {
  if (code) await AsyncStorage.setItem(DISMISSED_KEY, code);
}
