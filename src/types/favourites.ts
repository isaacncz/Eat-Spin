import type { Restaurant } from '@/types';

export interface FavouriteEntry {
  /** googlePlaceId or hash(name+address) */
  id: string;
  /** Snapshot of the full restaurant data at save time */
  restaurant: Restaurant;
  /** Date.now() when saved */
  savedAt: number;
  /** How this favourite was created */
  savedFrom: 'spin-auto' | 'spin-manual' | 'lets-go';
  /** Restaurant coordinates */
  location: { lat: number; lng: number };
  /** Timestamp of last confirmed visit via "Let's go!" */
  lastVisitedAt?: number;
  /** Number of times user tapped "Let's go!" for this restaurant */
  visitCount: number;
  /** User's post-visit rating — default 'suggest' */
  userRating: 'suggest' | 'neutral' | 'avoid';
  /** Whether the user has given feedback after their last visit */
  feedbackPending: boolean;
  /** Timestamp when this favourite was last surfaced in a proximity prompt */
  lastPromptedAt?: number;
}

/**
 * Derive a stable ID for a restaurant favourite.
 * Prefers googlePlaceId; falls back to a hash of name+address.
 */
export const deriveFavouriteId = (restaurant: Restaurant): string => {
  if (restaurant.googlePlaceId) return restaurant.googlePlaceId;

  // Simple FNV-1a-inspired hash
  const raw = `${restaurant.name.trim().toLowerCase()}::${restaurant.address.trim().toLowerCase()}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fav-${(hash >>> 0).toString(36)}`;
};
