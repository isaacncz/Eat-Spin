# Cost-First Nearby Restaurant Caching (Single Call Pool + Exclusive Drive Bands)

## Summary
- Lock Google fetch strategy to one Nearby call per cache miss, then reuse local cache for repeated spins.
- Always fetch at the widest radius for the selected mode; filter down to the display band in-app.
- Keep 3 range options with non-overlap defaults:
  - Walking: `0–1.2 km`
  - 10-min drive: `>1.2–6 km`
  - 20-min drive: `>6–12 km`
- If a driving band is sparse, auto-expand inward using the existing pool — no additional API call.
- Wheel spins with whatever is available if pool is under 12 after full expansion; show contextual message.
- Keep wheel cap at 12 per spin.
- Set cache TTL default to 7 days.
- Always send `POPULARITY` rank preference to Google for all modes; local re-sort handles display order.
- Keep current filter semantics and source labels.

## API Constraint (Locked)
- Places Nearby Search (New) allows `maxResultCount` up to 20 per request.
- Nearby Search (New) does not expose pagination.
- Therefore, always set `maxResultCount: 20` explicitly; cap normalization output at 20 defensively.

## Fetch and Pool Strategy
- Fetch radius equals the mode's outer bound: `walk` → 1.2 km, `drive10` → 6 km, `drive20` → 12 km.
- The full fetched pool (up to 20) is cached at the fetch radius, not the display band.
- Distance band filtering is applied client-side from the cached pool.
- Cache keys include `searchRadiusKm`, so `walk` / `drive10` / `drive20` evaluate against separate snapshot entries even at the same location.
- Sparse expansion iterates over the same pool — no additional Google call.
- `rankPreference` is always `POPULARITY` for all modes. Local re-sort (rating desc → review count desc → distance asc) determines display order.

## Filter Design

### Filter order (UI and logic)
```
Range mode  →  Category  →  Halal-friendly  →  Price
```

### Halal filter
- Toggle label: **"Halal-friendly only"** (not "Halal certified").
- Off (default): include all restaurants including likely non-halal.
- On: exclude restaurants flagged by the non-halal heuristic.
- Caveat shown beneath the toggle: _"Based on name and category signals — not a certified halal guarantee."_

### Price filter
- Use icon chips: `$`, `$$`, `$$$`, `$$$$` — no chip selected means no price filter (show all).
- Multi-select: selecting `$` and `$$` shows only places in those two tiers.
- When chips are active, restaurants with unknown price are excluded. Footnote shown: _"Some places may not appear if Google hasn't mapped their price tier."_

### Empty state
- Zero results after all filters: show _"No matches — try clearing a filter."_
- Highlight the most-likely culprit filter (price or halal when either is active).

## Exclusive Band Filtering with Sparse Auto-Expand
- Filter order (applied to cached pool):
  1. Category
  2. Price
  3. Halal-friendly
  4. Distance band
- Sparse expansion behavior (uses existing pool, no new fetch):
  - `walk`: strict `0–1.2 km`, no expansion.
  - `drive10`: `>1.2–6 km` → expand to `0–6 km` if under 12.
  - `drive20`: `>6–12 km` → expand to `>1.2–12 km` → expand to `0–12 km` if still under 12.
- If pool is still under 12 after full expansion: spin with available results. Show: _"X nearby spots found — try a wider range for more options."_

## Config
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_PLACES_REGION=MY`
- `VITE_NEARBY_CACHE_TTL_DAYS=7` (default 7 days; override via env)
- `VITE_NEARBY_CACHE_MIN_RESULTS=12`
- `VITE_NEARBY_CACHE_MOVEMENT_THRESHOLD_KM=0.1`
- `VITE_NEARBY_CACHE_AREA_KM=0.1` (legacy fallback alias)

## Defaults Locked
- Open-now only.
- Region: MY.
- Minimum cache size: 12.
- Movement refresh threshold: 0.1 km (100m).
- Range presets: walking 1.2 km, 10-min drive 6 km, 20-min drive 12 km.
- Default range preset: 10-min drive, with last selected preset persisted in localStorage.
- Geohash strategy: precision 6 + 8-neighbor lookup.
- Ranking policy: POPULARITY (Google-side); local re-sort by rating desc → review count desc → distance asc.
- Force resync: 7 days (default).

## Migration Note
- Cache schema version bump (2 → 3) invalidates all existing user caches on first deploy.
- Every active user triggers a live Google call on next app open. One-time cost spike — expected and acceptable.

