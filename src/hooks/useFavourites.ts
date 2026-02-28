import { useState, useEffect, useCallback } from 'react';
import type { Restaurant } from '@/types';
import type { FavouriteEntry } from '@/types/favourites';
import { deriveFavouriteId } from '@/types/favourites';
import {
  getAllFavourites,
  addFavourite,
  removeFavourite,
  updateFavourite,
  recordVisit,
} from '@/lib/favouritesStore';

interface UseFavouritesReturn {
  /** All saved favourites (newest first). */
  favourites: FavouriteEntry[];
  /** Whether the initial load from IndexedDB is in progress. */
  isLoading: boolean;
  /** Check if a restaurant is already in the favourites list. */
  isFavourite: (restaurant: Restaurant) => boolean;
  /** Save a restaurant as a favourite. */
  save: (restaurant: Restaurant, savedFrom: FavouriteEntry['savedFrom']) => Promise<void>;
  /** Remove a favourite by its ID. */
  remove: (id: string) => Promise<void>;
  /** Update the user rating on a favourite. */
  updateRating: (id: string, userRating: FavouriteEntry['userRating']) => Promise<void>;
  /** Record a visit (increments visitCount, sets feedbackPending). */
  recordVisitAndSave: (restaurant: Restaurant) => Promise<void>;
  /** Clear the feedback-pending flag for a favourite. */
  clearFeedbackPending: (id: string) => Promise<void>;
  /** Reload favourites from IndexedDB (e.g. after external change). */
  reload: () => Promise<void>;
}

export const useFavourites = (): UseFavouritesReturn => {
  const [favourites, setFavourites] = useState<FavouriteEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const entries = await getAllFavourites();
      setFavourites(entries);
    } catch (err) {
      console.error('[useFavourites] Failed to load favourites:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isFavouriteCheck = useCallback(
    (restaurant: Restaurant): boolean => {
      const id = deriveFavouriteId(restaurant);
      return favourites.some((f) => f.id === id);
    },
    [favourites],
  );

  const save = useCallback(
    async (restaurant: Restaurant, savedFrom: FavouriteEntry['savedFrom']) => {
      await addFavourite(restaurant, savedFrom);
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await removeFavourite(id);
      await load();
    },
    [load],
  );

  const updateRating = useCallback(
    async (id: string, userRating: FavouriteEntry['userRating']) => {
      await updateFavourite(id, { userRating, feedbackPending: false });
      await load();
    },
    [load],
  );

  const recordVisitAndSave = useCallback(
    async (restaurant: Restaurant) => {
      await recordVisit(restaurant);
      await load();
    },
    [load],
  );

  const clearFeedbackPending = useCallback(
    async (id: string) => {
      await updateFavourite(id, { feedbackPending: false });
      await load();
    },
    [load],
  );

  return {
    favourites,
    isLoading,
    isFavourite: isFavouriteCheck,
    save,
    remove,
    updateRating,
    recordVisitAndSave,
    clearFeedbackPending,
    reload: load,
  };
};
