import type { ServesFilterId } from '@/lib/servesFilters';

/**
 * Returns suggested serves-filter pills based on the current time of day.
 * These are soft defaults — the user can always override.
 */
export function getTimeOfDayFilters(): ServesFilterId[] {
  const hour = new Date().getHours();

  // 6am–10am → Breakfast
  if (hour >= 6 && hour < 10) return ['servesBreakfast'];
  // 10am–12pm → Brunch
  if (hour >= 10 && hour < 12) return ['servesBrunch'];
  // 2pm–5pm → Coffee break
  if (hour >= 14 && hour < 17) return ['servesCoffee'];

  return [];
}
