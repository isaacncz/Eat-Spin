# Project map

Paths below are relative to the repository root.

| Domain | Owning files |
| --- | --- |
| Tabs and cross-feature orchestration | `src/App.tsx` |
| Personal list UI, picker and tools | `src/screens/ListScreen.tsx`, `src/screens/ListTools.tsx`, `src/components/ListPicker.tsx`, `src/components/ListSheet.tsx` |
| Personal list persistence, deltas, backups | `src/hooks/useManualLists.ts`, `src/lib/listOperations.ts` |
| Fixed list sharing and independent copies | `src/components/ListSharingDialog.tsx`, `src/lib/sharedLists.ts`, `src/lib/sharedListsApi.ts` |
| Group room UI and list editor | `src/screens/GroupScreen.tsx`, `src/components/GroupRoomListEditor.tsx`, `src/components/GroupResultActions.tsx` |
| Group subscriptions, roles and lifecycle | `src/hooks/useFirebaseGroupRoom.ts`, `src/lib/groupRoomIdentity.ts`, `src/lib/groupRoomPresence.ts` |
| Spin UI, reveal and wheel | `src/components/SpinScreen.tsx`, `src/components/RouletteWheel.tsx`, `src/components/ResultScreen.tsx` |
| Destination/food search and visible viewport | `src/components/DestinationPicker.tsx`, `src/components/CravingSearch.tsx`, `src/hooks/useSearchDestination.ts`, `src/hooks/useTextSearch.ts`, `src/hooks/useVisualViewport.ts` |
| Places requests and usage guard | `src/lib/googlePlacesRestaurants.ts`, `src/lib/googlePlacesTextSearch.ts`, `src/lib/googlePlacesDestinations.ts`, `src/lib/placesUsage.ts` |
| Nearby fetch, cache and filtering | `src/hooks/useNearbyRestaurants.ts`, `src/lib/nearbyCache.ts`, `src/lib/restaurantUtils.ts`, `src/lib/searchDestination.ts` |
| Device GPS | `src/hooks/useLocation.ts` |
| Favourites and history | `src/hooks/useFavourites.ts`, `src/hooks/useSpinTracker.ts`, `src/lib/spinHistory.ts` |
| Game progress | `src/lib/gameStore.ts`, `src/screens/MeScreen.tsx` |
| Firebase setup, supplied rules and emulator tests | `src/lib/firebase.ts`, `docs/firebase-rtdb-rules.json`, `scripts/shared-list-rules.test.mjs`, `scripts/group-room-rules.test.mjs` |
| Shared types and fallback data | `src/types/index.ts`, `src/data/restaurants.ts`, `src/data/restaurants.json` |
| Brand tokens, About guide and reusable primitives | `src/index.css`, `tailwind.config.js`, `src/sections/AboutEatSpin.tsx`, `src/components/ui`, `src/screens/arcade.tsx` |
| Logo/sound source and shipping assets | `assets/brand/README.md`, `assets/audio/README.md`, `src/lib/spinAudio.ts`, `src/components/PhotoCarousel.tsx`, `public/sw.js` |
| Required CI and pre-push checks | `.github/workflows/ci.yml`, `.githooks/pre-push`, `scripts/ci-local.sh` |

## Contracts worth tracing

- The `Restaurant` type is shared by nearby, manual, favourites and result flows. Preserve optional-source and `googlePlaceId` semantics; manual place names do not imply verified API details.
- Personal list IDs/item IDs and the v2 operation journal are separate from room list records. Do not replace a full collection from a stale tab.
- Shared snapshots use independent recipient IDs; edits are not cloud collaboration on the original list.
- Group winner records, replay decisions, attendance and history must agree on the committed spin event. Connectivity and host presence are distinct.
- Radius presets are 1/3/5/10 km; default 5 km, with saved/legacy selection migration. Distance is not a guaranteed travel time.
- Nearby candidate ranking currently combines rating and review volume, then distance. Winner selection from the current wheel is a different operation.

Read values from owning constants when they matter. Do not duplicate default limits throughout guidance. Current details live in [destination search](../../../../docs/destination-search.md), [list/Group rollout](../../../../docs/list-group-rollout.md), and [list sharing](../../../../docs/list-sharing.md).
