import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrokenStorage, createMemoryStorage } from '@/test/memoryStorage';
import { DEFAULT_SEARCH_RADIUS, DESTINATION_STORAGE_KEY, DESTINATION_TTL_MS, initialSearchRadius, loadSavedSearch, nextWiderRadius, radiusRectangle, saveSearch } from './searchDestination';

beforeEach(() => vi.stubGlobal('localStorage', createMemoryStorage()));
afterEach(() => vi.unstubAllGlobals());
const destination = { placeId: 'kiara', label: 'Mont Kiara', address: 'Kuala Lumpur', coordinates: { lat: 3.17, lng: 101.65 }, fetchedAt: Date.now() };
describe('destination persistence', () => {
  it('restores center/radius without persisting Google labels, address or tokens', () => {
    saveSearch(destination, 3);
    const raw = localStorage.getItem(DESTINATION_STORAGE_KEY)!;
    expect(raw).not.toContain('Mont Kiara');
    expect(raw).not.toContain('Kuala Lumpur');
    expect(loadSavedSearch()).toEqual({ radiusKm: 3, destination: { ...destination, label: 'Saved destination', address: '' } });
    saveSearch(null, 3);
    expect(loadSavedSearch()).toEqual({ radiusKm: 3, destination: null });
  });
  it('purges expired or invalid coordinates and preserves radius preference', () => {
    saveSearch({ ...destination, fetchedAt: Date.now() - DESTINATION_TTL_MS }, 5);
    expect(loadSavedSearch()).toEqual({ radiusKm: 5, destination: null });
    expect(localStorage.getItem(DESTINATION_STORAGE_KEY)).not.toContain('kiara');
    saveSearch({ ...destination, coordinates: { lat: 100, lng: 0 } }, 3);
    expect(loadSavedSearch().destination).toBeNull();
  });
  it('fails safely with malformed or unavailable storage', () => {
    localStorage.setItem(DESTINATION_STORAGE_KEY, '{');
    expect(loadSavedSearch().destination).toBeNull();
    vi.stubGlobal('localStorage', createBrokenStorage({ read: true, write: true }));
    expect(() => saveSearch(destination, 3)).not.toThrow();
    expect(loadSavedSearch()).toEqual({ radiusKm: null, destination: null });
  });
});
it('bounds a circle and falls back at the date line and poles', () => {
  const box = radiusRectangle(destination.coordinates, 3)!;
  expect(box.low.latitude).toBeLessThan(3.17);
  expect(box.high.latitude).toBeGreaterThan(3.17);
  expect(box.low.longitude).toBeLessThan(101.65);
  expect(radiusRectangle({ lat: 90, lng: 0 }, 3)).toBeNull();
  expect(radiusRectangle({ lat: 0, lng: 179.999 }, 3)).toBeNull();
});

describe('single radius preset', () => {
  it('keeps a saved radius, else maps the old walk/drive preset, else defaults to 5 km', () => {
    expect(initialSearchRadius(3)).toBe(3);
    expect(initialSearchRadius(null)).toBe(DEFAULT_SEARCH_RADIUS);
    localStorage.setItem('eatspin:auto-range-mode', 'walk');
    expect(initialSearchRadius(null)).toBe(1);
    localStorage.setItem('eatspin:auto-range-mode', 'drive20');
    expect(initialSearchRadius(null)).toBe(10);
    localStorage.setItem('eatspin:auto-range-mode', 'nonsense');
    expect(initialSearchRadius(null)).toBe(5);
  });
  it('steps to the next wider preset and stops at 10 km', () => {
    expect(nextWiderRadius(1)).toBe(3);
    expect(nextWiderRadius(5)).toBe(10);
    expect(nextWiderRadius(10)).toBeNull();
  });
  it('falls back to the default when storage throws', () => {
    vi.stubGlobal('localStorage', createBrokenStorage());
    expect(initialSearchRadius(null)).toBe(5);
  });
});
