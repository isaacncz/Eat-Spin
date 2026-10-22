import { useState, useCallback, useRef, useEffect } from 'react';
import type { Restaurant } from '@/types';
import { searchPlacesByText } from '@/lib/googlePlacesTextSearch';

const DEBOUNCE_MS = 400;
const MAX_RECENT = 10;
const RECENT_KEY = 'eatspin:recent-searches';

export interface UseTextSearchOptions {
  location: { lat: number; lng: number } | null;
  radiusKm?: number;
}

export interface UseTextSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: Restaurant[];
  isLoading: boolean;
  error: string | null;
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

export function useTextSearch({ location, radiusKm }: UseTextSearchOptions): UseTextSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecent);

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
      setError(null);

      try {
        const restaurants = await searchPlacesByText({
          textQuery: trimmed,
          location,
          radiusKm,
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setResults(restaurants);

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
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    },
    [location, radiusKm],
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
    setError(null);
    abortRef.current?.abort();
  }, []);

  return { query, setQuery, results, isLoading, error, recentSearches, search, clearResults };
}
