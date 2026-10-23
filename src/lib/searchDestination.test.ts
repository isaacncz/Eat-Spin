import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrokenStorage, createMemoryStorage } from '@/test/memoryStorage';
import { DESTINATION_STORAGE_KEY, DESTINATION_TTL_MS, loadSavedSearch, radiusRectangle, saveSearch } from './searchDestination';

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
