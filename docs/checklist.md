# EatSpin Weekly Checklist (March 2-8, 2026)

Last verified: March 2, 2026

## P0 - Code Issue Unblock (Parallel lane)
- [x] Remove unused `Navigation` import in `src/App.tsx`
- [x] Remove or wire `isFavouriteByIds` in `src/App.tsx`
- [x] Wrap `removeRestaurantForRound` in `useCallback` to stabilize deps
- [x] Fix `addManualRestaurantByName` declaration ordering/deps issue used by `handleAddFavouriteToManualList`
- [x] Remove unused `maxCharsPerLine` and `baseFontSize` in `src/components/RouletteWheel.tsx`
- [x] `npm run build` passes
- [x] Targeted lint passes for touched files
- [x] Remaining repo-wide lint debt logged in roadmap (deferred)

## P1 - OG Tags (Social Preview)
- [ ] Add `<meta name="description">`
- [ ] Add canonical URL tag
- [ ] Add Open Graph tags: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:image:alt`, `og:site_name`
- [ ] Add Twitter tags: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- [ ] Add `VITE_SITE_URL` to `.env.example` and wire in `index.html`
- [ ] Move/update favicon + manifest icon paths to production-safe `public/*`
- [ ] Add default OG image asset at `public/og/og-default.png`
- [ ] Validate final head tags in production build output

## P2 - Shareable Result Card (MVP, no photo)
- [x] Add image export dependency (`html-to-image`)
- [x] Add share utility (`src/lib/shareCard.ts`) for capture + blob + fallback download
- [x] Add `Share` action on spin result card in `src/components/RouletteWheel.tsx`
- [x] Use Web Share API when available
- [x] Fallback to image download when Web Share API is unavailable
- [x] Add analytics events for share open/success/failure
- [ ] Manual check on desktop and mobile behavior

## P3 - Sound + Haptics
- [x] Add sound engine utility (`src/lib/spinAudio.ts`) with tick/drumroll/win cues
- [x] Add sound toggle UI near spin controls
- [x] Persist setting in localStorage (`eatspin:sound-enabled`, default `true`)
- [x] Trigger tick on segment pass during spin
- [x] Trigger drumroll during deceleration
- [x] Trigger celebration chime on result reveal
- [x] Trigger `navigator.vibrate()` on supported mobile devices
- [x] Respect reduced-motion and unsupported-device fallbacks

## P4 - Spin Again (Not This One)
- [x] Add `Spin Again` button in the result card
- [x] Use existing auto-round removal flow so previous winner is excluded
- [x] Auto-spin directly from result action (single tap)
- [x] Disable when fewer than 2 eligible restaurants remain
- [x] Add analytics event for spin-again action

## P5 - Confetti Upgrade
- [ ] Add `canvas-confetti` dependency
- [ ] Replace emoji burst with canvas confetti burst on result reveal
- [ ] Keep cleanup safe on unmount/re-render
- [ ] Respect reduced-motion preference
- [ ] Verify no noticeable performance regression on mobile

## P7 - PWA Install Prompt
- [x] Capture `beforeinstallprompt` and persist deferred prompt
- [x] Show custom install banner after 2nd recorded spin
- [x] Add `Install` and `Later` actions with dismissal cooldown
- [x] Track prompt open/accept/dismiss analytics events
- [x] Add manifest shortcuts for quick app entry points

## P8 - Restaurant Photo in Result Card
- [x] Add Google Places photo field in nearby request field mask
- [x] Map first available Places photo into `Restaurant.image`
- [x] Render hero image in spin result card with graceful no-photo fallback
- [ ] Manual verify photo rendering in auto mode live results

## P9 - Spin History + Personal Stats
- [x] Surface total spins, unique places, top category, current streak
- [x] Add "This month" metric and recent timeline list
- [x] Add shareable "Wrapped" summary action (native share/clipboard fallback)
- [ ] Manual verify stats correctness across reloads and new spins

## P10 - First-Run Onboarding (15s to First Spin)
- [x] Add first-run onboarding overlay component (3 guided steps)
- [x] Wire location request step to existing geolocation flow
- [x] Wire auto-mode step to existing tab/navigation flow
- [x] Persist seen-state in localStorage (`eatspin:first-run-onboarding-seen`)
- [ ] Manual verify first-run only behavior on fresh storage

## P11 - Group Reactions + "Who's In?" Vote
- [x] Extend Firebase room hook with `reactions` and `votes` live subscriptions
- [x] Add room reaction sender and vote setter actions
- [x] Add emoji reaction controls in Group Spin UI
- [x] Add floating reaction burst effect
- [x] Add "I'm in / Pass" vote controls with live totals
- [ ] Manual verify multi-client realtime sync for reactions and votes

## P12 - Challenge a Friend (7 Days)
- [x] Add Firebase-backed challenge hook for create/join/leave flows
- [x] Add shareable invite link (`?challenge=CODE`) handling
- [x] Sync daily completion markers when spins happen
- [x] Add challenge leaderboard panel in app UI
- [ ] Manual verify two-user challenge sync across devices

## P6 - Regression + Ship Gate
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Manual smoke checks: auto spin, manual spin, favourites save/remove/undo, lets-go flow, feedback prompt
- [ ] Validate source labels unchanged: `google-live`, `google-cache`, `local-fallback`
- [ ] Update roadmap status in `docs/eat-spin-product-roadmap.md`
