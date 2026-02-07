import { useState, useCallback, useEffect } from 'react';
import type { SpinResult, MealTime } from '@/types';
import type { Restaurant } from '@/types';

interface SpinTrackerState {
  spins: SpinResult[];
  spinsToday: number;
  canSpin: (mealTime: MealTime) => boolean;
  recordSpin: (restaurant: Restaurant, mealTime: MealTime) => void;
  getSpinsForMeal: (mealTime: MealTime) => SpinResult[];
}

const SPIN_STORAGE_KEY = 'eatspin_spins';
// const FREE_SPINS_PER_MEAL = 1;

// export function useSpinTracker(isPremium: boolean = false): SpinTrackerState {
export function useSpinTracker(): SpinTrackerState {
  const [spins, setSpins] = useState<SpinResult[]>([]);

  // Load spins from localStorage on mount
  useEffect(() => {
    const savedSpins = localStorage.getItem(SPIN_STORAGE_KEY);
    if (savedSpins) {
      try {
        const parsed = JSON.parse(savedSpins);
        // Convert date strings back to Date objects
        const spinsWithDates = parsed.map((spin: any) => ({
          ...spin,
          timestamp: new Date(spin.timestamp),
        }));
        setSpins(spinsWithDates);
      } catch (error) {
        console.error('Failed to parse spins from storage:', error);
      }
    }
  }, []);

  // Save spins to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(SPIN_STORAGE_KEY, JSON.stringify(spins));
  }, [spins]);

  const getTodaySpins = useCallback((): SpinResult[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return spins.filter((spin) => {
      const spinDate = new Date(spin.timestamp);
      spinDate.setHours(0, 0, 0, 0);
      return spinDate.getTime() === today.getTime();
    });
  }, [spins]);

  const spinsToday = getTodaySpins().length;
  // Temporary: Allow unlimited spins for all users
  const canSpin = useCallback(
    (_mealTime: MealTime): boolean => {
      return true;
    },
    []
  );
  // const canSpin = useCallback(
  //   (mealTime: MealTime): boolean => {
  //     if (mealTime === 'none') return false;
      
  //     if (isPremium) {
  //       return true; // Premium users can spin unlimited times
  //     }

  //     // Check spins for this specific meal time today
  //     const todayMealSpins = getTodaySpins().filter(
  //       (spin) => spin.mealTime === mealTime
  //     );

  //     return todayMealSpins.length < FREE_SPINS_PER_MEAL;
  //   },
  //   [isPremium, getTodaySpins]
  // );

  const recordSpin = useCallback(
    (restaurant: Restaurant, mealTime: MealTime) => {
      const newSpin: SpinResult = {
        restaurant,
        timestamp: new Date(),
        mealTime,
      };

      setSpins((prev) => [...prev, newSpin]);
    },
    []
  );

  const getSpinsForMeal = useCallback(
    (mealTime: MealTime): SpinResult[] => {
      return getTodaySpins().filter((spin) => spin.mealTime === mealTime);
    },
    [getTodaySpins]
  );

  return {
    spins,
    spinsToday,
    canSpin,
    recordSpin,
    getSpinsForMeal,
  };
}
