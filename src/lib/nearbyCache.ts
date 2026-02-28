import type { Restaurant } from '@/types';
import { calculateDistance } from '@/lib/restaurantUtils';

const DB_NAME = 'eatspin-nearby-cache';
const DB_VERSION = 1;
const SNAPSHOTS_STORE = 'snapshots';
const PLACES_STORE = 'places';
const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const GEOHASH_BITS = [16, 8, 4, 2, 1] as const;
const GEOHASH_PRECISION = 6;
const CACHE_SCHEMA_VERSION = 3;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_LAST_RUN_STORAGE_KEY = 'eatspin:nearby-cache-last-cleanup';
const RANK_STRATEGY = 'rating_desc_reviewCount_desc_distance_asc' as const;

type RankStrategy = typeof RANK_STRATEGY;

type NearbySnapshotRecord = {
  snapshotKey: string;
  areaGeohash: string;
  areaNeighborGeohashes: string[];
  centerLat: number;
  centerLng: number;
  areaRadiusKm: number;
  searchRadiusKm: number;
  openNowOnly: boolean;
  region: string;
  /** Sorted, comma-joined selected categories or '*' for discovery mode. */
  categoriesKey: string;
  placeIds: string[];
  restaurantCount: number;
  rankStrategy: RankStrategy;
  fetchedAt: number;
  expiresAt: number;
};

type NearbyPlaceRecord = {
  placeId: string;
  restaurant: Restaurant;
  updatedAt: number;
  expiresAt: number;
};

export interface NearbyCacheLookupOptions {
  location: { lat: number; lng: number };
  searchRadiusKm: number;
  openNowOnly: boolean;
  region: string;
  movementThresholdKm: number;
  /** Sorted, comma-joined selected categories or '*' for discovery mode. */
  categoriesKey?: string;
  nowMs?: number;
}

export interface NearbyCacheWriteOptions {
  location: { lat: number; lng: number };
  restaurants: Restaurant[];
  searchRadiusKm: number;
  openNowOnly: boolean;
  region: string;
  movementThresholdKm: number;
  ttlMs: number;
  fetchedAtMs?: number;
  /** Sorted, comma-joined selected categories or '*' for discovery mode. */
  categoriesKey?: string;
}

export interface NearbyCacheLookupResult {
  restaurants: Restaurant[];
  fetchedAtMs: number;
}

const isBrowserCacheAvailable = (): boolean => (
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined'
);

const clampLatitude = (latitude: number): number => Math.max(-90, Math.min(90, latitude));

const normalizeLongitude = (longitude: number): number => {
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
};

export const encodeGeohash = (latitude: number, longitude: number, precision: number = GEOHASH_PRECISION): string => {
  let isEvenBit = true;
  let bit = 0;
  let currentCharacter = 0;
  let geohash = '';
  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  const safeLat = clampLatitude(latitude);
  const safeLng = normalizeLongitude(longitude);

  while (geohash.length < precision) {
    if (isEvenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (safeLng >= mid) {
        currentCharacter |= GEOHASH_BITS[bit];
        lngRange = [mid, lngRange[1]];
      } else {
        lngRange = [lngRange[0], mid];
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (safeLat >= mid) {
        currentCharacter |= GEOHASH_BITS[bit];
        latRange = [mid, latRange[1]];
      } else {
        latRange = [latRange[0], mid];
      }
    }

    isEvenBit = !isEvenBit;

    if (bit < 4) {
      bit += 1;
      continue;
    }

    geohash += GEOHASH_BASE32[currentCharacter];
    bit = 0;
    currentCharacter = 0;
  }

  return geohash;
};

const decodeGeohashBounds = (geohash: string): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} => {
  let isEvenBit = true;
  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];

  for (const character of geohash) {
    const characterIndex = GEOHASH_BASE32.indexOf(character);
    if (characterIndex === -1) continue;

    for (const bitMask of GEOHASH_BITS) {
      const bitIsSet = (characterIndex & bitMask) !== 0;
      if (isEvenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        lngRange = bitIsSet ? [mid, lngRange[1]] : [lngRange[0], mid];
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        latRange = bitIsSet ? [mid, latRange[1]] : [latRange[0], mid];
      }
      isEvenBit = !isEvenBit;
    }
  }

  return {
    minLat: latRange[0],
    maxLat: latRange[1],
    minLng: lngRange[0],
    maxLng: lngRange[1],
  };
};

const buildGeohashLookup = (latitude: number, longitude: number): {
  areaGeohash: string;
  lookupGeohashes: string[];
  neighborGeohashes: string[];
} => {
  const areaGeohash = encodeGeohash(latitude, longitude, GEOHASH_PRECISION);
  const bounds = decodeGeohashBounds(areaGeohash);
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;
  const latSpan = bounds.maxLat - bounds.minLat;
  const lngSpan = bounds.maxLng - bounds.minLng;
  const neighbors = new Set<string>();

  for (let latDelta = -1; latDelta <= 1; latDelta += 1) {
    for (let lngDelta = -1; lngDelta <= 1; lngDelta += 1) {
      if (latDelta === 0 && lngDelta === 0) continue;
      const neighborLat = clampLatitude(centerLat + latDelta * latSpan);
      const neighborLng = normalizeLongitude(centerLng + lngDelta * lngSpan);
      neighbors.add(encodeGeohash(neighborLat, neighborLng, GEOHASH_PRECISION));
    }
  }

  return {
    areaGeohash,
    neighborGeohashes: [...neighbors],
    lookupGeohashes: [areaGeohash, ...neighbors],
  };
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => (
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  })
);

const transactionDone = (transaction: IDBTransaction): Promise<void> => (
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  })
);

const openNearbyCacheDb = async (): Promise<IDBDatabase> => {
  if (!isBrowserCacheAvailable()) {
    throw new Error('IndexedDB is not available in this environment');
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        const snapshotStore = database.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'snapshotKey' });
        snapshotStore.createIndex('areaGeohash', 'areaGeohash', { unique: false });
        snapshotStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(PLACES_STORE)) {
        const placeStore = database.createObjectStore(PLACES_STORE, { keyPath: 'placeId' });
        placeStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open nearby cache database'));
  });
};

// searchRadiusKm is part of the key so walk/drive modes maintain independent caches.
// categoriesKey ensures cuisine-specific queries are cached separately.
const buildSnapshotKey = (
  areaGeohash: string,
  region: string,
  openNowOnly: boolean,
  searchRadiusKm: number,
  categoriesKey: string = '*'
): string => (
  [
    CACHE_SCHEMA_VERSION,
    areaGeohash,
    region.toUpperCase(),
    openNowOnly ? 'open' : 'all',
    searchRadiusKm.toFixed(2),
    `cats:${categoriesKey}`,
  ].join(':')
);

const normalizeRegion = (region: string): string => region.trim().toUpperCase();

const normalizeRestaurantsForLocation = (
  restaurants: Restaurant[],
  location: { lat: number; lng: number },
  source: Restaurant['source']
): Restaurant[] => (
  restaurants.map((restaurant) => ({
    ...restaurant,
    source,
    distance: calculateDistance(
      location.lat,
      location.lng,
      restaurant.coordinates.lat,
      restaurant.coordinates.lng
    ),
  }))
);

const isSnapshotMatch = (
  snapshot: NearbySnapshotRecord,
  options: NearbyCacheLookupOptions,
  nowMs: number
): boolean => {
  if (snapshot.expiresAt <= nowMs) return false;
  if (snapshot.openNowOnly !== options.openNowOnly) return false;
  if (normalizeRegion(snapshot.region) !== normalizeRegion(options.region)) return false;
  if (Number(snapshot.searchRadiusKm.toFixed(2)) !== Number(options.searchRadiusKm.toFixed(2))) return false;

  // Match on categories key — '*' (discovery) vs specific cuisine combo
  const lookupCatsKey = options.categoriesKey ?? '*';
  const snapshotCatsKey = snapshot.categoriesKey ?? '*';
  if (lookupCatsKey !== snapshotCatsKey) return false;

  const distanceToCenter = calculateDistance(
    options.location.lat,
    options.location.lng,
    snapshot.centerLat,
    snapshot.centerLng
  );

  return distanceToCenter <= options.movementThresholdKm;
};

const getSnapshotsByGeohash = async (
  database: IDBDatabase,
  geohashes: string[]
): Promise<NearbySnapshotRecord[]> => {
  if (geohashes.length === 0) return [];

  const transaction = database.transaction(SNAPSHOTS_STORE, 'readonly');
  const store = transaction.objectStore(SNAPSHOTS_STORE);
  const geohashIndex = store.index('areaGeohash');
  const snapshotRequests = geohashes.map((geohash) =>
    requestToPromise(geohashIndex.getAll(geohash))
  );

  const groups = await Promise.all(snapshotRequests);
  await transactionDone(transaction);
  return groups.flat() as NearbySnapshotRecord[];
};

const getRestaurantsByPlaceIds = async (
  database: IDBDatabase,
  placeIds: string[],
  nowMs: number
): Promise<Restaurant[]> => {
  if (placeIds.length === 0) return [];

  const transaction = database.transaction(PLACES_STORE, 'readonly');
  const store = transaction.objectStore(PLACES_STORE);
  const placeRequests = placeIds.map((placeId) => requestToPromise(store.get(placeId)));
  const placeRecords = await Promise.all(placeRequests);
  await transactionDone(transaction);

  return placeRecords
    .filter((record): record is NearbyPlaceRecord => Boolean(record))
    .filter((record) => record.expiresAt > nowMs)
    .map((record) => record.restaurant);
};

export const getCachedNearbyRestaurants = async (
  options: NearbyCacheLookupOptions
): Promise<NearbyCacheLookupResult | null> => {
  if (!isBrowserCacheAvailable()) return null;

  const nowMs = options.nowMs ?? Date.now();
  const { lookupGeohashes } = buildGeohashLookup(options.location.lat, options.location.lng);
  const database = await openNearbyCacheDb();

  try {
    const snapshots = await getSnapshotsByGeohash(database, lookupGeohashes);
    const uniqueSnapshots = new Map<string, NearbySnapshotRecord>();

    for (const snapshot of snapshots) {
      if (!isSnapshotMatch(snapshot, options, nowMs)) continue;
      const existing = uniqueSnapshots.get(snapshot.snapshotKey);
      if (!existing || snapshot.fetchedAt > existing.fetchedAt) {
        uniqueSnapshots.set(snapshot.snapshotKey, snapshot);
      }
    }

    const matchedSnapshot = [...uniqueSnapshots.values()]
      .sort((a, b) => b.fetchedAt - a.fetchedAt)[0];

    if (!matchedSnapshot) return null;

    const storedRestaurants = await getRestaurantsByPlaceIds(database, matchedSnapshot.placeIds, nowMs);
    if (storedRestaurants.length === 0) return null;

    return {
      restaurants: normalizeRestaurantsForLocation(storedRestaurants, options.location, 'google-cache'),
      fetchedAtMs: matchedSnapshot.fetchedAt,
    };
  } finally {
    database.close();
  }
};

const getStablePlaceId = (restaurant: Restaurant): string => (
  restaurant.googlePlaceId ?? restaurant.id
);

export const saveNearbyRestaurantsSnapshot = async (options: NearbyCacheWriteOptions): Promise<void> => {
  if (!isBrowserCacheAvailable() || options.restaurants.length === 0) return;

  const database = await openNearbyCacheDb();
  const fetchedAt = options.fetchedAtMs ?? Date.now();
  const expiresAt = fetchedAt + options.ttlMs;
  const { areaGeohash, neighborGeohashes } = buildGeohashLookup(options.location.lat, options.location.lng);
  const snapshotKey = buildSnapshotKey(
    areaGeohash,
    options.region,
    options.openNowOnly,
    options.searchRadiusKm,
    options.categoriesKey
  );
  const placeIds = options.restaurants.map(getStablePlaceId);
  const normalizedRestaurants = normalizeRestaurantsForLocation(
    options.restaurants,
    options.location,
    'google-cache'
  );

  const snapshotRecord: NearbySnapshotRecord = {
    snapshotKey,
    areaGeohash,
    areaNeighborGeohashes: neighborGeohashes,
    centerLat: options.location.lat,
    centerLng: options.location.lng,
    areaRadiusKm: options.movementThresholdKm,
    searchRadiusKm: options.searchRadiusKm,
    openNowOnly: options.openNowOnly,
    region: normalizeRegion(options.region),
    categoriesKey: options.categoriesKey ?? '*',
    placeIds,
    restaurantCount: normalizedRestaurants.length,
    rankStrategy: RANK_STRATEGY,
    fetchedAt,
    expiresAt,
  };

  const transaction = database.transaction([SNAPSHOTS_STORE, PLACES_STORE], 'readwrite');
  const snapshotStore = transaction.objectStore(SNAPSHOTS_STORE);
  const placeStore = transaction.objectStore(PLACES_STORE);

  normalizedRestaurants.forEach((restaurant, index) => {
    const placeRecord: NearbyPlaceRecord = {
      placeId: placeIds[index],
      restaurant,
      updatedAt: fetchedAt,
      expiresAt,
    };
    placeStore.put(placeRecord);
  });

  snapshotStore.put(snapshotRecord);

  try {
    await transactionDone(transaction);
  } finally {
    database.close();
  }
};

const shouldRunCleanup = (): boolean => {
  if (typeof window === 'undefined') return false;

  const rawLastCleanup = window.localStorage.getItem(CLEANUP_LAST_RUN_STORAGE_KEY);
  if (!rawLastCleanup) return true;
  const parsedLastCleanup = Number(rawLastCleanup);
  if (!Number.isFinite(parsedLastCleanup)) return true;
  return Date.now() - parsedLastCleanup >= CLEANUP_INTERVAL_MS;
};

export const runNearbyCacheCleanup = async (): Promise<void> => {
  if (!isBrowserCacheAvailable() || !shouldRunCleanup()) return;

  const nowMs = Date.now();
  const database = await openNearbyCacheDb();
  const transaction = database.transaction([SNAPSHOTS_STORE, PLACES_STORE], 'readwrite');
  const snapshotStore = transaction.objectStore(SNAPSHOTS_STORE);
  const placeStore = transaction.objectStore(PLACES_STORE);
  const snapshotRecords = (await requestToPromise(snapshotStore.getAll())) as NearbySnapshotRecord[];
  const placeRecords = (await requestToPromise(placeStore.getAll())) as NearbyPlaceRecord[];

  const referencedPlaceIds = new Set<string>();

  for (const snapshot of snapshotRecords) {
    if (snapshot.expiresAt <= nowMs) {
      snapshotStore.delete(snapshot.snapshotKey);
      continue;
    }
    snapshot.placeIds.forEach((placeId) => referencedPlaceIds.add(placeId));
  }

  for (const placeRecord of placeRecords) {
    if (placeRecord.expiresAt <= nowMs || !referencedPlaceIds.has(placeRecord.placeId)) {
      placeStore.delete(placeRecord.placeId);
    }
  }

  try {
    await transactionDone(transaction);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CLEANUP_LAST_RUN_STORAGE_KEY, nowMs.toString());
    }
  } finally {
    database.close();
  }
};
