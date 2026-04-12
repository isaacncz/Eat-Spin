import type { Restaurant } from '@/types';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse a time string like "08:00" or "22:30" into total minutes from midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Format minutes-from-midnight into a human-friendly time like "8am" or "10:30pm".
 */
function minutesToFriendly(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}

export interface SmartHoursResult {
  label: string;
  /** 'open' | 'closing-soon' | 'closed' | 'unknown' */
  status: 'open' | 'closing-soon' | 'closed' | 'unknown';
}

/**
 * Returns a smart, context-aware hours label:
 * - "Open until 10pm"
 * - "Closes in 25 min ⚠️"
 * - "Closed · Opens 8am tomorrow"
 * - "Open 24 hours"
 *
 * Uses the restaurant's `hours` data and optionally `isOpen` from Google.
 */
export function getSmartHoursLabel(restaurant: Restaurant, now: Date = new Date()): SmartHoursResult {
  const dayIndex = now.getDay(); // 0=Sunday
  const dayKey = DAY_KEYS[dayIndex];
  const todayHours = restaurant.hours[dayKey];
  const dailyHours = restaurant.hours['daily'];
  const selectedHours = todayHours ?? dailyHours;

  if (!selectedHours || selectedHours.closed || selectedHours.windows.length === 0) {
    // Closed today — find when they open next
    const nextOpen = findNextOpenDay(restaurant, now);
    if (nextOpen) {
      return { label: `Closed · Opens ${nextOpen}`, status: 'closed' };
    }
    return { label: 'Closed today', status: 'closed' };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const windows = selectedHours.windows;

  // Check for 24-hour operation
  if (windows.some((w) => w.open === '00:00' && (w.close === '23:59' || w.close === '00:00'))) {
    return { label: 'Open 24 hours', status: 'open' };
  }

  // Find the current or next window
  for (const window of windows) {
    const openMin = timeToMinutes(window.open);
    let closeMin = timeToMinutes(window.close);
    // Handle overnight hours (e.g., 22:00-02:00)
    if (closeMin <= openMin) closeMin += 24 * 60;

    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      // Currently open — how long until closing?
      const minutesUntilClose = closeMin - currentMinutes;
      if (minutesUntilClose <= 60) {
        return {
          label: `Closes in ${minutesUntilClose} min ⚠️`,
          status: 'closing-soon',
        };
      }
      return {
        label: `Open until ${minutesToFriendly(closeMin % (24 * 60))}`,
        status: 'open',
      };
    }
  }

  // Not in any window — find the next opening time
  const sortedWindows = [...windows].sort((a, b) => timeToMinutes(a.open) - timeToMinutes(b.open));
  const futureWindow = sortedWindows.find((w) => timeToMinutes(w.open) > currentMinutes);

  if (futureWindow) {
    return {
      label: `Closed · Opens ${minutesToFriendly(timeToMinutes(futureWindow.open))}`,
      status: 'closed',
    };
  }

  // Past all windows today — check tomorrow
  const nextOpen = findNextOpenDay(restaurant, now);
  if (nextOpen) {
    return { label: `Closed · Opens ${nextOpen}`, status: 'closed' };
  }

  return { label: 'Closed', status: 'closed' };
}

/**
 * Find the next day+time the restaurant opens.
 */
function findNextOpenDay(restaurant: Restaurant, now: Date): string | null {
  const todayIndex = now.getDay();

  for (let offset = 1; offset <= 7; offset++) {
    const nextIndex = (todayIndex + offset) % 7;
    const dayKey = DAY_KEYS[nextIndex];
    const hours = restaurant.hours[dayKey] ?? restaurant.hours['daily'];

    if (hours && !hours.closed && hours.windows.length > 0) {
      const openTime = minutesToFriendly(timeToMinutes(hours.windows[0].open));
      if (offset === 1) {
        return `${openTime} tomorrow`;
      }
      const dayName = dayKey.charAt(0).toUpperCase() + dayKey.slice(1, 3);
      return `${openTime} ${dayName}`;
    }
  }

  return null;
}
