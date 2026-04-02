import { useEffect, useMemo, useRef, useState } from 'react';

import type { FoodCategory, Restaurant, UserLocation } from '@/types';
import { fetchNearbyGoogleRestaurants, rankNearbyRestaurants } from '@/lib/googlePlacesRestaurants';
import { enrichRestaurantListCategories } from '@/lib/categoryClassifier';
import {
  getCachedNearbyRestaurants,
  runNearbyCacheCleanup,
  saveNearbyRestaurantsSnapshot,
} from '@/lib/nearbyCache';
import { applyOsmEnrichments, fetchOsmEnrichments } from '@/lib/osmEnrichment';

interface UseNearbyRestaurantsOptions {
  enabled: boolean;
  location: UserLocation | null;
  radiusKm: number;
  openNowOnly?: boolean;
  region?: string;
  language?: string;
  /** Cuisine categories the user has selected. Drives cuisine-specific Google types. */
  selectedCategories?: FoodCategory[];
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

/** Maximum ms to wait for Overpass before abandoning OSM enrichment. */
const OSM_ENRICHMENT_TIMEOUT_MS = 8_000;
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
  selectedCategories,
}: UseNearbyRestaurantsOptions): UseNearbyRestaurantsResult {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<Restaurant['source'] | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [shouldUseLocalFallback, setShouldUseLocalFallback] = useState(false);
  const requestIdRef = useRef(0);

  // Stable string key for selectedCategories to use as a useEffect dependency.
  // Sorted so ['chinese','japanese'] and ['japanese','chinese'] produce the same key.
  const categoriesKey = useMemo(
    () => (selectedCategories && selectedCategories.length > 0
      ? [...selectedCategories].sort().join(',')
      : '*'),
    [selectedCategories]
  );

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
        categoriesKey,
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
          selectedCategories,
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
          return;
        }

        // Publish Google results immediately so the UI is responsive.
        setRestaurants(enrichRestaurantListCategories(rankedLive));
        setSource('google-live');
        setLastSyncedAt(fetchedAtMs);
        setShouldUseLocalFallback(false);

        // OSM enrichment runs asynchronously — must not delay the initial render.
        // Capture loop-local values so the closure is race-free.
        const capturedRequestId = requestId;
        const capturedRankedLive = rankedLive;
        void (async () => {
          // Save the Google-only snapshot first so the cache is warm even if
          // OSM enrichment times out or fails.
          if (capturedRankedLive.length > 0) {
            try {
              await saveNearbyRestaurantsSnapshot({
                location,
                restaurants: capturedRankedLive,
                searchRadiusKm: effectiveRadiusKm,
                openNowOnly,
                region: normalizedRegion,
                movementThresholdKm: cacheConfig.movementThresholdKm,
                ttlMs: cacheConfig.ttlMs,
                fetchedAtMs,
                categoriesKey,
              });
            } catch (saveError) {
              console.warn('[nearbyCache] Failed to save Google snapshot:', saveError);
            }
          }

          // Enrich with OSM behind a strict timeout so Overpass degradation
          // cannot block or discard the already-rendered Google results.
          // Note: abortController.abort() is called by the effect cleanup,
          // which will cancel the ongoing OSM fetch when the component unmounts
          // or a new request starts. requestIdRef checks prevent stale updates.
          let osmTimeoutId: ReturnType<typeof setTimeout> | undefined;
          try {
            const osmEnrichments = await Promise.race([
              fetchOsmEnrichments(
                location.lat,
                location.lng,
                effectiveRadiusKm * 1000,
                abortController.signal,
              ),
              new Promise<never>((_, reject) => {
                osmTimeoutId = setTimeout(
                  () => reject(new Error('OSM enrichment timed out')),
                  OSM_ENRICHMENT_TIMEOUT_MS,
                );
              }),
            ]);
            clearTimeout(osmTimeoutId);

            if (requestIdRef.current !== capturedRequestId) return;

            const enrichedLive = applyOsmEnrichments(capturedRankedLive, osmEnrichments);

            if (requestIdRef.current !== capturedRequestId) return;

            // Update the UI with enriched data and persist the enriched cache.
            setRestaurants(enrichRestaurantListCategories(enrichedLive));

            await saveNearbyRestaurantsSnapshot({
              location,
              restaurants: enrichedLive,
              searchRadiusKm: effectiveRadiusKm,
              openNowOnly,
              region: normalizedRegion,
              movementThresholdKm: cacheConfig.movementThresholdKm,
              ttlMs: cacheConfig.ttlMs,
              fetchedAtMs,
              categoriesKey,
            });
          } catch (osmError) {
            clearTimeout(osmTimeoutId);
            // OSM is additive; silently ignore so Google results remain.
            if (!(osmError instanceof DOMException && osmError.name === 'AbortError')) {
              console.warn('[osmEnrichment] Enrichment skipped:', osmError);
            }
          }
        })();
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
  }, [cacheConfig, categoriesKey, enabled, language, location, openNowOnly, radiusKm, region, selectedCategories]);

  return {
    restaurants,
    isLoading,
    error,
    source,
    shouldUseLocalFallback,
    lastSyncedAt,
  };
}
