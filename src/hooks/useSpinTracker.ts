import { useState, useCallback, useRef, useEffect } from 'react';
import type { MealTime, Restaurant } from '@/types';
import { appendSpinHistory, parseSpinHistory, SPIN_STORAGE_KEY } from '@/lib/spinHistory';
function loadHistory() {
  try { return parseSpinHistory(localStorage.getItem(SPIN_STORAGE_KEY)); } catch { return []; }
}
export function useSpinTracker() {
  const [spins, setSpins] = useState(loadHistory);
  const current = useRef(spins);
  const recordSpin = useCallback((restaurant: Restaurant, mealTime: MealTime, eventId?: string, timestamp?: number) => {
    const stored = loadHistory();
    // A persisted group event is the durable idempotency key after reload.
    const base = stored.length >= current.current.length ? stored : current.current;
    const next = appendSpinHistory(base, restaurant, mealTime, eventId, timestamp);
    current.current = next;
    if (next === base) return;
    try { localStorage.setItem(SPIN_STORAGE_KEY, JSON.stringify(next)); } catch {
      // Preserve this session's history even when persistence is unavailable.
    }
    setSpins(next);
  }, []);
  useEffect(() => {
    const reload = (event: StorageEvent) => {
      if (event.key !== SPIN_STORAGE_KEY) return;
      current.current = loadHistory();
      setSpins(current.current);
    };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);
  const today = new Date().toDateString();
  const todaySpins = spins.filter((spin) => new Date(spin.timestamp).toDateString() === today);
  return {
    spins,
    spinsToday: todaySpins.length,
    canSpin: (_mealTime: MealTime) => true,
    recordSpin,
    getSpinsForMeal: (mealTime: MealTime) => todaySpins.filter((spin) => spin.mealTime === mealTime),
  };
}
