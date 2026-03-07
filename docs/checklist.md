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
- [ ] Add image export dependency (`html-to-image`)
- [ ] Add share utility (`src/lib/shareCard.ts`) for capture + blob + fallback download
- [ ] Add `Share` action on spin result card in `src/components/RouletteWheel.tsx`
- [ ] Use Web Share API when available
- [ ] Fallback to image download when Web Share API is unavailable
- [ ] Add analytics events for share open/success/failure
- [ ] Manual check on desktop and mobile behavior

## P3 - Sound + Haptics
- [ ] Add sound engine utility (`src/lib/spinAudio.ts`) with tick/drumroll/win cues
- [ ] Add sound toggle UI near spin controls
- [ ] Persist setting in localStorage (`eatspin:sound-enabled`, default `true`)
- [ ] Trigger tick on segment pass during spin
- [ ] Trigger drumroll during deceleration
- [ ] Trigger celebration chime on result reveal
- [ ] Trigger `navigator.vibrate()` on supported mobile devices
- [ ] Respect reduced-motion and unsupported-device fallbacks

## P4 - Spin Again (Not This One)
- [ ] Add `Spin Again` button in the result card
- [ ] Use existing auto-round removal flow so previous winner is excluded
- [ ] Auto-spin directly from result action (single tap)
- [ ] Disable when fewer than 2 eligible restaurants remain
- [ ] Add analytics event for spin-again action

## P5 - Confetti Upgrade
- [ ] Add `canvas-confetti` dependency
- [ ] Replace emoji burst with canvas confetti burst on result reveal
- [ ] Keep cleanup safe on unmount/re-render
- [ ] Respect reduced-motion preference
- [ ] Verify no noticeable performance regression on mobile

## P6 - Regression + Ship Gate
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Manual smoke checks: auto spin, manual spin, favourites save/remove/undo, lets-go flow, feedback prompt
- [ ] Validate source labels unchanged: `google-live`, `google-cache`, `local-fallback`
- [ ] Update roadmap status in `docs/eat-spin-product-roadmap.md`
