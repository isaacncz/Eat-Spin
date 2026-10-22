import { onValue, ref, runTransaction } from 'firebase/database';

import { ensureAnonymousAuthUser, firebaseDb } from '@/lib/firebase';

/**
 * Google Places usage guard.
 *
 * Every billable Google call must first `reserve()` a slot. Slots are counted
 * per calendar month (UTC) and per SKU kind in Firebase RTDB, so the budget is
 * shared across all users. When the count reaches the block threshold, new
 * calls are refused and the UI disables auto-mode spinning.
 *
 * This is a soft guard: a modified client can still call Google directly with
 * the public key. Keep a hard per-API quota in Google Cloud Console as backstop.
 */

export type PlacesUsageKind = 'nearby' | 'text';

export const PLACES_USAGE_KINDS: PlacesUsageKind[] = ['nearby', 'text'];

const DEFAULT_MONTHLY_CAP = 1000;
const DEFAULT_BLOCK_AT_PERCENT = 90;
const localUsageListeners = new Set<() => void>();
const LOCAL_KEY_PREFIX = 'eatspin:places-usage:';

const readNumberEnv = (value: unknown, fallback: number): number => {
  const parsed = Number(typeof value === 'string' ? value.trim() : NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Free monthly calls per SKU that the field mask is billed under. */
export const PLACES_MONTHLY_CAP = readNumberEnv(
  import.meta.env.VITE_PLACES_MONTHLY_CAP,
  DEFAULT_MONTHLY_CAP,
);

const blockAtPercent = Math.min(
  100,
  readNumberEnv(import.meta.env.VITE_PLACES_BLOCK_AT_PERCENT, DEFAULT_BLOCK_AT_PERCENT),
);

/** Calls are refused once the counter reaches this number. */
export const PLACES_BLOCK_THRESHOLD = Math.floor((PLACES_MONTHLY_CAP * blockAtPercent) / 100);

export class PlacesBudgetError extends Error {
  constructor() {
    super('Monthly nearby-search budget reached. Use My List until next month.');
    this.name = 'PlacesBudgetError';
  }
}

export const getUsageMonthKey = (date = new Date()): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const usagePath = (kind: PlacesUsageKind, month = getUsageMonthKey()) =>
  `usage/places/${month}/${kind}`;

// Fallback when Firebase is not configured: per-browser counter only.
const reserveLocally = (kind: PlacesUsageKind): void => {
  const key = `${LOCAL_KEY_PREFIX}${getUsageMonthKey()}:${kind}`;
  let current = 0;
  try {
    current = Number(window.localStorage.getItem(key)) || 0;
  } catch {
    // Storage unavailable: allow the call; the Cloud Console quota still applies.
    return;
  }
  if (current >= PLACES_BLOCK_THRESHOLD) throw new PlacesBudgetError();
  try {
    window.localStorage.setItem(key, String(current + 1));
    localUsageListeners.forEach((notify) => notify());
  } catch {
    // Best effort.
  }
};

/**
 * Reserve one billable call. Throws PlacesBudgetError when the budget is used up.
 * Other errors (network, auth) propagate so the caller does not silently overspend.
 */
export async function reservePlacesCall(kind: PlacesUsageKind): Promise<void> {
  if (!firebaseDb) {
    reserveLocally(kind);
    return;
  }

  await ensureAnonymousAuthUser();
  const result = await runTransaction(ref(firebaseDb, usagePath(kind)), (current: number | null) => {
    const used = typeof current === 'number' ? current : 0;
    if (used >= PLACES_BLOCK_THRESHOLD) return undefined; // abort
    return used + 1;
  });

  if (!result.committed) throw new PlacesBudgetError();
}

export interface PlacesUsageSnapshot {
  used: Record<PlacesUsageKind, number>;
  blocked: Record<PlacesUsageKind, boolean>;
}

const emptySnapshot = (): PlacesUsageSnapshot => ({
  used: { nearby: 0, text: 0 },
  blocked: { nearby: false, text: false },
});

/** Live view of this month's counters for the UI. Returns an unsubscribe function. */
export function subscribePlacesUsage(onChange: (snapshot: PlacesUsageSnapshot) => void): () => void {
  let unsubscribes: Array<() => void> = [];
  let cancelled = false;
  let activeMonth = '';
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const refresh = () => {
    const month = getUsageMonthKey();
    if (cancelled || (firebaseDb && month === activeMonth)) return;
    activeMonth = month;
    const currentGeneration = ++generation;
    unsubscribes.forEach((off) => off());
    unsubscribes = [];
    const snapshot = emptySnapshot();
    onChange(snapshot);

    if (!firebaseDb) {
      for (const kind of PLACES_USAGE_KINDS) {
        try {
          snapshot.used[kind] = Number(window.localStorage.getItem(`${LOCAL_KEY_PREFIX}${month}:${kind}`)) || 0;
        } catch { snapshot.used[kind] = 0; }
        snapshot.blocked[kind] = snapshot.used[kind] >= PLACES_BLOCK_THRESHOLD;
      }
      onChange(snapshot);
      return;
    }
    void ensureAnonymousAuthUser().then(() => {
      if (cancelled || generation !== currentGeneration || !firebaseDb) return;
      unsubscribes = PLACES_USAGE_KINDS.map((kind) =>
        onValue(ref(firebaseDb!, usagePath(kind, month)), (value) => {
          if (cancelled || generation !== currentGeneration) return;
          const used = typeof value.val() === 'number' ? value.val() as number : 0;
          snapshot.used = { ...snapshot.used, [kind]: used };
          snapshot.blocked = { ...snapshot.blocked, [kind]: used >= PLACES_BLOCK_THRESHOLD };
          onChange({ used: { ...snapshot.used }, blocked: { ...snapshot.blocked } });
        }, () => {}),
      );
    }).catch(() => {
      // Retry authentication on resume instead of permanently pinning this month.
      if (generation === currentGeneration) activeMonth = '';
    });
  };

  const tick = () => {
    refresh();
    const now = new Date();
    const boundary = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    // Cap delays: browser timers cannot represent a whole month reliably.
    timer = setTimeout(tick, Math.min(60_000, Math.max(1, boundary - now.getTime())));
  };
  const resume = () => refresh();
  localUsageListeners.add(refresh);
  window.addEventListener?.('focus', resume);
  window.addEventListener?.('storage', resume);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', resume);
  tick();
  return () => {
    cancelled = true;
    generation += 1;
    if (timer !== undefined) clearTimeout(timer);
    localUsageListeners.delete(refresh);
    unsubscribes.forEach((off) => off());
    window.removeEventListener?.('focus', resume);
    window.removeEventListener?.('storage', resume);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume);
  };
}
