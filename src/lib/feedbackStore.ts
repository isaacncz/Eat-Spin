// ---------------------------------------------------------------------------
// Pending-feedback queue — lightweight localStorage persistence.
// After a user taps "Let's go!" we queue a feedback entry. On next app open
// (after ≥ 2 h) we surface a prompt asking how the visit went.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'eatspin:pending-feedback';
const FEEDBACK_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface PendingFeedback {
  /** FavouriteEntry.id */
  favouriteId: string;
  /** Restaurant name — used in the prompt UI */
  restaurantName: string;
  /** Date.now() when the user tapped "Let's go!" */
  triggeredAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const readQueue = (): PendingFeedback[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PendingFeedback =>
        typeof item?.favouriteId === 'string' &&
        typeof item?.restaurantName === 'string' &&
        typeof item?.triggeredAt === 'number',
    );
  } catch {
    return [];
  }
};

const writeQueue = (queue: PendingFeedback[]): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Enqueue a feedback request. Deduplicates by favouriteId. */
export const enqueueFeedback = (entry: Omit<PendingFeedback, 'triggeredAt'>): void => {
  const queue = readQueue();
  if (queue.some((item) => item.favouriteId === entry.favouriteId)) return;
  queue.push({ ...entry, triggeredAt: Date.now() });
  writeQueue(queue);
};

/** Return the first feedback entry that is ready (older than FEEDBACK_DELAY_MS). */
export const getReadyFeedback = (): PendingFeedback | null => {
  const queue = readQueue();
  const now = Date.now();
  return queue.find((item) => now - item.triggeredAt >= FEEDBACK_DELAY_MS) ?? null;
};

/** Remove a specific feedback entry from the queue (after user responds). */
export const dequeueFeedback = (favouriteId: string): void => {
  const queue = readQueue().filter((item) => item.favouriteId !== favouriteId);
  writeQueue(queue);
};

/** Return all pending entries (for debugging / inspection). */
export const getAllPendingFeedback = (): PendingFeedback[] => readQueue();
