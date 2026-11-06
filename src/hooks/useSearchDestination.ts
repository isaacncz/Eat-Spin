import { useEffect, useState } from 'react';
import type { SearchScope } from '@/lib/mallSearch';
import {
  DEFAULT_SEARCH_RADIUS, DESTINATION_TTL_MS, initialSearchRadius, loadSavedSearch, saveSearch,
  type SearchDestination, type SearchRadius,
} from '@/lib/searchDestination';

export function useSearchDestination() {
  const [saved] = useState(loadSavedSearch);
  const [destination, setDestination] = useState(saved.destination);
  const [pendingMallPlaceId, setPendingMallPlaceId] = useState(saved.pendingMallPlaceId);
  const [radiusKm, setRadiusKm] = useState<SearchRadius>(() => initialSearchRadius(saved.radiusKm));
  const [openNowOnly, setOpenNowOnly] = useState(true);
  useEffect(() => { saveSearch(destination, radiusKm, pendingMallPlaceId); }, [destination, radiusKm, pendingMallPlaceId]);
  // Expire coordinates even if the app stays open across the caching deadline.
  useEffect(() => {
    if (!destination) return;
    const expire = () => {
      if (Date.now() - destination.fetchedAt < DESTINATION_TTL_MS) return;
      if (destination.mallPlaceId && destination.scope !== 'around') setPendingMallPlaceId(destination.mallPlaceId);
      setDestination(null);
    };
    const timer = setInterval(expire, 60_000);
    window.addEventListener('focus', expire);
    return () => { clearInterval(timer); window.removeEventListener('focus', expire); };
  }, [destination]);
  const scope: SearchScope = destination?.mallPlaceId ? destination.scope ?? 'inside' : 'around';
  return { destination, radiusKm, scope, needsMallSelection: Boolean(pendingMallPlaceId), openNowOnly, setOpenNowOnly,
    setScope: (next: SearchScope) => setDestination((current) => current?.mallPlaceId ? { ...current, scope: next } : current),
    selectDestination: (next: SearchDestination) => { setPendingMallPlaceId(undefined); setDestination(next); },
    useCurrentLocation: () => { setPendingMallPlaceId(undefined); setDestination(null); },
    setRadiusKm: (next: SearchRadius) => setRadiusKm(next),
    resetRadius: () => setRadiusKm(DEFAULT_SEARCH_RADIUS) };
}
