import type { MealTime, Restaurant, SpinResult } from '@/types';
export const SPIN_STORAGE_KEY = 'eatspin_spins';
export interface SpinHistoryEntry extends SpinResult { eventId?: string }
export function parseSpinHistory(raw: string | null): SpinHistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      if (!value || typeof value !== 'object' || !value.restaurant || typeof value.restaurant.name !== 'string'
        || !['none', 'breakfast', 'lunch', 'dinner'].includes(value.mealTime)) return [];
      const timestamp = new Date(value.timestamp);
      if (!Number.isFinite(timestamp.getTime())) return [];
      return [{ restaurant: value.restaurant, mealTime: value.mealTime, timestamp,
        ...(typeof value.eventId === 'string' ? { eventId: value.eventId } : {}) }];
    });
  } catch { return []; }
}
export function appendSpinHistory(
  entries: SpinHistoryEntry[], restaurant: Restaurant, mealTime: MealTime,
  eventId?: string, timestamp = Date.now(),
): SpinHistoryEntry[] {
  if (eventId && entries.some((entry) => entry.eventId === eventId)) return entries;
  return [...entries, { restaurant, mealTime, timestamp: new Date(timestamp), ...(eventId ? { eventId } : {}) }];
}
