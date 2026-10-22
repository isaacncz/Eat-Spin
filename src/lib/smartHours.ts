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
  const dayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const selectedHours = restaurant.hours[DAY_KEYS[dayIndex]] ?? restaurant.hours.daily;
  const previousHours = restaurant.hours[DAY_KEYS[(dayIndex + 6) % 7]] ?? restaurant.hours.daily;

  // Work in minutes relative to today's midnight, including yesterday's carryover.
  const intervals: Array<{ open: number; close: number }> = [];
  const addWindows = (hours: typeof selectedHours, offset: number) => {
    if (!hours || hours.closed) return;
    for (const window of hours.windows) {
      const open = timeToMinutes(window.open);
      let close = timeToMinutes(window.close);
      if (close <= open) close += 1440;
      // 23:59 is the existing representation of all-day opening.
      if (window.open === '00:00' && window.close === '23:59') close = 1440;
      intervals.push({ open: open + offset, close: close + offset });
    }
  };
  addWindows(previousHours, -1440);
  addWindows(selectedHours, 0);
  intervals.sort((a, b) => a.open - b.open);
  const merged: typeof intervals = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval.open <= last.close) last.close = Math.max(last.close, interval.close);
    else merged.push({ ...interval });
  }
  const active = merged.find((window) => currentMinutes >= window.open && currentMinutes < window.close);
  if (active) {
    const allDay = selectedHours && !selectedHours.closed && selectedHours.windows.some(
      (window) => window.open === '00:00' && (window.close === '23:59' || window.close === '00:00'),
    );
    if (allDay) return { label: 'Open 24 hours', status: 'open' };
    const minutesUntilClose = active.close - currentMinutes;
    return minutesUntilClose <= 60
      ? { label: `Closes in ${minutesUntilClose} min ⚠️`, status: 'closing-soon' }
      : { label: `Open until ${minutesToFriendly(active.close % 1440)}`, status: 'open' };
  }
  const windows = selectedHours && !selectedHours.closed ? selectedHours.windows : [];

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
