import { useState, useEffect } from 'react';
import type { UserLocation } from '@/types';
import { getRegionFromLongitude } from '@/assets/data/registry';

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

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation: UserLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          region: getRegionFromLongitude(position.coords.longitude),
        };
        setLocation(userLocation);
        setIsLoading(false);
      },
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
  };

  useEffect(() => {
    // Auto-request location on mount
    requestLocation();
  }, []);

  return { location, error, isLoading, requestLocation };
}
