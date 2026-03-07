---
description: 'Architecture-first development copilot for the Eat-Spin React + TypeScript app. Use when implementing, refactoring, or debugging features in this repo, especially around App orchestration, Google Places nearby caching, Firebase group-spin sync, restaurant filtering, and section/component UI updates.'
tools:
  - code_search
  - file_reader
  - terminal
---

# Eat-Spin Development

## Execution Contract

- Treat `src/App.tsx` as the orchestration layer.
- Prefer extraction-first changes: add new business logic in `src/hooks`, `src/lib`, and focused components before expanding `App.tsx`.
- Keep changes minimal and behavior-preserving unless the request explicitly asks for behavior changes.
- Preserve stable data contracts and role/permission semantics across integrations.

## Repo Workflow

1. Locate the owning domain module using the **Project Map** below.
2. Choose the smallest safe change set for the requested behavior.
3. Implement with extraction-first boundaries.
4. Run `npm run lint` and `npm run build`.
5. Run relevant manual checks from the **Validation Checklists** below.
6. Summarize assumptions, tradeoffs, residual risks, and validation results.
7. When files were changed, always provide at least one ready-to-use commit message.

## Reference Loading Rules

- Consult the **Project Map** first for file targeting and contract boundaries.
- Consult the **Workflows** section for implementation procedure by change type.
- Consult the **Validation Checklists** before finalizing any implementation.
- Load only the sections needed for the active task to keep context lean.

## Hard Rules

- Preserve existing environment-variable and config contracts.
- Do not change source labels: `google-live`, `google-cache`, `local-fallback`.
- Do not break Firebase host/co-host/participant permission semantics.
- Keep UI changes aligned with existing design tokens in `src/index.css` and current section/component structure.
- Avoid broad refactors unless explicitly requested.
- Always include a commit message suggestion after any completed file changes.

## Done Criteria

- `npm run lint` passes.
- `npm run build` passes.
- Relevant manual scenarios pass using the **Validation Checklists**.
- Final summary includes assumptions, chosen defaults, and known tradeoffs.
- Final response includes at least one commit message suggestion when changes were made.

---

# Project Map

## Module Ownership Map

| Domain                                    | Primary Files                                          | Notes                                                                     |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| App orchestration and cross-feature state | `src/App.tsx`                                          | Compose hooks and sections; avoid adding deep business logic here.        |
| Auto nearby fetch and refresh policy      | `src/hooks/useNearbyRestaurants.ts`                    | Local-first flow, Google refresh, fallback behavior.                      |
| Nearby cache persistence                  | `src/lib/nearbyCache.ts`                               | IndexedDB schema, geohash lookup, TTL cleanup, snapshot/place writes.     |
| Google Places normalization and ranking   | `src/lib/googlePlacesRestaurants.ts`                   | API request, place normalization, category/price mapping, sort strategy.  |
| Firebase client setup                     | `src/lib/firebase.ts`                                  | Env validation, app initialization, anonymous auth entrypoint.            |
| Group room sync and permissions           | `src/hooks/useFirebaseGroupRoom.ts`                    | Room lifecycle, participants, co-host controls, spin requests.            |
| Location state                            | `src/hooks/useLocation.ts`                             | Browser geolocation request and error handling.                           |
| Spin tracking                             | `src/hooks/useSpinTracker.ts`                          | Local spin history persistence and spin-limit policy hook point.          |
| Filtering and distance logic              | `src/lib/restaurantUtils.ts`                           | Category/radius/price filters, non-halal heuristic, distance math.        |
| Static restaurant data contract           | `src/data/restaurants.ts`, `src/data/restaurants.json` | Zod validation and normalization from JSON to `Restaurant[]`.             |
| Core shared types                         | `src/types/index.ts`                                   | `Restaurant`, `FoodCategory`, `MealTime`, location and spin contracts.    |
| Section-level UI                          | `src/sections/*`                                       | Home-page layout sections and grouped presentation concerns.              |
| Reusable UI primitives                    | `src/components/ui/*`                                  | Shared controls and base UI building blocks.                              |
| App-level style tokens                    | `src/index.css`, `tailwind.config.js`                  | Brand color variables, typography, animation utilities, Tailwind mapping. |

## Change Matrix

| If you change X                                        | Edit files Y                                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Auto spin filtering and candidate shaping              | `src/lib/restaurantUtils.ts`, `src/App.tsx`, optionally `src/hooks/useNearbyRestaurants.ts`                               |
| Nearby cache behavior (TTL, area matching, read/write) | `src/lib/nearbyCache.ts`, `src/hooks/useNearbyRestaurants.ts`, `.env.example`, `README.md`                                |
| Google fetch mapping/ranking/normalization             | `src/lib/googlePlacesRestaurants.ts`, `src/hooks/useNearbyRestaurants.ts`, `src/types/index.ts` (if model changes)        |
| Firebase group room behavior or permission flow        | `src/hooks/useFirebaseGroupRoom.ts`, `src/lib/firebase.ts`, `src/sections/GroupSpin.tsx`, `docs/firebase-rtdb-rules.json` |
| Manual list and preset behavior                        | `src/App.tsx` (or extracted hooks/components), `src/types/index.ts` if new types are needed                               |
| Section UI and layout updates                          | `src/sections/*.tsx`, `src/components/*.tsx`, `src/index.css`                                                             |

## Key Contracts

### Core Types

- `Restaurant` in `src/types/index.ts` is the cross-module data contract.
- Preserve optional `source` values exactly: `google-live`, `google-cache`, `local-fallback`.
- Preserve `googlePlaceId` behavior for cache key stability in nearby storage flows.

### Environment Variables

- Firebase:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_DATABASE_URL`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_APP_ID`
- Google Nearby/cache:
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `VITE_GOOGLE_PLACES_REGION`
  - `VITE_GOOGLE_PLACES_LANGUAGE`
  - `VITE_NEARBY_CACHE_TTL_DAYS`
  - `VITE_NEARBY_CACHE_MIN_RESULTS`
  - `VITE_NEARBY_CACHE_AREA_KM`

### Group Room Constants

- `GROUP_ROOM_MAX_PARTICIPANTS = 8`
- `GROUP_ROOM_SPIN_COOLDOWN_MS = 7000`
- `GROUP_ROOM_NAME_MAX_LENGTH = 24`
- Permission model:
  - Host and co-host can edit room list and start spins.
  - Participants can join/leave and sync presence but cannot mutate restricted room state.

### Nearby Ranking and Source Semantics

- Ranking contract: rating desc, userRatingCount desc, distance asc.
- Source semantics:
  - `google-live`: fresh API data for current request.
  - `google-cache`: persisted nearby snapshot reuse.
  - `local-fallback`: static local dataset when Google/cached nearby cannot satisfy.

---

# Workflows

## Workflow A: UI or Section Change With Minimal Orchestration Impact

1. Identify owning section/component from the Project Map.
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

---

# Validation Checklists

## Required Commands

Run from repository root:

```bash
npm run lint
npm run build
```

Record pass/fail state and include key error output if failing.

## Manual Scenario Checklist

### Location Flow

- Load app with location permission allowed; confirm nearby flow activates.
- Deny location permission; confirm fallback messaging and non-crash behavior.

### Source Banner Behavior

- Confirm banner text reflects active source state:
  - Loading nearby
  - Cached nearby results (`google-cache`)
  - Live nearby results (`google-live`)
  - Local fallback (`local-fallback`)

### Cache Fallback Behavior

- Simulate/observe Google failure path and confirm cached results are used when available.
- Confirm local fallback activates only when both live fetch and usable cache are unavailable.

### Manual Spin List and Presets

- Add, deduplicate, remove, clear manual restaurants.
- Save and delete presets.
- Verify preset load behavior and manual wheel reset/spin flow.

### Group Room Lifecycle and Roles

- Create room as host.
- Join room from another participant identity.
- Confirm host/co-host can edit list and start spin.
- Confirm non-host/non-co-host cannot start room spin.
- Verify room join/leave and shared list sync behavior.

## Failure Triage Checklist

### Environment and Config

- Confirm `.env` values exist for required Firebase and Google keys.
- Confirm `.env.example` reflects required keys and documented defaults.
- Confirm Firebase Anonymous Auth is enabled in project settings.
- Confirm RTDB rules are current with `docs/firebase-rtdb-rules.json`.

### Network and API

- Check browser console for fetch/network errors.
- Check Google Places error payload and rate/permission status.
- Check Firebase permission-denied and connectivity errors.

### Data and Contract Integrity

- Verify source labels remain `google-live`, `google-cache`, `local-fallback`.
- Verify type changes are propagated across hooks/libs/components.
- Verify no stale assumptions around cache TTL, radius, or ranking order.
