const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The "last visit" line on the result screen, for example "Last visit 12 days ago · 6 visits".
 *
 * Days are 24-hour blocks of elapsed time, the same rule rarity uses, so the line always
 * agrees with the tier shown next to it.
 *
 * @param lastVisitedAt Epoch ms of the last "Let's go!", or undefined if the place was never visited.
 * @param visitCount How many times the player tapped "Let's go!" for this place, when known.
 */
export const formatLastVisit = (
  lastVisitedAt: number | null | undefined,
  visitCount: number | null | undefined,
  now: number = Date.now(),
): string => {
  if (typeof lastVisitedAt !== 'number' || !Number.isFinite(lastVisitedAt)) {
    return 'Not visited yet';
  }

  // A timestamp in the future (clock change) counts as today.
  const days = Math.max(0, Math.floor((now - lastVisitedAt) / DAY_MS));
  const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;

  const visits = typeof visitCount === 'number' && Number.isFinite(visitCount) ? Math.floor(visitCount) : 0;
  const count = visits > 0 ? ` · ${visits} ${visits === 1 ? 'visit' : 'visits'}` : '';

  return `Last visit ${when}${count}`;
};
