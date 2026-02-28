# Cost-First Nearby Strategy (Single Call Pool + Exclusive Drive Bands)

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
- Therefore, "100 in one Nearby call" is not possible.
- Always set `maxResultCount: 20` explicitly; cap normalization output at 20 defensively.

Sources:

- https://developers.google.com/maps/documentation/places/web-service/nearby-search
- https://developers.google.com/maps/documentation/places/web-service/reference/rpc/google.maps.places.v1#searchnearbyrequest

## Fetch and Pool Strategy

- Fetch radius equals the mode's outer bound: `walk` → 1.2 km, `drive10` → 6 km, `drive20` → 12 km.
- The full fetched pool (up to 20) is cached at the fetch radius, not the display band.
- Distance band filtering is applied client-side from the cached pool.
- Sparse expansion iterates over the same pool — no additional Google call.
- `rankPreference` is always `POPULARITY` for all modes. This shapes which 20 places Google selects. Local re-sort (rating desc → review count desc → distance asc) determines display order.
- Dropping per-mode rank switching eliminates the double-cache problem and simplifies the cache key.

## Implementation Plan

### 1. Extract range-mode state to `src/hooks/useRangeMode.ts`

- Own localStorage persistence, default (`drive10`), and the per-mode config object.
- Per-mode config shape: `{ fetchRadiusKm, minDistanceKm, maxDistanceKm, label }`.
- Expose `rangeMode`, `setRangeMode`, and `rangeModeConfig`.
- `src/App.tsx` reads from this hook only; no range logic in `App.tsx`.
- Keep existing wheel reset behavior when mode changes.

### 2. Update `src/lib/googlePlacesRestaurants.ts`

- Remove `rankPreference` parameter; hardcode `POPULARITY` internally.
- Always set `maxResultCount: 20` explicitly.
- Cap normalization output at 20 entries defensively after response parsing.

### 3. Update cache key/schema in `src/lib/nearbyCache.ts`

- Remove `rankPreference` from snapshot record and cache key — it is no longer variable.
- Bump cache schema version to invalidate old snapshots.
- Keep geohash precision and neighbor lookup strategy unchanged.
- **Migration cost note:** schema version bump invalidates all existing user caches on first deploy. Every active user triggers a live Google call on next app open. One-time cost spike — expected and acceptable.

### 4. Keep single-call pool logic in `src/hooks/useNearbyRestaurants.ts`

- One live Nearby request when cache is missing, expired, or below minimum.
- Pool cap at 20 (not 12).
- Change default fallback TTL from 30 to 7 days while preserving `VITE_NEARBY_CACHE_TTL_DAYS` override.
- Accept `fetchRadiusKm` from `useRangeMode` config; do not derive radius internally.
- When `rangeMode` changes, re-evaluate cache validity for the new radius and fetch if no valid cache exists.

### 5. Apply exclusive band filtering with sparse auto-expand in `src/lib/restaurantUtils.ts`

- Filter order (applied to the cached pool):
  1. Category
  2. Price
  3. Non-halal
  4. Distance band
- Sparse expansion behavior (uses existing pool, no new fetch):
  - `walk`: strict `0–1.2 km`, no expansion.
  - `drive10`: `>1.2–6 km` → expand to `0–6 km` if under 12.
  - `drive20`: `>6–12 km` → expand to `>1.2–12 km` → expand to `0–12 km` if still under 12.
- If pool is still under 12 after full expansion: spin with available results. Show: _"X nearby spots found — try a wider range for more options."_
- Filter function returns `{ results: Restaurant[], expanded: boolean, expandedLabel?: string }` so UI can render expansion status without additional logic.

### 6. Filter behavior (clarified)

- **Price chips active:** include only restaurants with a known mapped Google price bucket matching a selected chip. Restaurants with unknown/unmapped price are excluded.
- **No price chips active:** include all restaurants regardless of price data availability.
- **Halal filter:** see Filter Design section below.
- No change to category logic.

### 7. Update docs

- Edit `README.md` and `docs/GOOGLE_NEARBY_CACHE_PLAN.md`.
- Document single-call pool, fetch-at-widest-radius strategy, exclusive bands, sparse expansion, unified POPULARITY ranking, and 7-day default TTL.
- Remove stale slider wording.

## Filter Design

### Recommended filter order (UI and logic)

```
Range mode  →  Category  →  Halal  →  Price
```

- **Range** is a top-level control, not a filter — it sets the fetch and pool scope.
- **Category** narrows food type first (highest intent signal).
- **Halal** is a safety/preference filter applied after category.
- **Price** acts last on the already-narrowed set.

### Halal filter

- The filter is heuristic-based, not authoritative. Label it: **"Halal-friendly only"** (not "Halal certified").
- Toggle behavior:
  - Off (default): include all restaurants including likely non-halal.
  - On: exclude restaurants flagged by the non-halal heuristic.
- Show a one-line caveat beneath the toggle: _"Based on name and category signals — not a certified halal guarantee."_
- Never label the toggle "Exclude non-halal" — users think in "I want halal" not "I don't want non-halal."

### Price filter

- Use icon chips: `$`, `$$`, `$$$`, `$$$$` — no chip selected means no price filter (show all).
- Multi-select: selecting `$` and `$$` shows only places in those two tiers.
- When chips are active, restaurants with unknown price are excluded. Show footnote: _"Some places may not appear if Google hasn't mapped their price tier."_
- Do not add an "Unknown price" chip — adds complexity without UX value.
- **Coverage warning:** Google `priceLevel` is sparsely populated for Malaysian restaurants. Verify coverage against local data before making price chips a prominent UI element.

### Empty state behavior

- Zero results after all filters: show _"No matches — try clearing a filter."_
- Highlight the most-likely culprit filter (price or halal when either is active).
- Do not auto-clear filters silently.

## Important Public API / Interface / Type Changes

- `fetchNearbyGoogleRestaurants`: remove `rankPreference` parameter; hardcode `POPULARITY` internally.
- `useNearbyRestaurants` options: remove `rankPreference`; add `fetchRadiusKm` from range mode config.
- IndexedDB snapshot record: remove `rankPreference` field.
- `useRangeMode` hook is new — owns range state and localStorage persistence.
- `src/lib/restaurantUtils.ts` filter function returns `{ results, expanded, expandedLabel }` instead of `Restaurant[]`.
- No external endpoint changes.
- No env var key changes.
- Default TTL behavior changes when env is unset: 30 days → 7 days.

## Test Cases and Scenarios

- Range mode shows 3 options and no km slider.
- Default mode remains 10-min drive and restores from localStorage.
- Walk mode only shows `≤1.2 km` results; no expansion.
- Drive10 and Drive20 initially exclude nearer bands; auto-expand from existing pool when sparse.
- Expansion status text appears when band is expanded.
- Wheel spins with <12 results and shows count message when pool is fully exhausted.
- Wheel caps at 12 entries when candidate list is larger.
- First call after miss/expiry uses `google-live`; later same-context usage uses `google-cache`.
- Cache expiry at 7+ days triggers refresh.
- Switching range mode triggers re-evaluation; fetches if no valid cache exists for new radius.
- Price filter excludes unknown-price entries only when chips are selected; footnote is visible.
- Halal toggle excludes heuristic non-halal entries; caveat text is visible.
- Zero-result state shows "No matches" message without auto-clearing filters.
- Manual mode and Firebase group spin flows remain unchanged.
- Build/lint results are recorded; any pre-existing lint baseline issues are noted separately.

## Assumptions and Defaults

- “Single Call Pool” means one Nearby API call per cache miss, not one call forever.
- Cost control is prioritized over maximum variety.
- Driving time labels remain radius approximations, not traffic-aware route times.
- Sparse expansion never triggers a new API call — operates on the cached pool only.
- Halal filter is heuristic only; the app makes no certification claim.
- If future requirement is true 60–100 cached pool, strategy must move to multi-call warmup and this plan will be replaced.
