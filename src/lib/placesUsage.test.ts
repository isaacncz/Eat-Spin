import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBrokenStorage, createMemoryStorage, stubWindowStorage } from '@/test/memoryStorage';

// Firebase must never be reached from these tests. A null database is what the app
// sees when the VITE_FIREBASE_* variables are missing, which selects the localStorage
// fallback. Mocking it here also keeps a developer's local .env from changing the path.
vi.mock('@/lib/firebase', () => ({
  firebaseDb: null,
  ensureAnonymousAuthUser: vi.fn(),
}));

vi.mock('firebase/database', () => ({
  onValue: vi.fn(),
  ref: vi.fn(),
  runTransaction: vi.fn(),
}));

type PlacesUsageModule = typeof import('@/lib/placesUsage');

/** The thresholds are read from env once at import time, so re-import with the env under test. */
const loadPlacesUsage = async (cap: string, percent: string): Promise<PlacesUsageModule> => {
  vi.resetModules();
  vi.stubEnv('VITE_PLACES_MONTHLY_CAP', cap);
  vi.stubEnv('VITE_PLACES_BLOCK_AT_PERCENT', percent);
  return import('@/lib/placesUsage');
};

const readUsage = (mod: PlacesUsageModule) => {
  let latest: Parameters<Parameters<PlacesUsageModule['subscribePlacesUsage']>[0]>[0] | undefined;
  const unsubscribe = mod.subscribePlacesUsage((snapshot) => {
    latest = snapshot;
  });
  unsubscribe();
  if (!latest) throw new Error('subscribePlacesUsage did not report a snapshot');
  return latest;
};

beforeEach(() => {
  stubWindowStorage(createMemoryStorage());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('PLACES_BLOCK_THRESHOLD', () => {
  it('defaults to 90% of a 1000 call cap when the env is unset or empty', async () => {
    const mod = await loadPlacesUsage('', '');
    expect(mod.PLACES_MONTHLY_CAP).toBe(1000);
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(900);
  });

  it('applies the configured cap and percentage', async () => {
    const mod = await loadPlacesUsage('200', '80');
    expect(mod.PLACES_MONTHLY_CAP).toBe(200);
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(160);
  });

  it('rounds down fractional thresholds', async () => {
    const mod = await loadPlacesUsage('10', '33');
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(3);
  });

  it('caps the percentage at 100', async () => {
    const mod = await loadPlacesUsage('10', '250');
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(10);
  });

  it.each(['abc', '0', '-5'])('ignores an invalid value %j and uses the defaults', async (bad) => {
    const mod = await loadPlacesUsage(bad, bad);
    expect(mod.PLACES_MONTHLY_CAP).toBe(1000);
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(900);
  });
});

describe('reservePlacesCall (localStorage fallback)', () => {
  it('increments the counter once per reserved call', async () => {
    const mod = await loadPlacesUsage('10', '50');

    expect(readUsage(mod).used).toEqual({ nearby: 0, text: 0 });

    await mod.reservePlacesCall('nearby');
    await mod.reservePlacesCall('nearby');
    await mod.reservePlacesCall('nearby');

    const snapshot = readUsage(mod);
    expect(snapshot.used).toEqual({ nearby: 3, text: 0 });
    expect(snapshot.blocked).toEqual({ nearby: false, text: false });
  });

  it('does not touch Firebase', async () => {
    const mod = await loadPlacesUsage('10', '50');
    const firebase = await import('@/lib/firebase');
    const database = await import('firebase/database');

    await mod.reservePlacesCall('text');

    expect(firebase.ensureAnonymousAuthUser).not.toHaveBeenCalled();
    expect(database.runTransaction).not.toHaveBeenCalled();
  });

  it('allows exactly PLACES_BLOCK_THRESHOLD calls, then throws PlacesBudgetError', async () => {
    const mod = await loadPlacesUsage('10', '50');
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(5);

    for (let i = 0; i < mod.PLACES_BLOCK_THRESHOLD; i += 1) {
      await expect(mod.reservePlacesCall('nearby')).resolves.toBeUndefined();
    }

    const refused = mod.reservePlacesCall('nearby');
    await expect(refused).rejects.toBeInstanceOf(mod.PlacesBudgetError);
    await expect(refused).rejects.toMatchObject({ name: 'PlacesBudgetError' });
  });

  it('does not count a refused call and reports the kind as blocked', async () => {
    const mod = await loadPlacesUsage('10', '50');
    for (let i = 0; i < mod.PLACES_BLOCK_THRESHOLD; i += 1) await mod.reservePlacesCall('nearby');

    await expect(mod.reservePlacesCall('nearby')).rejects.toBeInstanceOf(mod.PlacesBudgetError);
    await expect(mod.reservePlacesCall('nearby')).rejects.toBeInstanceOf(mod.PlacesBudgetError);

    const snapshot = readUsage(mod);
    expect(snapshot.used.nearby).toBe(mod.PLACES_BLOCK_THRESHOLD);
    expect(snapshot.blocked.nearby).toBe(true);
  });

  it('counts each SKU kind separately', async () => {
    const mod = await loadPlacesUsage('10', '50');
    for (let i = 0; i < mod.PLACES_BLOCK_THRESHOLD; i += 1) await mod.reservePlacesCall('nearby');

    await expect(mod.reservePlacesCall('nearby')).rejects.toBeInstanceOf(mod.PlacesBudgetError);
    await expect(mod.reservePlacesCall('text')).resolves.toBeUndefined();

    const snapshot = readUsage(mod);
    expect(snapshot.used).toEqual({ nearby: mod.PLACES_BLOCK_THRESHOLD, text: 1 });
    expect(snapshot.blocked).toEqual({ nearby: true, text: false });
  });

  it('enforces the default 900 call threshold', async () => {
    const mod = await loadPlacesUsage('', '');
    expect(mod.PLACES_BLOCK_THRESHOLD).toBe(900);

    for (let i = 0; i < 900; i += 1) await mod.reservePlacesCall('text');
    await expect(mod.reservePlacesCall('text')).rejects.toBeInstanceOf(mod.PlacesBudgetError);
  });

  it('keeps counting across page loads (module reloads) because the counter is stored', async () => {
    const first = await loadPlacesUsage('10', '50');
    await first.reservePlacesCall('nearby');
    await first.reservePlacesCall('nearby');

    const afterReload = await loadPlacesUsage('10', '50');
    expect(readUsage(afterReload).used.nearby).toBe(2);

    for (let i = 0; i < 3; i += 1) await afterReload.reservePlacesCall('nearby');
    await expect(afterReload.reservePlacesCall('nearby')).rejects.toBeInstanceOf(afterReload.PlacesBudgetError);
  });

  it('starts a fresh counter in a new UTC month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T23:59:30Z'));
    const mod = await loadPlacesUsage('10', '50');

    for (let i = 0; i < mod.PLACES_BLOCK_THRESHOLD; i += 1) await mod.reservePlacesCall('nearby');
    await expect(mod.reservePlacesCall('nearby')).rejects.toBeInstanceOf(mod.PlacesBudgetError);

    vi.setSystemTime(new Date('2026-11-01T00:00:30Z'));
    expect(readUsage(mod).used.nearby).toBe(0);
    await expect(mod.reservePlacesCall('nearby')).resolves.toBeUndefined();
    expect(readUsage(mod).used.nearby).toBe(1);
  });

  it('treats a non-numeric stored counter as zero', async () => {
    const mod = await loadPlacesUsage('10', '50');
    window.localStorage.setItem(`eatspin:places-usage:${mod.getUsageMonthKey()}:nearby`, 'not-a-number');

    await expect(mod.reservePlacesCall('nearby')).resolves.toBeUndefined();
    expect(readUsage(mod).used.nearby).toBe(1);
  });

  it('lets the call through when storage cannot be read (the Cloud Console quota still applies)', async () => {
    const mod = await loadPlacesUsage('10', '50');
    stubWindowStorage(createBrokenStorage({ read: true }));

    for (let i = 0; i < 20; i += 1) {
      await expect(mod.reservePlacesCall('nearby')).resolves.toBeUndefined();
    }
  });

  it('lets the call through when storage cannot be written', async () => {
    const mod = await loadPlacesUsage('10', '50');
    stubWindowStorage(createBrokenStorage({ write: true }));

    await expect(mod.reservePlacesCall('nearby')).resolves.toBeUndefined();
  });
});

describe('getUsageMonthKey', () => {
  it('uses the UTC year and month, zero padded', async () => {
    const mod = await loadPlacesUsage('10', '50');
    expect(mod.getUsageMonthKey(new Date('2026-02-01T00:30:00Z'))).toBe('2026-02');
    expect(mod.getUsageMonthKey(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
  });
});

describe('subscribePlacesUsage (localStorage fallback)', () => {
  it('reports an empty, unblocked snapshot with no stored usage', async () => {
    const mod = await loadPlacesUsage('10', '50');
    expect(readUsage(mod)).toEqual({
      used: { nearby: 0, text: 0 },
      blocked: { nearby: false, text: false },
    });
  });

  it('returns an unsubscribe function that is safe to call', async () => {
    const mod = await loadPlacesUsage('10', '50');
    const unsubscribe = mod.subscribePlacesUsage(() => {});
    expect(() => unsubscribe()).not.toThrow();
  });

  it('reports zero usage when storage cannot be read', async () => {
    const mod = await loadPlacesUsage('10', '50');
    stubWindowStorage(createBrokenStorage({ read: true }));
    expect(readUsage(mod).used).toEqual({ nearby: 0, text: 0 });
  });
});
