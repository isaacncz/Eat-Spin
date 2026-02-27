# Workflows

## Workflow A: UI or Section Change With Minimal Orchestration Impact
1. Identify owning section/component from `project-map.md`.
2. Keep behavior logic in existing hooks/libs; avoid introducing new business logic inside presentational sections.
3. Apply style/token updates through `src/index.css` variables and existing class conventions.
4. Touch `src/App.tsx` only when wiring new props/state is unavoidable.
5. Validate with lint/build plus targeted manual visual checks.

## Workflow B: Filtering and Roulette Behavior Changes
1. Start in `src/lib/restaurantUtils.ts` for distance/category/price/non-halal filtering rules.
2. Update orchestration wiring in `src/App.tsx` only for state plumbing and UI triggers.
3. If behavior affects fetched nearby data, verify `useNearbyRestaurants` composition and source/fallback handling.
4. Keep ranking order and source labels stable unless explicitly changing those contracts.
5. Validate with manual round flow: filter changes, shuffle, spin, removal, and reset.

## Workflow C: Google Nearby + IndexedDB Cache Changes
1. Define intended policy change first: lookup key, TTL, threshold, ranking, fallback, or cleanup.
2. Update cache mechanics in `src/lib/nearbyCache.ts`.
3. Update API normalization/ranking in `src/lib/googlePlacesRestaurants.ts` if payload mapping changes.
4. Update fetch orchestration in `src/hooks/useNearbyRestaurants.ts` for read/refresh/failure transitions.
5. Update `.env.example` and `README.md` if env contracts or operator expectations change.
6. Validate source banners and fallback behavior in app UI.

## Workflow D: Firebase Group Room Lifecycle and Permission Changes
1. Start with permission and state-machine intent: host/co-host/member actions, room expiry, spin lifecycle.
2. Update behavior in `src/hooks/useFirebaseGroupRoom.ts`.
3. Update Firebase initialization errors or env handling in `src/lib/firebase.ts` only if needed.
4. Update section UX in `src/sections/GroupSpin.tsx` for new actions/messages.
5. Update `docs/firebase-rtdb-rules.json` if server-side rule semantics need to change.
6. Validate create/join/sync/spin/leave flows with host and non-host roles.

## Workflow E: Data Model Changes in `src/types/index.ts`
1. Change the shared type shape in `src/types/index.ts`.
2. Propagate to core producers/consumers in this order:
   - `src/lib/googlePlacesRestaurants.ts`
   - `src/lib/nearbyCache.ts`
   - `src/lib/restaurantUtils.ts`
   - `src/hooks/useNearbyRestaurants.ts`
   - `src/App.tsx` and relevant UI components/sections
3. Update static data validators in `src/data/restaurants.ts` if restaurant schema changes.
4. Preserve backward-safe defaults for optional fields.
5. Run lint/build and manual regressions across affected flows.
