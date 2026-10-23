import { useEffect, useState } from 'react';
import {
  DEFAULT_SEARCH_RADIUS, DESTINATION_TTL_MS, initialSearchRadius, loadSavedSearch, saveSearch,
  type SearchDestination, type SearchRadius,
} from '@/lib/searchDestination';

export function useSearchDestination() {
  const [saved] = useState(loadSavedSearch);
  const [destination, setDestination] = useState(saved.destination);
  const [radiusKm, setRadiusKm] = useState<SearchRadius>(() => initialSearchRadius(saved.radiusKm));
  const [openNowOnly, setOpenNowOnly] = useState(true);
  useEffect(() => { saveSearch(destination, radiusKm); }, [destination, radiusKm]);
  // Expire coordinates even if the app stays open across the caching deadline.
  useEffect(() => {
    if (!destination) return;
    const expire = () => { if (Date.now() - destination.fetchedAt >= DESTINATION_TTL_MS) setDestination(null); };
    const timer = setInterval(expire, 60_000);
    window.addEventListener('focus', expire);
    return () => { clearInterval(timer); window.removeEventListener('focus', expire); };
  }, [destination]);
  return { destination, radiusKm, openNowOnly, setOpenNowOnly,
    selectDestination: (next: SearchDestination) => setDestination(next),
    useCurrentLocation: () => setDestination(null),
    setRadiusKm: (next: SearchRadius) => setRadiusKm(next),
    resetRadius: () => setRadiusKm(DEFAULT_SEARCH_RADIUS) };
}
