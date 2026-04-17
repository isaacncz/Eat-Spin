/**
 * Geographic centroid & auto-radius calculation for MidSpin.
 *
 * Uses simple arithmetic mean of lat/lng — accurate enough for
 * city-scale distances (<50 km spread).
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6_371;
const MIN_RADIUS_M = 500;
const RADIUS_BUFFER_FACTOR = 1.2;

/** Haversine distance between two points in **metres**. */
export function haversineDistanceM(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);

  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinHalfLng * sinHalfLng;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1_000;
}

/**
 * Compute the geographic centroid (simple mean) of a set of points.
 * Returns `null` when the array is empty.
 */
export function computeCentroid(points: GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { lat: points[0].lat, lng: points[0].lng };

  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
}

/**
 * Compute a search radius (in metres) that covers all participants.
 *
 * Strategy: max distance from centroid to any participant × 1.2 buffer,
 * floored at 500 m so single-person / co-located groups still get results.
 */
export function computeAutoRadius(
  centroid: GeoPoint,
  points: GeoPoint[],
): number {
  if (points.length <= 1) return MIN_RADIUS_M;

  const maxDistance = points.reduce(
    (max, p) => Math.max(max, haversineDistanceM(centroid, p)),
    0,
  );

  return Math.max(MIN_RADIUS_M, Math.round(maxDistance * RADIUS_BUFFER_FACTOR));
}

/** Round lat/lng to 3 decimal places (~111 m precision) for privacy. */
export function fuzzyLocation(point: GeoPoint): GeoPoint {
  return {
    lat: Math.round(point.lat * 1_000) / 1_000,
    lng: Math.round(point.lng * 1_000) / 1_000,
  };
}
