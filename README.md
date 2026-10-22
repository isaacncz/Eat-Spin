# EatSpin

Spin a wheel to pick where to eat from **your own list**. Optional group rooms let friends spin the same list in real time.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Firebase Realtime Database (group rooms only), GSAP, Playwright.

## Setup

```sh
npm ci
cp .env.example .env   # fill in Firebase values (only needed for group rooms)
npm run dev            # http://localhost:5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check and production build |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright tests |

## Environment

See `.env.example`. Firebase variables are only required for group rooms; `VITE_GA_MEASUREMENT_ID` enables analytics.

## Data

Lists, favourites, and spin history are stored in the browser (localStorage / IndexedDB). Nothing is sent to a server except group-room data.
