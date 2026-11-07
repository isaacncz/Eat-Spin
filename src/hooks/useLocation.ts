import { useState, useEffect, useRef, useCallback } from 'react';
import type { UserLocation } from '@/types';

/** A new fix closer than this to the current anchor keeps the anchor, so nothing reloads. */
export const LOCATION_MOVEMENT_THRESHOLD_KM = 0.1;

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
  location: UserLocation | null;
  error: string | null;
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
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        pendingRef.current = false;
        if (!mountedRef.current) return;
        const next: UserLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        const anchor = anchorRef.current;
        if (!anchor || calculateDistanceKm(anchor, next) >= LOCATION_MOVEMENT_THRESHOLD_KM) {
          anchorRef.current = next;
          setLocation(next);
        }
        setIsLoading(false);
      },
      (err) => {
        pendingRef.current = false;
        if (!mountedRef.current) return;
        setError(`Unable to retrieve your location: ${err.message}`);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, []);

  return { location, error, isLoading, requestLocation };
}
