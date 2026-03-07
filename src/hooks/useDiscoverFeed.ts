import { useCallback, useEffect, useMemo, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import type { MealTime, UserLocation } from '@/types';
import { firebaseDb, isFirebaseConfigured } from '@/lib/firebase';

interface DiscoverFeedEvent {
  id: string;
  restaurantName: string;
  mealTime: MealTime;
  createdAt: number;
}

const toGeoKey = (location: UserLocation | null): string => {
  if (!location) return '';
  const lat = Math.round(location.lat * 100) / 100;
  const lng = Math.round(location.lng * 100) / 100;
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`.replace('-', 'm').replace('-', 'm');
};

const parseDiscoverEvents = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return [] as DiscoverFeedEvent[];
  return Object.entries(raw as Record<string, unknown>).reduce<DiscoverFeedEvent[]>((accumulator, [id, value]) => {
    if (!value || typeof value !== 'object') return accumulator;
    const candidate = value as Record<string, unknown>;
    const restaurantName = typeof candidate.restaurantName === 'string' ? candidate.restaurantName : '';
    const mealTime = candidate.mealTime === 'breakfast' || candidate.mealTime === 'lunch' || candidate.mealTime === 'dinner'
      ? candidate.mealTime
      : 'none';
    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : 0;
    if (!restaurantName || createdAt <= 0) return accumulator;
    accumulator.push({ id, restaurantName, mealTime, createdAt });
    return accumulator;
  }, []).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
};

export const useDiscoverFeed = (location: UserLocation | null, authUid: string | null) => {
  const [events, setEvents] = useState<DiscoverFeedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const geoKey = useMemo(() => toGeoKey(location), [location]);

  const publishSpin = useCallback(async (restaurantName: string, mealTime: MealTime) => {
    if (!firebaseDb || !isFirebaseConfigured || !authUid || !geoKey) return;
    const now = Date.now();
    const eventKey = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await set(ref(firebaseDb, `discover/${geoKey}/events/${eventKey}`), {
        restaurantName,
        mealTime,
        createdAt: now,
      });
    } catch {
      // best-effort signal only
    }
  }, [authUid, geoKey]);

  useEffect(() => {
    if (!firebaseDb || !isFirebaseConfigured || !geoKey) return;

    const eventsRef = ref(firebaseDb, `discover/${geoKey}/events`);
    const unsubscribe = onValue(eventsRef, (snapshot) => {
      setEvents(parseDiscoverEvents(snapshot.val()));
      setError(null);
    }, (subscribeError) => {
      setError(subscribeError.message);
    });

    return () => {
      unsubscribe();
    };
  }, [geoKey]);

  return {
    events: geoKey ? events : [],
    error,
    geoKey,
    publishSpin,
  };
};
