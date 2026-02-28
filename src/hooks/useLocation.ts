import { useState, useEffect, useRef, useCallback } from 'react';
import type { UserLocation } from '@/types';

export const LOCATION_MOVEMENT_THRESHOLD_KM = 0.1;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const calculateDistanceKm = (pointA: UserLocation, pointB: UserLocation): number => {
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
  requestLocation: () => void;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastEmittedLocationRef = useRef<UserLocation | null>(null);

  const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
    const nextLocation: UserLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    const previousLocation = lastEmittedLocationRef.current;

    if (!previousLocation) {
      lastEmittedLocationRef.current = nextLocation;
      setLocation(nextLocation);
      setIsLoading(false);
      return;
    }

    const distanceKm = calculateDistanceKm(previousLocation, nextLocation);
    if (distanceKm >= LOCATION_MOVEMENT_THRESHOLD_KM) {
      lastEmittedLocationRef.current = nextLocation;
      setLocation(nextLocation);
    }

    setIsLoading(false);
  }, []);

  const clearLocationWatcher = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);
    setError(null);

    if (watchIdRef.current !== null) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (err) => {
        setError(`Unable to retrieve your location: ${err.message}`);
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [handlePositionUpdate]);

  useEffect(() => {
    return () => {
      clearLocationWatcher();
    };
  }, [clearLocationWatcher]);

  return { location, error, isLoading, requestLocation };
}
