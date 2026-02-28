# Replace Km Slider With 3 Range Options (Walking / 10-min Drive / 20-min Drive)

## Summary
- Remove the kilometer slider from auto mode UI.
- Replace it with 3 intent-based options:
1. Walking distance
2. 10 minutes driving range
3. 20 minutes driving range
- Use approximate-radius mapping (no extra route-time API calls).
- Keep wheel cap at 12 restaurants per spin round.
- Keep existing filters (category, non-halal, price) and preserve current source semantics (`google-live`, `google-cache`, `local-fallback`).
- Default to 10-minute drive and remember last selected option in `localStorage`.

## Decisions Locked
- Time model: approximate radius.
- Range preset: balanced.
- Mapping:
1. Walking distance = `1.2 km`
2. 10-min drive = `6 km`
3. 20-min drive = `12 km`
- Wheel count policy: max 12.
- Default behavior: initialize with 10-min drive; persist and restore last selected option.

## Implementation Plan

## 1) State model and persistence in App orchestration
- File: `src/App.tsx`
- Replace direct user-facing `radiusKm` control state with:
1. `rangeMode: 'walk' | 'drive10' | 'drive20'`
2. Derived `radiusKm` from a constant map.
- Add storage key, for example `eatspin:auto-range-mode`.
- On initial mount:
1. Read stored mode if valid.
2. Fallback to `'drive10'`.
- On mode change:
1. Persist selected mode.
2. Reset round-specific wheel state exactly as current radius change flow does (`showWheelSection`, `wheelRestaurants`, removed IDs, pending removal, `autoWheelKey` bump).

## 2) Replace slider UI with 3-option selector
- File: `src/App.tsx` (auto panel where slider currently exists).
- Remove:
1. `<input type="range" ... />`
2. The 1/10/20 km legend.
- Add a 3-button segmented control using existing button/chip visual language:
1. Walking distance
2. 10 min drive
3. 20 min drive
- Active button style should match existing selected filter chip style.
- Keep the status text, but change label from raw km phrasing to range label.
Example: `Search range: 10 min drive`.

## 3) Keep nearby hook contract, pass derived radius
- Files: `src/App.tsx`, `src/hooks/useNearbyRestaurants.ts`
- Do not add new public hook params.
- Continue passing numeric `radiusKm` into `useNearbyRestaurants`.
- Because cache key already includes `searchRadiusKm`, each option naturally gets separate cached snapshots.

## 4) Ensure result count is not artificially fixed at 12 outside the wheel
- File: `src/hooks/useNearbyRestaurants.ts`
- Keep ranked nearby list up to current API/ranking cap (currently 20), not 12.
- Keep cache minimum threshold behavior (`minResults=12`) unchanged unless explicitly requested.
- Wheel spin remains 12 max by current shuffle logic in `App.tsx`.

## 5) Filter behavior (including price filter) with new range options
- Files: `src/lib/restaurantUtils.ts`, `src/lib/googlePlacesRestaurants.ts`, `src/types/index.ts` (already aligned with current direction).
- Filter order remains:
1. Range-based candidate set (from selected mode/radius)
2. Category filter
3. Price filter
4. Non-halal filter
5. Distance sort
- Price filter policy:
1. If no price filter selected: include restaurants regardless of known/unknown Google price level.
2. If price filter selected: include only restaurants with known mapped price bucket that matches selected chips.
- This avoids false positives from unknown Google price levels.

## 6) Copy and docs alignment
- Files: `README.md`, `docs/GOOGLE_NEARBY_CACHE_PLAN.md`
- Update wording from km slider model to 3-option range model.
- Keep caching/ranking/fallback docs consistent with implementation:
1. Range presets
2. Remembered default behavior
3. Wheel still capped at 12 per spin

## Important Public API / Interface Changes
- No external API endpoints changed.
- No env var contract changes.
- Internal UI state contract in `App.tsx` changes from free-range slider input to enum-like range mode.
- Existing type extension for price certainty (`hasKnownPriceRange`) remains part of restaurant filtering behavior.

## Test Cases and Scenarios

## Functional
1. Auto mode shows 3 range options and no slider.
2. Default first-time selection is 10-min drive.
3. User changes to walking; reload restores walking.
4. Switching between walking/10/20 updates result set and match count.
5. Wheel still spins max 12 entries even when match list is >12.
6. Round review list shows larger candidate pool (not fixed at 12 when available).

## Cache behavior
1. Each range mode uses distinct cache snapshots (radius-based keys).
2. Returning user with same mode/location uses cache before live call.
3. Expired snapshot forces live refresh as before.

## Filter behavior
1. Category filter still narrows candidates correctly in each range mode.
2. Non-halal toggle still behaves identically.
3. Price filter excludes unknown-price restaurants only when price chips are active.
4. With no price filter, unknown-price restaurants remain eligible.

## Regression
1. Manual mode unchanged.
2. Firebase group spin flow unchanged.
3. Source banner still displays correct source states.
4. Build and lint command outputs are captured; note existing repo-wide lint baseline issues unrelated to this change.

## Assumptions and Defaults
- “Driving minutes” are approximation-only via radius, not real-time traffic or route duration.
- Balanced preset is acceptable globally for this product stage.
- Persisting user selection in local storage is desired UX.
- Wheel readability remains a priority, so spin round max stays 12.
