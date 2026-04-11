# Spin-First UX Revamp & Distance Optimization

## Overview

Major UX overhaul completed April 2026. Transformed EatSpin from a marketing landing page into an app-first experience where the spin wheel is the first thing users see.

## Changes Summary

### Architecture

5 new components extracted from the monolithic App.tsx:

| Component | File | Purpose |
|-----------|------|---------|
| `QuickSpinHero` | `src/sections/QuickSpinHero.tsx` | Full-viewport hero with food mood selector + SPIN NOW button |
| `AppNavbar` | `src/sections/AppNavbar.tsx` | Compact 56px/48px fixed navbar with built-in tab toggle |
| `FilterPanel` | `src/components/FilterPanel.tsx` | Collapsible range/price/cuisine filter panel |
| `SpinStatsPanel` | `src/components/SpinStatsPanel.tsx` | Gamified stats with streak celebrations and sharing |
| `AppContext` | `src/contexts/AppContext.tsx` | Shared state provider and constants (not yet wired as provider) |

### Spin-First Layout

**Before:** Hero → HowItWorks → Features → Testimonials → CTA → Spin (5+ screens of scrolling before the spin)

**After:** AppNavbar → QuickSpinHero (with SPIN NOW) → Filters → Wheel → Stats → "Learn more" toggle

- App opens directly to the spin experience
- Marketing sections (HowItWorks, Features, Testimonials, CTA) lazy-loaded behind "Learn more" toggle
- Dynamic meal-time heading ("What's for breakfast/lunch/dinner?")
- Food mood quick-select maps to cuisine filters for one-tap spin

### Food Mood Selector

| Mood | Mapped Categories |
|------|-------------------|
| Quick Bite | street food, noodles, rice |
| Treat Myself | western, japanese, korean |
| Healthy | vegetarian, cafe |
| Surprise Me | clears all filters |

### Distance Optimization

**Problem:** Haversine (straight-line) distance underestimates actual road travel. A place 6 km away as the crow flies can be 20+ min by road.

**Solution:** Applied a 1.4× road detour factor to tighten search radii:

| Mode | Old Radius | New Radius | Reasoning |
|------|-----------|------------|-----------|
| Walking | 1.2 km | 0.85 km | ~12 min walk at 5 km/h |
| 10 min drive | 6 km | 4.3 km | ~10 min at 30 km/h urban |
| 20 min drive | 12 km | 8.5 km | ~20 min at 30 km/h urban |

All distance displays now show **estimated travel time** instead of raw km:
- `3.2 km` → `~6 min drive`
- `0.5 km` → `~8 min walk`

Helper function: `estimateTravelTime(straightLineKm)` in RouletteWheel.tsx and App.tsx.

### Viral Sharing Enhancements

- Result card redesigned with branded orange gradient header ("EatSpin picked this for you!")
- Branded footer watermark ("🍴 EatSpin · Spin to decide what to eat") visible in screenshots
- Share button elevated to primary action alongside "Let's go!"
- Compact info row: rating | price | travel time

### Performance

- Marketing sections code-split into lazy chunks via `React.lazy()`:
  - `HowItWorks-*.js` (3.7 KB)
  - `Features-*.js` (4.4 KB)
  - `Testimonials-*.js` (4.8 KB)
  - `CTA-*.js` (3.4 KB)
  - `ScrollTrigger-*.js` (43 KB) — GSAP plugin only used by marketing sections
- Main bundle reduced from 1004 KB → 948 KB

### Bug Fixes

1. **FoodCategorySelector crash** — `cuisineCategories.find()!` returned undefined for mood-mapped IDs like 'street food' that aren't in the cuisine subset. Fixed by using `foodCategories` lookup with null filtering.

2. **Share button invisible** — Solid orange gradient button placed next to solid orange "Let's go!" button made text unreadable. Changed to outline style with orange border/text.

3. **Spin Again always disabled** — Threshold was `wheelRestaurants.length > 2` (needs 3+), changed to `>= 2`.

## Files Changed

### New Files
- `src/contexts/AppContext.tsx`
- `src/sections/QuickSpinHero.tsx`
- `src/sections/AppNavbar.tsx`
- `src/components/FilterPanel.tsx`
- `src/components/SpinStatsPanel.tsx`

### Modified Files
- `src/App.tsx` — Layout rewrite, lazy imports, distance helpers, tightened radii
- `src/components/RouletteWheel.tsx` — Result card redesign, travel time display
- `src/index.css` — Navbar height CSS variables (80px → 56px/48px)
- `src/lib/restaurantUtils.ts` — Updated distance band thresholds
- `src/sections/CTA.tsx` — Updated section ID reference
- `src/sections/HowItWorks.tsx` — Updated section ID reference
- `src/components/FoodCategorySelector.tsx` — Fixed crash on non-cuisine category lookup

## Known Remaining Work

- [ ] Wire AppContext as actual provider in main.tsx (App.tsx still owns all state directly)
- [ ] Remove dead code: old `Navbar.tsx` and `Hero.tsx` are no longer rendered
- [ ] Fix Playwright e2e test selectors (tabs use `role="tab"` not `role="button"`)
- [ ] Further bundle splitting (main chunk still 948 KB)
- [ ] Mobile responsiveness audit
- [ ] Consider Google Routes API integration for accurate travel times on result card
