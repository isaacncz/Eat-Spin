import { isDiningVenueKind } from '@/lib/placeEligibility';
import type { Restaurant } from '@/types';

export type SearchScope = 'inside' | 'around';
export interface MallIdentity { placeId: string; label: string; address: string }

/** Candidate discovery area, never evidence of mall membership. */
export const MALL_DISCOVERY_RADIUS_KM = 2;
export const MALL_MEMBERSHIP_VERSION = 3;

const normalizeAddress = (value: string) => value.normalize('NFKC').toLowerCase()
  .replace(/\bjln\b/g, 'jalan').replace(/\brd\b/g, 'road')
  .replace(/[^\p{L}\p{N}/]+/gu, ' ').trim().replace(/\s+/g, ' ');
const buildingName = (value: string) => normalizeAddress(value)
  .replace(/\s+(?:shopping mall|shopping centre|shopping center|mall)$/, '');
const containsPhrase = (text: string, phrase: string) => (` ${text} `).includes(` ${phrase} `);

/** Address evidence must identify the mall building, not merely its vicinity. */
export function matchesMallAddress(address: string, mall: MallIdentity): boolean {
  const tenant = normalizeAddress(address);
  const name = buildingName(mall.label);
  const buildingNamed = address.split(',').some((part) => {
    const building = buildingName(part);
    return building === name || building.endsWith(` ${name}`);
  });
  if (!mall.address.trim() || name.length < 5 || !buildingNamed) return false;
  // These may share the mall's name, postcode and street without being mall tenants.
  if (/\b(near|nearby|opposite|beside|behind|hotel|resort|residences?|tower|annex)\b/.test(tenant)) return false;
  const hasUnit = /\b(?:lot|unit|suite|shop)\s+[a-z\d]+\b|\b(?:lg|g|f|l|b)\d*\s+\d+[a-z]?\b|\b(?:lower ground|ground floor|first floor|second floor|level \d+)\b/.test(tenant);
  const base = normalizeAddress(mall.address);
  const postcode = base.match(/\b\d{5}\b/)?.[0];
  const tenantPostcode = tenant.match(/\b\d{5}\b/)?.[0];
  if (postcode && tenantPostcode && postcode !== tenantPostcode) return false;
  // A full road name plus postcode is useful when a tenant omits its lot number.
  const street = mall.address.split(',').map(normalizeAddress)
    .find((part) => /\b(jalan|road|street|avenue|persiaran|lebuh)\b/.test(part));
  const sameBase = Boolean(postcode && street && street.length >= 8 && containsPhrase(tenant, street) && containsPhrase(tenant, postcode));
  return hasUnit || sameBase;
}

/** Unknown or contradictory relationships never qualify through proximity alone. */
export function filterMallRestaurants(restaurants: Restaurant[], mallPlaceId?: string, mall?: MallIdentity): Restaurant[] {
  if (!mallPlaceId) return restaurants;
  return restaurants.filter((restaurant) => {
    if (restaurant.source === 'local-fallback' || !isDiningVenueKind(restaurant.venueKind)) return false;
    if (restaurant.containingPlaceIds?.includes(mallPlaceId)) return true;
    if (restaurant.containingPlaceIds?.length) return false;
    return mall?.placeId === mallPlaceId && matchesMallAddress(restaurant.address ?? '', mall);
  });
}
