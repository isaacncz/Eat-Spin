# Project Map

## Module Ownership Map
| Domain | Primary Files | Notes |
| --- | --- | --- |
| App orchestration and cross-feature state | `src/App.tsx` | Compose hooks and sections; avoid adding deep business logic here. |
| Auto nearby fetch and refresh policy | `src/hooks/useNearbyRestaurants.ts` | Local-first flow, Google refresh, fallback behavior. |
| Nearby cache persistence | `src/lib/nearbyCache.ts` | IndexedDB schema, geohash lookup, TTL cleanup, snapshot/place writes. |
| Google Places normalization and ranking | `src/lib/googlePlacesRestaurants.ts` | API request, place normalization, category/price mapping, sort strategy. |
| Firebase client setup | `src/lib/firebase.ts` | Env validation, app initialization, anonymous auth entrypoint. |
| Group room sync and permissions | `src/hooks/useFirebaseGroupRoom.ts` | Room lifecycle, participants, co-host controls, spin requests. |
| Location state | `src/hooks/useLocation.ts` | Browser geolocation request and error handling. |
| Spin tracking | `src/hooks/useSpinTracker.ts` | Local spin history persistence and spin-limit policy hook point. |
| Filtering and distance logic | `src/lib/restaurantUtils.ts` | Category/radius/price filters, non-halal heuristic, distance math. |
| Static restaurant data contract | `src/data/restaurants.ts`, `src/data/restaurants.json` | Zod validation and normalization from JSON to `Restaurant[]`. |
| Core shared types | `src/types/index.ts` | `Restaurant`, `FoodCategory`, `MealTime`, location and spin contracts. |
| Section-level UI | `src/sections/*` | Home-page layout sections and grouped presentation concerns. |
| Reusable UI primitives | `src/components/ui/*` | Shared controls and base UI building blocks. |
| App-level style tokens | `src/index.css`, `tailwind.config.js` | Brand color variables, typography, animation utilities, Tailwind mapping. |

## Change Matrix
| If you change X | Edit files Y |
| --- | --- |
| Auto spin filtering and candidate shaping | `src/lib/restaurantUtils.ts`, `src/App.tsx`, optionally `src/hooks/useNearbyRestaurants.ts` |
| Nearby cache behavior (TTL, area matching, read/write) | `src/lib/nearbyCache.ts`, `src/hooks/useNearbyRestaurants.ts`, `.env.example`, `README.md` |
| Google fetch mapping/ranking/normalization | `src/lib/googlePlacesRestaurants.ts`, `src/hooks/useNearbyRestaurants.ts`, `src/types/index.ts` (if model changes) |
| Firebase group room behavior or permission flow | `src/hooks/useFirebaseGroupRoom.ts`, `src/lib/firebase.ts`, `src/sections/GroupSpin.tsx`, `docs/firebase-rtdb-rules.json` |
| Manual list and preset behavior | `src/App.tsx` (or extracted hooks/components), `src/types/index.ts` if new types are needed |
| Section UI and layout updates | `src/sections/*.tsx`, `src/components/*.tsx`, `src/index.css` |

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
