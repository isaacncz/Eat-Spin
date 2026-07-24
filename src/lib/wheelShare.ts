/**
 * Backend-free wheel sharing.
 *
 * A manual wheel (its name + the restaurant names on it) is encoded into a
 * compact `?wheel=` URL parameter. Anyone who opens the link gets the exact
 * same wheel loaded into a manual list they can spin immediately — no Firebase,
 * no room, no sign-in. This is the lightweight counterpart to Group Spin rooms.
 */

export const WHEEL_SHARE_PARAM = 'wheel';

/** Guardrails so a shared link stays a reasonable URL length. */
export const MAX_SHARED_WHEEL_NAMES = 24;
const MAX_NAME_LENGTH = 48;
const MAX_LIST_NAME_LENGTH = 48;
const MAX_ENCODED_LENGTH = 2000;

export interface SharedWheel {
  name: string;
  names: string[];
}

/** Serialized payload shape kept intentionally short to save URL bytes. */
interface WheelPayload {
  /** list name */
  n: string;
  /** restaurant names */
  r: string[];
}

const toBase64Url = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const normalizeNames = (names: string[]): string[] => (
  names
    .map((name) => name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH))
    .filter(Boolean)
    .filter((name, index, list) => (
      list.findIndex((entry) => entry.toLowerCase() === name.toLowerCase()) === index
    ))
    .slice(0, MAX_SHARED_WHEEL_NAMES)
);

/**
 * Encode a wheel into the value of the `?wheel=` param. Returns null when there
 * is nothing meaningful to share (fewer than 2 places).
 */
export const encodeWheelPayload = (name: string, names: string[]): string | null => {
  const cleanNames = normalizeNames(names);
  if (cleanNames.length < 2) return null;

  const payload: WheelPayload = {
    n: name.trim().replace(/\s+/g, ' ').slice(0, MAX_LIST_NAME_LENGTH),
    r: cleanNames,
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  if (encoded.length > MAX_ENCODED_LENGTH) return null;
  return encoded;
};

/** Build a full shareable URL for the current origin. */
export const buildWheelShareUrl = (
  name: string,
  names: string[],
  origin?: string,
): string | null => {
  const encoded = encodeWheelPayload(name, names);
  if (!encoded) return null;

  const base = origin
    ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(base || 'https://eatspin.app');
  url.searchParams.set(WHEEL_SHARE_PARAM, encoded);
  return url.toString();
};

/** Decode a `?wheel=` param value back into a wheel. Returns null if invalid. */
export const decodeWheelParam = (param: string | null): SharedWheel | null => {
  if (!param) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(param)) as Partial<WheelPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.r)) return null;

    const names = normalizeNames(parsed.r.filter((entry): entry is string => typeof entry === 'string'));
    if (names.length < 2) return null;

    const rawName = typeof parsed.n === 'string' ? parsed.n.trim() : '';
    return {
      name: rawName.slice(0, MAX_LIST_NAME_LENGTH) || 'Shared wheel',
      names,
    };
  } catch {
    return null;
  }
};

/** Read and decode a shared wheel from the current browser URL, if present. */
export const parseSharedWheelFromLocation = (): SharedWheel | null => {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get(WHEEL_SHARE_PARAM);
  return decodeWheelParam(param);
};

/**
 * Remove the `?wheel=` param from the address bar without a reload, so that a
 * refresh (or re-parse) does not re-import the shared wheel.
 */
export const stripWheelParamFromUrl = (): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(WHEEL_SHARE_PARAM)) return;
  url.searchParams.delete(WHEEL_SHARE_PARAM);
  window.history.replaceState({}, '', url.toString());
};
