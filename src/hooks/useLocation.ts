import { useState, useEffect, useRef, useCallback } from 'react';
import type { UserLocation } from '@/types';

/** A new fix closer than this to the current anchor keeps the anchor, so nothing reloads. */
export const LOCATION_MOVEMENT_THRESHOLD_KM = 0.1;

const GEOLOCATION_TIMEOUT_MS = 10_000;
/**
 * Some browsers never call either callback (e.g. a dismissed permission prompt), and the
 * `timeout` option only starts once permission is granted. Give up ourselves a little later.
 */
export const LOCATION_GIVE_UP_MS = GEOLOCATION_TIMEOUT_MS + 5_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const calculateDistanceKm = (pointA: UserLocation, pointB: UserLocation): number => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(pointB.lat - pointA.lat);
  const dLng = toRadians(pointB.lng - pointA.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(pointA.lat)) *
      Math.cos(toRadians(pointB.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface UseLocationResult {
  /** The last fix. It does not follow the device: it changes only when a request returns a new one. */
  location: UserLocation | null;
  error: string | null;
  /** True while a request is waiting for a fix. `location` may still hold the previous one. */
  isLoading: boolean;
  /** Takes one fresh GPS fix and uses it as the search anchor. Call again to re-anchor. */
  requestLocation: () => void;
}

/**
 * Device location as a fixed anchor. One fix per request: the app never follows the device,
 * so driving does not rebuild the wheel or trigger repeated Places searches (#138).
 */
export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const anchorRef = useRef<UserLocation | null>(null);
  /** Id of the request being waited for; 0 when none. Callbacks from any other request are ignored. */
  const activeRequestRef = useRef(0);
  const nextRequestRef = useRef(0);
  const giveUpTimerRef = useRef<number | null>(null);

  const clearGiveUpTimer = useCallback(() => {
    if (giveUpTimerRef.current !== null) {
      window.clearTimeout(giveUpTimerRef.current);
      giveUpTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    activeRequestRef.current = 0;
    clearGiveUpTimer();
  }, [clearGiveUpTimer]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    if (activeRequestRef.current !== 0) return;

    const requestId = ++nextRequestRef.current;
    activeRequestRef.current = requestId;
    setIsLoading(true);
    setError(null);

    /** Settles this request once; returns false when it was already settled or replaced. */
    const settle = (): boolean => {
      if (activeRequestRef.current !== requestId) return false;
      activeRequestRef.current = 0;
      clearGiveUpTimer();
      return true;
    };

    giveUpTimerRef.current = window.setTimeout(() => {
      if (!settle()) return;
      setError('Unable to retrieve your location: the request timed out');
      setIsLoading(false);
    }, LOCATION_GIVE_UP_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!settle()) return;
        const next: UserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        const anchor = anchorRef.current;
        if (!anchor || calculateDistanceKm(anchor, next) >= LOCATION_MOVEMENT_THRESHOLD_KM) {
          anchorRef.current = next;
          setLocation(next);
        }
        setIsLoading(false);
      },
      (err) => {
        if (!settle()) return;
        setError(`Unable to retrieve your location: ${err.message}`);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 0,
      },
    );
  }, [clearGiveUpTimer]);

  return { location, error, isLoading, requestLocation };
}
