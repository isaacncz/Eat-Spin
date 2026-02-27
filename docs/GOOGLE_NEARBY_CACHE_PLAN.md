# Local-First Nearby Restaurant Caching (IndexedDB + Monthly Sync)

## Summary
- Load nearby restaurants from IndexedDB first.
- Skip Google API if cache is valid and has at least 12 restaurants.
- Call Google only when cache is missing, expired (30 days), or has fewer than 12 restaurants.
- Force monthly resync (30-day TTL).
- Keep ranked nearby results (up to API limit) for filtering and review, while roulette still spins a 12-restaurant round.
- Keep static local dataset as failure fallback.

## Storage Design
- In-memory cache for current session.
- IndexedDB for persistent cache.
- localStorage only for small metadata (`schema version`, `last cleanup`).

## IndexedDB Schema
### Store: `snapshots` (keyPath: `snapshotKey`)
- `snapshotKey`: hash(areaKey + queryKey)
- `areaGeohash`: string (geohash precision 6 of snapshot center)
- `areaNeighborGeohashes`: string[] (8 neighboring geohash cells)
- `centerLat`, `centerLng`
- `areaRadiusKm`: 2
- `searchRadiusKm`
- `openNowOnly`: true
- `region`: "MY"
- `placeIds`: string[]
- `restaurantCount`: number
- `rankStrategy`: `rating_desc_reviewCount_desc_distance_asc`
- `fetchedAt`: epoch ms
- `expiresAt`: epoch ms (`fetchedAt + 30 days`)

### Store: `places` (keyPath: `placeId`)
- `placeId`: string
- `restaurant`: normalized `Restaurant`
- `updatedAt`: epoch ms
- `expiresAt`: epoch ms

## Cache Key Rules
- Key dimensions: `geohash6(currentLocation)` + search radius + openNow + region + schema version.
- Snapshot lookup checks current geohash plus its 8 neighbors to improve cache hit near cell edges.
- "Same area" still requires current user location to be within 2 km of snapshot center.

## Ranking and Top-12 Policy
- Candidate pool is nearby, open-now restaurants from Google Places.
- Keep only restaurants within 2 km from the current user position.
- Sort candidates by:
  1. `rating` descending
  2. `userRatingCount` descending (tie-breaker)
  3. `distance` ascending (final tie-breaker)
- Persist and render ranked nearby restaurants up to API response limits.
- If fewer than 12 pass filters, store and render available results, and trigger Google refresh when cache is reused and still below 12.

## Read Flow (Local-First)
1. Get user location.
2. Compute `geohash6` and find valid snapshot in current geohash or neighbor geohashes.
3. If unexpired and count >= 12, load places from IndexedDB and render.
4. Do not call Google.

## Refresh Flow (Google Call)
Call Google only when:
- no snapshot in 2 km area, or
- snapshot expired (>= 30 days), or
- cached count < 12.

After fetch:
1. Normalize Google places to existing `Restaurant` shape.
2. Rank candidates using `rating desc -> userRatingCount desc -> distance asc`.
3. Keep ranked results up to API response limits.
4. Upsert `places`.
5. Upsert `snapshot`.
6. Render results.

## Failure Flow
- If Google fails, use unexpired cache if available.
- Else use static local dataset.
- Show source banner:
  - `Cached nearby results`
  - `Live Google nearby results`
  - `Local fallback results`

## Cleanup
- Run cleanup every 24h app-open:
  - remove expired snapshots,
  - remove expired places not referenced by non-expired snapshots.

## Files to Add/Update
- `src/lib/nearbyCache.ts`
- `src/lib/googlePlacesRestaurants.ts`
- `src/hooks/useNearbyRestaurants.ts`
- `src/types/index.ts`
- `src/App.tsx`
- `.env.example`
- `README.md`

## Config
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_PLACES_REGION=MY`
- `VITE_NEARBY_CACHE_TTL_DAYS=30`
- `VITE_NEARBY_CACHE_MIN_RESULTS=12`
- `VITE_NEARBY_CACHE_AREA_KM=2`

## Defaults Locked
- Open-now only.
- Region: MY.
- Minimum cache size: 12.
- Area threshold: 2 km.
- Geohash strategy: precision 6 + 8-neighbor lookup.
- Ranking policy: highest-rated nearby first (rating, then review count, then distance).
- Force resync: 30 days.
