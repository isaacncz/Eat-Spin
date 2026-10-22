/**
 * Place rarity: how long it has been since the user last went to a place.
 *
 * Rarity is always computed from `lastVisitedAt` (the favourite's "Let's go!"
 * timestamp). It is never stored, so it cannot drift out of date.
 *
 *   common  visited less than 7 days ago           1x XP
 *   rare    visited 7 to 29 days ago               2x XP
 *   epic    visited 30+ days ago, or never visited 3x XP
 *
 * A "day" is 24 hours of elapsed time, not a calendar day, so the result does
 * not depend on the time zone or on daylight saving changes.
 */

export type Rarity = 'common' | 'rare' | 'epic';

export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic'];

/** First day count at which a place becomes rare. */
export const RARE_AFTER_DAYS = 7;
/** First day count at which a place becomes epic. */
export const EPIC_AFTER_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export const RARITY_XP_MULTIPLIER: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
};

/** One short line explaining the tier, for tooltips and the result ribbon. */
export const RARITY_HINT: Record<Rarity, string> = {
  common: `Visited in the last ${RARE_AFTER_DAYS} days`,
  rare: `Last visited ${RARE_AFTER_DAYS} to ${EPIC_AFTER_DAYS - 1} days ago`,
  epic: `Not visited in ${EPIC_AFTER_DAYS}+ days, or never`,
};

/**
 * Rarity tier for a place.
 *
 * @param lastVisitedAt Epoch milliseconds of the last visit. `undefined`, `null`
 *   or a value that is not a finite number means "never visited".
 * @param now Epoch milliseconds to measure from. Defaults to the current time.
 *
 * A `lastVisitedAt` in the future (clock change) counts as a fresh visit.
 */
export const getRarity = (lastVisitedAt: number | null | undefined, now: number = Date.now()): Rarity => {
  if (typeof lastVisitedAt !== 'number' || !Number.isFinite(lastVisitedAt)) return 'epic';

  const elapsed = now - lastVisitedAt;
  if (elapsed < RARE_AFTER_DAYS * DAY_MS) return 'common';
  if (elapsed < EPIC_AFTER_DAYS * DAY_MS) return 'rare';
  return 'epic';
};

export const getRarityMultiplier = (rarity: Rarity): number => RARITY_XP_MULTIPLIER[rarity];
