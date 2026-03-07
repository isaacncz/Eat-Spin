# EatSpin — Product Roadmap & Feature Plan

> Last updated: 1 March 2026

---

## Table of Contents

1. [What We Built (Shipped)](#what-we-built-shipped)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1 — Favourites Foundation](#phase-1--favourites-foundation)
4. [Phase 2 — Post-Visit Feedback Loop](#phase-2--post-visit-feedback-loop)
5. [Phase 3 — Proximity Integration](#phase-3--proximity-integration)
6. [Data Flow Diagram](#data-flow-diagram)
7. [Must-Have Viral Features (Top 10)](#must-have-viral-features-top-10)
8. [Implementation Priority Matrix](#implementation-priority-matrix)
9. [The Viral Loop](#the-viral-loop)
10. [Technical Debt & Gaps](#technical-debt--gaps)
11. [File Reference](#file-reference)

---

## What We Built (Shipped)

Branch: `feat/favourites-feedback-proximity`

Three phases shipped across 4 commits:

| Phase | Feature                                                                               | Status     |
| ----- | ------------------------------------------------------------------------------------- | ---------- |
| 1     | Favourites system — save from spin, view in "I Know Where" tab, IndexedDB persistence | ✅ Shipped |
| 2     | Post-visit feedback loop — "Let's go!" → pending feedback → rate on next app open     | ✅ Shipped |
| 3     | Proximity integration — nearby favourites in manual tab, ♥ badge on auto-spin wheel   | ✅ Shipped |
| —     | Gmail-style undo toast for favourite removal                                          | ✅ Shipped |

### New Files Created

```
src/
├── types/
│   └── favourites.ts                # FavouriteEntry type + deriveFavouriteId()
├── lib/
│   ├── favouritesStore.ts           # IndexedDB CRUD + restore for undo
│   └── feedbackStore.ts             # localStorage feedback queue
├── hooks/
│   ├── useFavourites.ts             # React state wrapper for favourites store
│   └── useFeedbackPrompt.ts         # Checks for pending feedback on app open
├── components/
│   └── FeedbackPrompt.tsx           # Post-visit rating dialog (4 options)
```

### Modified Files

| File                               | Changes                                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/RouletteWheel.tsx` | Added `onSaveFavourite`, `onLetsGo`, `isFavourite` props. Added ★ Save, Let's go!, and ♥ badge on distance guide.                                                                                          |
| `src/App.tsx`                      | Wired `useFavourites`, `useFeedbackPrompt`, feedback handlers, favourite handlers, "My Favourites" section, "Nearby Favourites" section, avoided restaurant filtering, favourite highlight in review list. |
| `src/lib/restaurantUtils.ts`       | Added `avoidedRestaurantIds` param to `enhancedFilterRestaurants`, `findNearbyFavourites()`, `matchFavourite()`.                                                                                           |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    App.tsx (1700+ lines)              │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ useFavs  │  │ useFeedback│  │ useNearbyRests   │  │
│  └────┬─────┘  └─────┬─────┘  └────────┬─────────┘  │
│       │              │                  │             │
│  IndexedDB      localStorage      Google Places API  │
│  (favourites)   (feedback queue)  + IndexedDB cache   │
└──────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   "Spin for Me"   "I Know Where"   Group Spin
   (auto tab)      (manual tab)     (Firebase RTDB)
```

### Tech Stack

| Layer       | Tech                                                |
| ----------- | --------------------------------------------------- |
| Framework   | React 19 + TypeScript 5.9                           |
| Build       | Vite 7                                              |
| Styling     | Tailwind 3 + shadcn/ui + Radix UI                   |
| Animation   | GSAP 3                                              |
| Realtime    | Firebase RTDB + Anonymous Auth                      |
| Persistence | IndexedDB (favourites, nearby cache) + localStorage |
| Analytics   | GA4 via gtag.js                                     |
| PWA         | Basic service worker + manifest                     |

---

## Phase 1 — Favourites Foundation

### User Flow

1. User spins the wheel → result card appears
2. **"★ Save"** button saves restaurant to IndexedDB favourites
3. **"Let's go!"** button opens Google Maps navigation + auto-saves as favourite
4. Saved restaurants appear in "I Know Where" tab under **"My Favourites"** section
5. User can tap **"+ Add"** to add any favourite to the current spin list
6. User can remove with **undo toast** (5-second window to restore)

### Data Model

```typescript
interface FavouriteEntry {
  id: string; // googlePlaceId or hash(name+address)
  restaurant: Restaurant; // full snapshot
  savedAt: number;
  savedFrom: 'spin-auto' | 'spin-manual' | 'lets-go';
  location: { lat: number; lng: number };
  lastVisitedAt?: number;
  visitCount: number;
  userRating: 'suggest' | 'neutral' | 'avoid';
  feedbackPending: boolean;
  lastPromptedAt?: number;
}
```

### IndexedDB Schema

- Database: `eatspin-favourites`, version 1
- Object store: `favourites`, keyPath: `id`
- Indexes: `by-rating`, `by-savedAt`

---

## Phase 2 — Post-Visit Feedback Loop

### User Flow

1. User taps "Let's go!" → pending feedback queued in localStorage
2. After **2+ hours**, next time user opens the app → `FeedbackPrompt` dialog appears
3. Four options:
   - 👍 **Suggest again** → `userRating: 'suggest'`
   - 😐 **It was okay** → `userRating: 'neutral'`
   - 👎 **Don't suggest** → `userRating: 'avoid'`
   - ❓ **Didn't go** → removes pending entry, no rating change
4. Restaurants marked `avoid` are **excluded from auto-spin results** via `avoidedRestaurantIds` filter in `enhancedFilterRestaurants()`

### Storage

- localStorage key: `eatspin:pending-feedback`
- Schema: `{ favouriteId, restaurantName, triggeredAt }[]`
- Delay: 2 hours (`FEEDBACK_DELAY_MS = 7_200_000`)

---

## Phase 3 — Proximity Integration

### "I Know Where" Tab — Nearby Favourites Section

- When user has location, app computes `findNearbyFavourites()` within **3km** radius
- Shows a green-accented section above "My Favourites" with distance for each
- User can tap **"+ Add"** to add nearby favourite directly to their spin list

### "Spin for Me" Tab — Favourite Highlighting

- Restaurants in the "Review this round" list that match a saved favourite show a **♥ Fave** badge (pink pill)
- Distance Guide list items show a pink heart icon next to favourite restaurants
- Uses efficient `Set<string>` lookups on `favouriteIdSet` and `favouriteGooglePlaceIdSet`

---

## Data Flow Diagram

```
Spin Result → "★ Save"         → favouritesStore (IndexedDB)
Spin Result → "Let's go!"      → favouritesStore + feedbackStore (localStorage)
                                       │
                                       ▼
                               Next App Open (2h+)
                                       │
                                       ▼
                               FeedbackPrompt Dialog
                                       │
                          ┌────────────┼────────────┐
                          ▼            ▼            ▼
                      'suggest'    'neutral'     'avoid'
                          │            │            │
                          └────────────┼────────────┘
                                       ▼
                              favouritesStore.update()
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
               Proximity section              Excluded from
              (shows suggest/neutral)        auto-spin filter
                          │
                          ▼
                "I Know Where" tab
               shows nearby favourites
```

---

## Must-Have Viral Features (Top 10)

### 1. Shareable Spin Result Card

Every spin should generate a **branded, beautiful card** users send to group chats — restaurant name, photo, rating, distance, EatSpin branding + QR link. Uses `html2canvas` or `<canvas>` rendering + Web Share API on mobile. **This is the #1 growth mechanism** — every spin = a free ad.

### 2. Sound Effects + Haptic Feedback

The wheel is silent. Add:

- **Tick** on each segment pass (GSAP `onUpdate`)
- **Drum roll** during final deceleration
- **Celebration chime** on result reveal
- **`navigator.vibrate()`** on mobile

Persist sound toggle to localStorage. Default: on.

### 3. "Challenge a Friend" Mode

"I'm doing #7DaysOfEatSpin — letting the wheel pick my lunch." Users create a 7-day challenge, share a link, friend joins. Both track daily spins side-by-side. Summary card at the end = shareable content. **Every challenge = guaranteed new user.**

### 4. Group Spin Reactions + "Who's In?" Vote

After group spin lands: live emoji reactions (🔥😂🤮🙌) floating up. Then a "Going? 🙋" poll where participants vote. "4/6 friends are going" = social pressure = conversion. Turns Group Spin from functional to _fun_.

### 5. Restaurant Photo in Result Card

Google Places has photos — they're just not being requested. Add `photos` to the field mask, fetch via Places Photo API, display as hero image on result card. **People eat with their eyes first.**

### 6. Spin History + Personal Stats ("EatSpin Wrapped")

Spins are already tracked in localStorage but never shown. Build a "My Spins" page: timeline, total count, unique restaurants, favourite cuisine, streak tracking. Monthly/yearly summary card = shareable Wrapped moment.

### 7. PWA Install Prompt

Manifest and service worker exist but no install UX. Capture `beforeinstallprompt`, show a custom banner after 2nd spin. Add shortcuts to manifest. **Installed PWAs have 3x return rates.**

### 8. "Spin Again" + "Not This One" Quick Action

One-button re-spin from result card. Rejects current restaurant for this round, reshuffles, auto-spins. Keeps the dopamine loop tight. Track rejection rate per restaurant as a quality signal.

### 9. First-Run Onboarding (15s to First Spin)

3-step overlay for new users: (1) Allow location → (2) Pre-loaded wheel appears → (3) "Tap to spin!" **Time-to-value is the #1 predictor of retention.**

### 10. "Discover" Feed — See What Others Are Eating

Anonymous, location-based feed: "Someone near you just spun Sushi Tei ☀️ Lunch". Aggregated data by area. Creates FOMO + social proof. **Turns EatSpin from a utility into a live food pulse of the city.**

---

## Implementation Priority Matrix

| Priority | Feature                            | Effort    | Viral | Retention |
| -------- | ---------------------------------- | --------- | ----- | --------- |
| **1**    | OG Meta Tags (social preview)      | 30 min    | ★★★★★ | ★         |
| **2**    | Shareable Result Card              | 1 day     | ★★★★★ | ★★        |
| **3**    | Sound + Haptics                    | 1 day     | ★★★   | ★★★★      |
| **4**    | Spin Again button                  | 2 hours   | ★     | ★★★★      |
| **5**    | Confetti upgrade (canvas-confetti) | 3 hours   | ★★★   | ★★★       |
| **6**    | PWA Install Prompt                 | 4 hours   | ★★★   | ★★★★      |
| **7**    | First-Run Onboarding               | 2 days    | ★★    | ★★★★      |
| **8**    | Restaurant Photos                  | 1 day     | ★★    | ★★★★      |
| **9**    | Spin History + Stats               | 3 days    | ★★★   | ★★★★★     |
| **10**   | Challenge a Friend                 | 5 days    | ★★★★★ | ★★★★★     |
| **11**   | Group Reactions                    | 3 days    | ★★★★  | ★★★       |
| **12**   | Discover Feed                      | 1-2 weeks | ★★★★  | ★★★★★     |

### Ship Order

**This week:** OG tags → Shareable card → Sound → Spin Again → Confetti

**This month:** PWA Install → Onboarding → Restaurant Photos → Spin History

**Next quarter:** Challenge Mode → Group Reactions → Discover Feed

---

## The Viral Loop

```
User opens app → Spins → Gets a result
                              │
        ┌─── Delightful ──────┤────── Shareable ───────┐
        │  (confetti + sound  │  (branded card +        │
        │   + photo)          │   WhatsApp/IG share)    │
        ▼                     ▼                         ▼
   "Let's go!"          "Save ★"                  Friend sees card
   (Google Maps)        (favourites)              with EatSpin link
        │                     │                         │
        ▼                     ▼                         ▼
   Feedback prompt      Proximity prompt          Friend tries app
   (next app open)      (next time nearby)              │
        │                     │                         ▼
        ▼                     ▼                    Friend spins
   Rating stored        "You're near              → shares → repeat
   (suggest/avoid)       Sushi Tei!"                    │
        │                                               │
        └───────────── VIRAL LOOP ∞ ◀──────────────────┘
```

---

## Technical Debt & Gaps

### Code Issues

| Issue                               | Location                             | Severity                 |
| ----------------------------------- | ------------------------------------ | ------------------------ |
| App.tsx is 1700+ lines monolith     | `src/App.tsx`                        | Medium — needs splitting |
| Spin limiting fully commented out   | `src/hooks/useSpinTracker.ts#L16-38` | Low — deliberate         |
| `manualSpinResult` state never read | `src/App.tsx#L228`                   | Low                      |
| Unused dependencies (~10 packages)  | `package.json`                       | Low — bundle bloat       |
| No React error boundary             | App-wide                             | Medium                   |
| No loading skeletons                | Various                              | Low                      |

### Missing Infrastructure

| Gap                                     | Impact                             |
| --------------------------------------- | ---------------------------------- |
| No OG meta tags                         | Links shared with no preview       |
| No `<meta description>`                 | Poor SEO                           |
| Social links are placeholder `#`        | Dead footer links                  |
| "Download App" button non-functional    | Broken CTA                         |
| No `robots.txt` or `sitemap.xml`        | SEO missing                        |
| No dark mode (configured but not built) | User preference                    |
| No i18n                                 | English-only, Malaysian-market app |

### Accessibility

| Issue                                           | Fix Needed                |
| ----------------------------------------------- | ------------------------- |
| No skip-to-content link                         | Add landmark navigation   |
| No `role="tablist"` on tab switcher             | Add ARIA roles            |
| No `aria-live` for dynamic content              | Announce spin results     |
| FeedbackPrompt blocks ESC with no visible close | Add close option          |
| Wheel not keyboard-navigable                    | Add keyboard spin trigger |

---

## File Reference

| File                                 | Lines  | Purpose                                         |
| ------------------------------------ | ------ | ----------------------------------------------- |
| `src/App.tsx`                        | 1,700+ | Main app logic, all tabs, state management      |
| `src/components/RouletteWheel.tsx`   | 831    | Wheel, GSAP animation, result card              |
| `src/hooks/useFirebaseGroupRoom.ts`  | 810    | Firebase group room system                      |
| `src/lib/categoryClassifier.ts`      | 589    | Malaysian-food-aware heuristic classifier       |
| `src/lib/googlePlacesRestaurants.ts` | 581    | Google Places API integration                   |
| `src/lib/nearbyCache.ts`             | 485    | Geohash-based IndexedDB cache                   |
| `src/lib/restaurantUtils.ts`         | 427    | Filtering, distance, quality scoring, proximity |
| `src/data/restaurants.ts`            | 371    | Zod-validated local fallback data               |
| `src/hooks/useNearbyRestaurants.ts`  | 272    | Cache-first nearby fetching                     |
| `src/lib/favouritesStore.ts`         | 195    | IndexedDB CRUD for favourites                   |
| `src/lib/feedbackStore.ts`           | 77     | localStorage feedback queue                     |
| `src/hooks/useFavourites.ts`         | 110    | React state wrapper for favourites              |
| `src/hooks/useFeedbackPrompt.ts`     | 35     | Pending feedback check on mount                 |
| `src/types/favourites.ts`            | 43     | FavouriteEntry type definition                  |
| `src/components/FeedbackPrompt.tsx`  | 95     | Post-visit rating dialog                        |
| `src/index.css`                      | 408    | Brand styling, custom animations                |

---

## Decisions Log

| Decision                               | Rationale                                                        |
| -------------------------------------- | ---------------------------------------------------------------- |
| IndexedDB for favourites, not Firebase | Personal/local data. No need for cross-device sync in MVP.       |
| localStorage for feedback queue        | Only stores ~1-3 items. IndexedDB overkill.                      |
| Raw IndexedDB (no `idb` wrapper)       | Matches existing `nearbyCache.ts` pattern. Zero new deps.        |
| 2-hour feedback delay                  | Long enough to have visited; short enough to remember.           |
| 3km proximity radius                   | Covers walking + short drive. Not too wide to be noisy.          |
| Gmail-style undo over confirm dialog   | Faster UX, fewer interruptions, reversible.                      |
| `avoid` = soft-exclude (not delete)    | User might change their mind. Keeps data for future analytics.   |
| Favourite highlighting via Set lookup  | O(1) check per restaurant. Efficient for large lists.            |
| Dropped Google Timeline import         | No public API. "Let's go!" + manual save covers 80% of use case. |
| Dropped PWA background notifications   | Too complex for MVP. Foreground proximity check sufficient.      |
