import { useEffect, useRef, useState } from 'react';
import { refreshMallDestination } from '@/lib/googlePlacesDestinations';
import type { SearchScope } from '@/lib/mallSearch';
import {
  DEFAULT_SEARCH_RADIUS, DESTINATION_TTL_MS, initialSearchRadius, loadSavedSearch, saveSearch,
  type SearchDestination, type SearchRadius,
} from '@/lib/searchDestination';

export function useSearchDestination() {
  const [saved] = useState(loadSavedSearch);
  const [destination, setDestination] = useState(saved.destination);
  const [pendingMallPlaceId, setPendingMallPlaceId] = useState(saved.pendingMallPlaceId);
  const mallRefreshController = useRef<AbortController | null>(null);
  const [mallIdentityLoading, setMallIdentityLoading] = useState(Boolean(saved.destination?.mallPlaceId));
  useEffect(() => {
    if (!saved.destination?.mallPlaceId) return;
    const controller = new AbortController();
    mallRefreshController.current = controller;
    const original = saved.destination;
    void refreshMallDestination(original, controller.signal).then((refreshed) => {
      if (!controller.signal.aborted) setDestination((current) => current?.placeId === original.placeId
        ? { ...current, label: refreshed.label, address: refreshed.address } : current);
    }).catch(() => {
      // Keep exact-relationship results available if address rehydration fails.
    }).finally(() => { if (!controller.signal.aborted) setMallIdentityLoading(false); });
    return () => controller.abort();
  }, [saved]);
  const [radiusKm, setRadiusKm] = useState<SearchRadius>(() => initialSearchRadius(saved.radiusKm));
  const [openNowOnly, setOpenNowOnly] = useState(true);
  useEffect(() => { saveSearch(destination, radiusKm, pendingMallPlaceId); }, [destination, radiusKm, pendingMallPlaceId]);
  // Expire coordinates even if the app stays open across the caching deadline.
  useEffect(() => {
    if (!destination) return;
    const expire = () => {
      if (Date.now() - destination.fetchedAt < DESTINATION_TTL_MS) return;
      if (destination.mallPlaceId && destination.scope !== 'around') setPendingMallPlaceId(destination.mallPlaceId);
      mallRefreshController.current?.abort();
      setMallIdentityLoading(false);
      setDestination(null);
    };
    const timer = setInterval(expire, 60_000);
    window.addEventListener('focus', expire);
    return () => { clearInterval(timer); window.removeEventListener('focus', expire); };
  }, [destination]);
  const scope: SearchScope = destination?.mallPlaceId ? destination.scope ?? 'inside' : 'around';
  return { destination, radiusKm, scope, mallIdentityLoading, needsMallSelection: Boolean(pendingMallPlaceId), openNowOnly, setOpenNowOnly,
    setScope: (next: SearchScope) => setDestination((current) => current?.mallPlaceId ? { ...current, scope: next } : current),
    selectDestination: (next: SearchDestination) => { mallRefreshController.current?.abort(); setMallIdentityLoading(false); setPendingMallPlaceId(undefined); setDestination(next); },
    useCurrentLocation: () => { mallRefreshController.current?.abort(); setMallIdentityLoading(false); setPendingMallPlaceId(undefined); setDestination(null); },
    setRadiusKm: (next: SearchRadius) => setRadiusKm(next),
    resetRadius: () => setRadiusKm(DEFAULT_SEARCH_RADIUS) };
}
