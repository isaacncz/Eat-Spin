import { useEffect, useState } from 'react';
import { DESTINATION_TTL_MS, loadSavedSearch, saveSearch, type SearchDestination, type SearchRadius } from '@/lib/searchDestination';

export function useSearchDestination() {
  const [saved] = useState(loadSavedSearch);
  const [destination, setDestination] = useState(saved.destination);
  const [radiusKm, setRadiusKm] = useState(saved.radiusKm);
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
    selectDestination: (next: SearchDestination) => { setDestination(next); setRadiusKm((r) => r ?? 3); },
    useCurrentLocation: () => setDestination(null),
    setRadiusKm: (next: SearchRadius | null) => setRadiusKm(next) };
}
