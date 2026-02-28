import { useEffect, useMemo, useRef, useState } from 'react';

import type { Restaurant, UserLocation } from '@/types';
import { fetchNearbyGoogleRestaurants, rankNearbyRestaurants } from '@/lib/googlePlacesRestaurants';
import { enrichRestaurantListCategories } from '@/lib/categoryClassifier';
import {
  getCachedNearbyRestaurants,
  runNearbyCacheCleanup,
  saveNearbyRestaurantsSnapshot,
} from '@/lib/nearbyCache';

interface UseNearbyRestaurantsOptions {
  enabled: boolean;
  location: UserLocation | null;
  radiusKm: number;
  openNowOnly?: boolean;
  region?: string;
  language?: string;
}

interface UseNearbyRestaurantsResult {
  restaurants: Restaurant[];
  isLoading: boolean;
  error: string | null;
  source: Restaurant['source'] | null;
  shouldUseLocalFallback: boolean;
  lastSyncedAt: number | null;
}

const DEFAULT_DEBOUNCE_MS = 450;
const DEFAULT_MIN_RESULTS = 12;
const DEFAULT_TOP_RESULTS = 20;
const DEFAULT_CACHE_TTL_DAYS = 7;
const DEFAULT_CACHE_MOVEMENT_THRESHOLD_KM = 0.1;

const parsePositiveNumber = (rawValue: string | undefined, fallback: number): number => {
  if (!rawValue) return fallback;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const toMs = (days: number): number => Math.round(days * 24 * 60 * 60 * 1000);

export function useNearbyRestaurants({
  enabled,
  location,
  radiusKm,
  openNowOnly = true,
  region = (import.meta.env.VITE_GOOGLE_PLACES_REGION as string | undefined) ?? 'MY',
  language = (import.meta.env.VITE_GOOGLE_PLACES_LANGUAGE as string | undefined) ?? 'en',
}: UseNearbyRestaurantsOptions): UseNearbyRestaurantsResult {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Restaurant['source'] | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [shouldUseLocalFallback, setShouldUseLocalFallback] = useState(false);
  const requestIdRef = useRef(0);

  const cacheConfig = useMemo(() => {
    const ttlDays = parsePositiveNumber(
      import.meta.env.VITE_NEARBY_CACHE_TTL_DAYS as string | undefined,
      DEFAULT_CACHE_TTL_DAYS
    );
    const movementThresholdKm = parsePositiveNumber(
      import.meta.env.VITE_NEARBY_CACHE_MOVEMENT_THRESHOLD_KM as string | undefined,
      parsePositiveNumber(
        import.meta.env.VITE_NEARBY_CACHE_AREA_KM as string | undefined,
        DEFAULT_CACHE_MOVEMENT_THRESHOLD_KM
      )
    );
    const minResults = parsePositiveNumber(
      import.meta.env.VITE_NEARBY_CACHE_MIN_RESULTS as string | undefined,
      DEFAULT_MIN_RESULTS
    );

    return {
      ttlMs: toMs(ttlDays),
      movementThresholdKm,
      minResults: Math.max(1, Math.round(minResults)),
      topResults: DEFAULT_TOP_RESULTS,
    };
  }, []);

  useEffect(() => {
    void runNearbyCacheCleanup().catch((cleanupError) => {
      console.error('Nearby cache cleanup failed', cleanupError);
    });
  }, []);

  useEffect(() => {
    if (!enabled || !location) {
      setRestaurants([]);
      setIsLoading(false);
      setError(null);
      setSource(null);
      setShouldUseLocalFallback(false);
      setLastSyncedAt(null);
      return;
    }

    const normalizedRegion = region.trim().toUpperCase();
    const normalizedLanguage = language.trim().toLowerCase() || 'en';
    const effectiveRadiusKm = radiusKm;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const abortController = new AbortController();

    const run = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      setShouldUseLocalFallback(false);

      const cacheLookupOptions = {
        location,
        searchRadiusKm: effectiveRadiusKm,
        openNowOnly,
        region: normalizedRegion,
        movementThresholdKm: cacheConfig.movementThresholdKm,
      };

      let cachedResult: Awaited<ReturnType<typeof getCachedNearbyRestaurants>> = null;
      try {
        cachedResult = await getCachedNearbyRestaurants(cacheLookupOptions);
      } catch (cacheError) {
        console.error('Failed to read nearby cache', cacheError);
      }

      if (requestIdRef.current !== requestId) return;

      if (cachedResult && cachedResult.restaurants.length >= cacheConfig.minResults) {
        const rankedCached = rankNearbyRestaurants(
          cachedResult.restaurants,
          location,
          effectiveRadiusKm,
          cacheConfig.topResults,
          'google-cache'
        );
        setRestaurants(enrichRestaurantListCategories(rankedCached));
        setSource('google-cache');
        setLastSyncedAt(cachedResult.fetchedAtMs);
        setIsLoading(false);
        return;
      }

      try {
        const liveResult = await fetchNearbyGoogleRestaurants({
          location,
          radiusKm: effectiveRadiusKm,
          region: normalizedRegion,
          language: normalizedLanguage,
          signal: abortController.signal,
        });

        if (requestIdRef.current !== requestId) return;

        const rankedLive = rankNearbyRestaurants(
          liveResult,
          location,
          effectiveRadiusKm,
          cacheConfig.topResults,
          'google-live'
        );
        const fetchedAtMs = Date.now();

        if (rankedLive.length > 0) {
          await saveNearbyRestaurantsSnapshot({
            location,
            restaurants: rankedLive,
            searchRadiusKm: effectiveRadiusKm,
            openNowOnly,
            region: normalizedRegion,
            movementThresholdKm: cacheConfig.movementThresholdKm,
            ttlMs: cacheConfig.ttlMs,
            fetchedAtMs,
          });
        }

        if (requestIdRef.current !== requestId) return;

        if (rankedLive.length === 0 && cachedResult && cachedResult.restaurants.length > 0) {
          const rankedCached = rankNearbyRestaurants(
            cachedResult.restaurants,
            location,
            effectiveRadiusKm,
            cacheConfig.topResults,
            'google-cache'
          );
          setRestaurants(enrichRestaurantListCategories(rankedCached));
          setSource('google-cache');
          setError('Live refresh returned no matches. Showing cached nearby data.');
          setLastSyncedAt(cachedResult.fetchedAtMs);
          setIsLoading(false);
          return;
        }

        setRestaurants(enrichRestaurantListCategories(rankedLive));
        setSource('google-live');
        setLastSyncedAt(fetchedAtMs);
        setShouldUseLocalFallback(false);
      } catch (fetchError) {
        if (requestIdRef.current !== requestId) return;
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;

        const errorMessage = fetchError instanceof Error
          ? fetchError.message
          : 'Unable to fetch nearby restaurants right now.';

        if (cachedResult && cachedResult.restaurants.length > 0) {
          const rankedCached = rankNearbyRestaurants(
            cachedResult.restaurants,
            location,
            effectiveRadiusKm,
            cacheConfig.topResults,
            'google-cache'
          );
          setRestaurants(enrichRestaurantListCategories(rankedCached));
          setSource('google-cache');
          setError(`${errorMessage} Showing cached nearby data.`);
          setLastSyncedAt(cachedResult.fetchedAtMs);
          setShouldUseLocalFallback(false);
        } else {
          setRestaurants([]);
          setSource(null);
          setError(errorMessage);
          setLastSyncedAt(null);
          setShouldUseLocalFallback(true);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    const debounceTimer = window.setTimeout(() => {
      void run();
    }, DEFAULT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceTimer);
      abortController.abort();
    };
  }, [cacheConfig, enabled, language, location, openNowOnly, radiusKm, region]);

  return {
    restaurants,
    isLoading,
    error,
    source,
    shouldUseLocalFallback,
    lastSyncedAt,
  };
}
