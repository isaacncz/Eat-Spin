# Mobile-first redesign: design preview

Status: preview only, nothing implemented. Tracks #71 (mobile-first redesign). CI enforcement is tracked in #73.

Baseline frame is 390x844. Names, places and numbers in the boards are sample data.

## Screens

| File | Screen | Notes |
| --- | --- | --- |
| `AppSpin.dc.html` | A1 Spin | HUD, mood chips, one-line filter summary, wheel, pinned Spin button, bottom tab bar |
| `AppFilters.dc.html` | A2 Filters sheet | Bottom sheet: range, price, food type, serves; pinned "Show N places" button |
| `AppResult.dc.html` | A3 Result | Rarity ribbon, distance, hours, reward tiles, pinned "Let's go! Claim reward" |
| `AppList.dc.html` | A4 My list | List chips, rows with 44px remove buttons, add-place input above the tab bar |
| `AppGroup.dc.html` | A5 Group | Room code, who is in the room, "Start spin for everyone" |
| `AppMe.dc.html` | A6 Me | Level, streak, coins, spins, most visited, settings |

`canvas.json` holds the board positions. The `.dc.html` files are Design Component sources and
render in the Claude Design canvas; they reference a `support.js` that is not in this repo.

## Layout rules

- Four-tab bottom bar: Spin, My list, Group, Me. It replaces the desktop navbar and the landing sections.
- The primary action of each screen is pinned at the bottom, in the thumb zone.
- Filters live in a bottom sheet instead of a side panel.
- Interactive targets are at least 44x44 px.
- Safe-area padding below the tab bar (`env(safe-area-inset-bottom)`).
- Honour `prefers-reduced-motion`.

## Colour rules

Tokens come from `tailwind.config.js` (arcade palette from #61).

| Token | Hex | Use |
| --- | --- | --- |
| ink | `#1E1B4B` | text, borders, hard shadows |
| yellow | `#FFD93D` | page background |
| pink | `#FF4D8D` | primary action, active tab |
| cyan | `#22D3EE` | selected chips, coin tiles |
| lime | `#A3E635` | positive state, claim button |
| violet | `#C4B5FD` | accents |
| orange | `#FB923C` | streak |
| brand-orange | `#D6246E` | the only background that takes white text (4.84:1) |

Text on bright colours is ink. White text is used only on brand-orange.

## Proposed implementation order (stacked PRs, after approval)

1. App shell and bottom tab bar, with the desktop navbar removed.
2. Spin screen and Filters sheet.
3. Result screen.
4. My list, Group and Me screens.

## Open questions

- HowItWorks, Features, Testimonials and CTA are not in the mobile flow. Drop them, or move them behind "About"?
- Group and Me as separate tabs, or merged into one?
