import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cleanups: [] as (() => void)[],
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.states.length;
    harness.states.push(typeof initial === 'function' ? (initial as () => unknown)() : initial);
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === 'function'
        ? (next as (previous: unknown) => unknown)(harness.states[index]) : next;
    }];
  },
  useRef: (value: unknown) => ({ current: value }),
  useCallback: (callback: unknown) => callback,
  useMemo: (callback: () => unknown) => callback(),
  useEffect: (callback: () => (() => void) | void) => {
    const cleanup = callback();
    if (cleanup) harness.cleanups.push(cleanup);
  },
}));
vi.mock('@/lib/googlePlacesTextSearch', () => ({ searchPlacesByText: vi.fn() }));
vi.mock('@/lib/googlePlacesRestaurants', () => ({
  fetchNearbyGoogleRestaurants: vi.fn(),
  rankNearbyRestaurants: (restaurants: unknown) => restaurants,
}));
vi.mock('@/lib/categoryClassifier', () => ({ enrichRestaurantListCategories: (restaurants: unknown) => restaurants }));
vi.mock('@/lib/nearbyCache', () => ({
  getCachedNearbyRestaurants: vi.fn().mockResolvedValue(null),
  runNearbyCacheCleanup: vi.fn().mockResolvedValue(undefined),
  saveNearbyRestaurantsSnapshot: vi.fn(),
}));
import { searchPlacesByText } from '@/lib/googlePlacesTextSearch';
import { fetchNearbyGoogleRestaurants } from '@/lib/googlePlacesRestaurants';
import { saveNearbyRestaurantsSnapshot } from '@/lib/nearbyCache';
import { useTextSearch } from './useTextSearch';
import { useNearbyRestaurants } from './useNearbyRestaurants';

beforeEach(() => {
  vi.useFakeTimers();
  harness.states = [];
  harness.cleanups = [];
  vi.stubGlobal('window', { setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem: () => {} } });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
});
afterEach(() => {
  harness.cleanups.forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('search cancellation', () => {
  it('clearing before debounce prevents a billable request', async () => {
    const hook = useTextSearch({ location: { lat: 5.4, lng: 100.3 } });
    hook.search('rice');
    hook.clearResults();
    await vi.advanceTimersByTimeAsync(500);
    expect(searchPlacesByText).not.toHaveBeenCalled();
    expect(harness.states[2]).toBe(false);
  });
  it('empty query aborts an active request and ignores its response', async () => {
    let finish!: (value: never[]) => void;
    vi.mocked(searchPlacesByText).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const hook = useTextSearch({ location: { lat: 5.4, lng: 100.3 } });
    hook.search('rice');
    await vi.advanceTimersByTimeAsync(400);
    const signal = vi.mocked(searchPlacesByText).mock.calls[0][0].signal!;
    hook.search('');
    expect(signal.aborted).toBe(true);
    finish([]);
    await Promise.resolve();
    expect(harness.states[1]).toEqual([]);
    expect(harness.states[2]).toBe(false);
  });
});

it('keeps live nearby results when IndexedDB rejects the cache write', async () => {
  const results = [{ id: 'one' }] as unknown as Awaited<ReturnType<typeof fetchNearbyGoogleRestaurants>>;
  vi.mocked(fetchNearbyGoogleRestaurants).mockResolvedValueOnce(results);
  vi.mocked(saveNearbyRestaurantsSnapshot).mockRejectedValueOnce(new Error('quota exceeded'));
  useNearbyRestaurants({ enabled: true, location: { lat: 5.4, lng: 100.3 }, radiusKm: 4.3 });
  await vi.advanceTimersByTimeAsync(500);
  expect(harness.states[0]).toEqual(results);
  expect(harness.states[2]).toBeNull();
  expect(harness.states[3]).toBe('google-live');
  expect(harness.states[5]).toBe(false);
});
