import { useState, useCallback, useRef, useEffect } from 'react';
import type { Restaurant } from '@/types';
import type { MallIdentity } from '@/lib/mallSearch';
import { searchCravingPlaces } from '@/lib/cravingSearch';
import type { SearchIntent } from '@/lib/searchIntent';

const DEBOUNCE_MS = 400;
const MAX_RECENT = 10;
const RECENT_KEY = 'eatspin:recent-searches';

export interface UseTextSearchOptions {
  mallPlaceId?: string;
  mallIdentity?: MallIdentity;
  location: { lat: number; lng: number } | null;
  radiusKm?: number;
  openNowOnly?: boolean;
}

export interface UseTextSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: Restaurant[];
  isLoading: boolean;
  error: string | null;
  /** Place-type intent of the shown results, e.g. cafés for "coffee". */
  intent: SearchIntent | null;
  /** True when weaker matches were added after the confident ones. */
  broadened: boolean;
  recentSearches: string[];
  search: (text: string) => void;
  clearResults: () => void;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(searches: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
  } catch { /* quota exceeded — ignore */ }
}

export function useTextSearch({ location, radiusKm, openNowOnly = true, mallPlaceId, mallIdentity }: UseTextSearchOptions): UseTextSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{ intent: SearchIntent | null; broadened: boolean }>({ intent: null, broadened: false });
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);

  const searchKey = `${location?.lat},${location?.lng}|${radiusKm}|${openNowOnly}|${mallPlaceId ?? 'around'}|${JSON.stringify(mallIdentity)}`;
  const [resolvedKey, setResolvedKey] = useState(searchKey);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const executeSearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !location) { setIsLoading(false); return; }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setResolvedKey(searchKey);
      setError(null);

      try {
        const { restaurants, intent, broadened } = await searchCravingPlaces({
          textQuery: trimmed,
          location,
          radiusKm,
          mallPlaceId,
          mallIdentity,
          openNowOnly,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setResults(restaurants);
          setMatch({ intent, broadened });
          setResolvedKey(searchKey);

          // Save to recent
          setRecentSearches((prev) => {
            const updated = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
            saveRecent(updated);
            return updated;
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
          setMatch({ intent: null, broadened: false });
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [location, radiusKm, openNowOnly, mallPlaceId, mallIdentity, searchKey],
  );

  const search = useCallback(
    (text: string) => {
      setQuery(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
      setIsLoading(false);
      if (!text.trim()) {
        setResults([]);
        setMatch({ intent: null, broadened: false });
        setError(null);
        return;
      }
      timerRef.current = setTimeout(() => executeSearch(text), DEBOUNCE_MS);
    },
    [executeSearch],
  );

  const clearResults = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsLoading(false);
    setQuery('');
    setResults([]);
    setMatch({ intent: null, broadened: false });
    setError(null);
    abortRef.current?.abort();
  }, []);

  useEffect(() => {
    clearResults();
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [location, radiusKm, openNowOnly, mallPlaceId, clearResults]);

  const current = resolvedKey === searchKey;
  return { query, setQuery, results: current ? results : [], isLoading, error: current ? error : null, intent: current ? match.intent : null, broadened: current && match.broadened, recentSearches, search, clearResults };
}
