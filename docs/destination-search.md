# Destination search (#122)

The Spin screen can search around an area, mall, landmark, or address without GPS permission. Choosing a destination defaults to a 3 km radius; explicit presets are 1, 3, 5, and 10 km. Current-location mode retains the existing travel presets until an explicit radius is chosen. “Open now only” defaults on, can be disabled for planning, and does not predict arrival-time availability.

Device GPS remains separate for location-based favourites and Discover. Destination changes reset the round/result and cancel obsolete requests. Nearby cache selection retains center, radius, cuisine, and availability dimensions. Text Search uses the circle's bounding rectangle where possible, then an exact distance filter; polar/date-line circles fall back to circular bias and the same exact filter.

## Persistence

`eatspin:search-destination:v1` stores place ID, coordinates, original fetch time, and radius. It excludes Google-derived names/addresses, typed queries, session tokens, and GPS coordinates. Names and addresses stay in memory. After reload, the center is labelled “Saved destination”; selecting a place again restores its live label. No Details lookup is made solely for reload. Invalid records and coordinates aged 30 days are discarded; their age is never extended by reload. Selecting current location clears the saved destination while retaining the radius preference. Storage failure leaves in-memory selection usable.

This is a deliberate adjustment to the initial issue persistence sketch after the policy check: the generic Places storage exception covers place IDs and temporary coordinates, not cached names/addresses.

## Google documentation verified 2026-10-23

- [Autocomplete session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing): for sessions ending in Details Essentials, the first 12 autocomplete requests are charged individually, subsequent requests in that completed session have no charge, and the terminating Details request is billed separately. Abandoned sessions charge every autocomplete request.
- [Session tokens](https://developers.google.com/maps/documentation/places/web-service/place-session-tokens): generate a UUID per session, reuse it across suggestions and the single terminating Details call, then discard it. All calls use the same project's key. Closing the picker abandons its session; failed/interrupted selection never reuses the token.
- [Details field mask](https://developers.google.com/maps/documentation/places/web-service/place-details): exactly `location,formattedAddress` uses Essentials. The display label comes from autocomplete; `displayName` is not requested.
- [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search): rectangular `locationRestriction` and `locationBias` are mutually exclusive. Rectangle restriction is a pre-filter, not an exact circular boundary.
- [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) and [service terms §14.3](https://cloud.google.com/maps-platform/terms/maps-service-terms): place IDs may be stored; coordinates may be temporarily cached for up to 30 days. Do not persist destination names or formatted addresses. The compact picker attributes its Google-sourced content with “Google Maps” text.

## Operator setup

Use the existing `VITE_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_PLACES_REGION` (default MY), and language (default en). Region is formatting/ranking context, not a country restriction on suggestions. Enable Places API (New) and check the key's allowed applications/APIs for Autocomplete, Details, Nearby, and Text Search.

Publish the updated `docs/firebase-rtdb-rules.json` usage rule before releasing this client to a Firebase-configured environment: it adds `autocomplete` and `details` counter kinds. Without those writes, lookup reports the permission failure and does not silently bypass shared budgeting. The existing local-storage fallback remains available when Firebase is unconfigured.

Each new kind uses the existing configured monthly cap/threshold as a conservative request guard, not a dollar estimator or promise of free usage. Every autocomplete request reserves a slot even if a completed session may later receive discounted billing. Failed/aborted requests may consume reservations. Keep Google Cloud quotas as the hard backstop. Existing restaurant caching policy is outside this feature's scope.
