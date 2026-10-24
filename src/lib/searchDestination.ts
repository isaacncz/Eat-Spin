import type { UserLocation } from '@/types';

export const DESTINATION_STORAGE_KEY = 'eatspin:search-destination:v1';
export const DESTINATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SEARCH_RADII = [1, 3, 5, 10] as const;
export type SearchRadius = typeof SEARCH_RADII[number];
export const DEFAULT_SEARCH_RADIUS: SearchRadius = 5;
/** Approximate travel time for each preset (straight line × 1.4 road detour; 5 km/h walk, 30 km/h urban drive). */
export const SEARCH_RADIUS_HINT: Record<SearchRadius, string> = {
  1: '🚶 ~15 min',
  3: '🚗 ~10 min',
  5: '🚗 ~15 min',
  10: '🚗 ~30 min',
};
const LEGACY_RANGE_MODE_KEY = 'eatspin:auto-range-mode';
const LEGACY_RANGE_TO_RADIUS: Record<string, SearchRadius> = { walk: 1, drive10: 5, drive20: 10 };

/** The radius a returning user gets before choosing one: their old walk/drive preset, else the default. */
export function initialSearchRadius(saved: SearchRadius | null): SearchRadius {
  if (saved) return saved;
  try {
    const legacy = localStorage.getItem(LEGACY_RANGE_MODE_KEY);
    if (legacy && LEGACY_RANGE_TO_RADIUS[legacy]) return LEGACY_RANGE_TO_RADIUS[legacy];
  } catch { /* storage unavailable */ }
  return DEFAULT_SEARCH_RADIUS;
}

/** The next wider preset, or null at the widest. */
export const nextWiderRadius = (radius: SearchRadius): SearchRadius | null =>
  SEARCH_RADII.find((r) => r > radius) ?? null;
export interface SearchDestination {
  placeId: string;
  label: string;
  address: string;
  coordinates: UserLocation;
  fetchedAt: number;
}
export interface SavedSearch {
  destination: SearchDestination | null;
  radiusKm: SearchRadius | null;
}
export const validCoordinates = (point: UserLocation): boolean =>
  Number.isFinite(point?.lat) && Math.abs(point.lat) <= 90 &&
  Number.isFinite(point?.lng) && Math.abs(point.lng) <= 180;

export function loadSavedSearch(): SavedSearch {
  const empty: SavedSearch = { destination: null, radiusKm: null };
  try {
    const raw = localStorage.getItem(DESTINATION_STORAGE_KEY);
    if (!raw) return empty;
    const saved = JSON.parse(raw);
    if (saved.version !== 1) { localStorage.removeItem(DESTINATION_STORAGE_KEY); return empty; }
    const radiusKm = SEARCH_RADII.includes(saved.radiusKm) ? saved.radiusKm as SearchRadius : null;
    const d = saved.destination;
    if (!d) return { destination: null, radiusKm };
    if (typeof d.placeId !== 'string' || !d.placeId.trim() || !validCoordinates(d.coordinates) ||
        !Number.isFinite(d.fetchedAt) || d.fetchedAt > Date.now() || Date.now() - d.fetchedAt >= DESTINATION_TTL_MS) {
      saveSearch(null, radiusKm);
      return { destination: null, radiusKm };
    }
    return { radiusKm, destination: { placeId: d.placeId, coordinates: d.coordinates,
      fetchedAt: d.fetchedAt, label: 'Saved destination', address: '' } };
  } catch { return empty; }
}

export function saveSearch(destination: SearchDestination | null, radiusKm: SearchRadius | null): void {
  try {
    // Places policy permits place IDs and coordinates (30 days), not cached names/addresses.
    localStorage.setItem(DESTINATION_STORAGE_KEY, JSON.stringify({ version: 1, radiusKm,
      destination: destination ? { placeId: destination.placeId, coordinates: destination.coordinates,
        fetchedAt: destination.fetchedAt } : null }));
  } catch { /* Selection still works when storage is unavailable. */ }
}

/** Bounding box on a sphere; near poles/date line fall back to circular bias. */
export function radiusRectangle(center: UserLocation, radiusKm: number) {
  const angle = radiusKm / 6371;
  const lat = center.lat * Math.PI / 180;
  const lowLat = lat - angle;
  const highLat = lat + angle;
  if (lowLat <= -Math.PI / 2 || highLat >= Math.PI / 2) return null;
  const deltaLng = Math.asin(Math.sin(angle) / Math.cos(lat)) * 180 / Math.PI;
  if (center.lng - deltaLng < -180 || center.lng + deltaLng > 180) return null;
  return { low: { latitude: lowLat * 180 / Math.PI, longitude: center.lng - deltaLng },
    high: { latitude: highLat * 180 / Math.PI, longitude: center.lng + deltaLng } };
}
