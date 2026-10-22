import type { Restaurant } from '@/types';
import type { FavouriteEntry } from '@/types/favourites';
import { deriveFavouriteId } from '@/types/favourites';

// ---------------------------------------------------------------------------
// IndexedDB constants
// ---------------------------------------------------------------------------

const DB_NAME = 'eatspin-favourites';
const DB_VERSION = 1;
const STORE_NAME = 'favourites';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isAvailable = (): boolean =>
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by-rating', 'userRating', { unique: false });
        store.createIndex('by-savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Retrieve all favourites, sorted by savedAt descending (newest first). */
export const getAllFavourites = async (): Promise<FavouriteEntry[]> => {
  if (!isAvailable()) return [];

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const entries = (request.result as FavouriteEntry[]).sort(
        (a, b) => b.savedAt - a.savedAt,
      );
      resolve(entries);
    };
    request.onerror = () => reject(request.error);
  });
};

/** Get a single favourite by ID. */
export const getFavourite = async (id: string): Promise<FavouriteEntry | undefined> => {
  if (!isAvailable()) return undefined;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as FavouriteEntry | undefined);
    request.onerror = () => reject(request.error);
  });
};

/** Check whether a restaurant is already saved as a favourite. */
export const isFavourite = async (restaurant: Restaurant): Promise<boolean> => {
  const id = deriveFavouriteId(restaurant);
  const entry = await getFavourite(id);
  return entry !== undefined;
};

/** Add a restaurant as a favourite. No-op if it already exists. Returns the entry. */
export const addFavourite = async (
  restaurant: Restaurant,
  savedFrom: FavouriteEntry['savedFrom'],
): Promise<FavouriteEntry> => {
  if (!isAvailable()) throw new Error('IndexedDB not available');

  const id = deriveFavouriteId(restaurant);
  const existing = await getFavourite(id);
  if (existing) return existing;

  const entry: FavouriteEntry = {
    id,
    restaurant,
    savedAt: Date.now(),
    savedFrom,
    location: {
      lat: restaurant.coordinates.lat,
      lng: restaurant.coordinates.lng,
    },
    visitCount: 0,
    userRating: 'suggest',
    feedbackPending: false,
  };

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(entry);

    // A successful put request can still be rolled back by an aborted transaction.
    tx.oncomplete = () => { db.close(); resolve(entry); };
    tx.onerror = () => { db.close(); reject(tx.error ?? request.error ?? new Error('Favourite save failed')); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Favourite save was aborted')); };
  });
};

/** Remove a favourite by ID. Returns the deleted entry (for undo). */
export const removeFavourite = async (id: string): Promise<FavouriteEntry | undefined> => {
  if (!isAvailable()) return undefined;

  const existing = await getFavourite(id);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(existing);
    request.onerror = () => reject(request.error);
  });
};

/** Restore a previously deleted favourite entry (for undo). */
export const restoreFavourite = async (entry: FavouriteEntry): Promise<void> => {
  if (!isAvailable()) return;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/** Update specific fields on an existing favourite. */
export const updateFavourite = async (
  id: string,
  updates: Partial<Pick<FavouriteEntry, 'userRating' | 'feedbackPending' | 'lastVisitedAt' | 'visitCount' | 'lastPromptedAt'>>,
): Promise<FavouriteEntry | undefined> => {
  if (!isAvailable()) return undefined;

  const db = await openDb();
  const existing = await getFavourite(id);
  if (!existing) return undefined;

  const updated: FavouriteEntry = { ...existing, ...updates };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(updated);

    request.onsuccess = () => resolve(updated);
    request.onerror = () => reject(request.error);
  });
};

/** Record that the user tapped "Let's go!" for this restaurant. */
export const recordVisit = async (restaurant: Restaurant): Promise<FavouriteEntry> => {
  const id = deriveFavouriteId(restaurant);
  const existing = await getFavourite(id);

  if (existing) {
    const updated = await updateFavourite(id, {
      lastVisitedAt: Date.now(),
      visitCount: existing.visitCount + 1,
      feedbackPending: true,
    });
    return updated!;
  }

  // Auto-save as favourite if not yet saved
  const entry = await addFavourite(restaurant, 'lets-go');
  const updated = await updateFavourite(entry.id, {
    lastVisitedAt: Date.now(),
    visitCount: 1,
    feedbackPending: true,
  });
  return updated!;
};
