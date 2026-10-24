# EatSpin

A food wheel for choosing where to eat, using nearby places, your own lists, or a shared Group room.

[Open EatSpin](https://eat-spin.netlify.app) · [Agent workflow](docs/agent-workflow.md) · [Project map](.agents/skills/eat-spin-dev/references/project-map.md)

## What works today

- **Spin:** find places around your location or a chosen area, search for food, and filter the options before spinning. Radius presets are 1, 3, 5 and 10 km; the default is 5 km. Returning users retain their saved selection or a migrated legacy range.
- **My list:** create multiple name-based lists, find them with the searchable picker, and spin the selected list. Favourites have a separate picker entry. Duplicate lists, export selected lists, or restore independent copies from a backup.
- **Share a list:** publish a fixed copy of one selected list. Friends can save independent personal copies. Links expire after seven days; editing your personal list does not change an existing snapshot.
- **Group:** create or join a room with a code/link. Hosts and co-hosts manage the shared places and start spins; connected participants receive the same winner. Personal lists stay separate until someone explicitly loads a list into the room.
- **Me and results:** local spin history, progress, saved places, result sharing, and the About guide. Recent Group results animate on replay; older results open directly.
- **Mobile UI:** bottom navigation, sheets/dialogs, a Pizza Pick logo, optional Arcade click sounds, and installation prompts on supported browsers.

There is no implemented paid subscription/payment service. Legacy premium UI is not a supported billing feature.

## Run locally

Use Node.js 22.12+ on the 22.x line, or a supported newer LTS such as Node.js 24, and npm. CI currently uses Node.js 22; see the [workflow](.github/workflows/ci.yml).

```sh
git clone https://github.com/isaacncz/Eat-Spin.git
cd Eat-Spin
npm ci
npm run dev
```

Open <http://localhost:5173>. Run commands from the repository root; there is no `app/` subdirectory.

Personal lists and the bundled fallback UI can be used without external API credentials. The fallback dataset has limited geographic coverage; it is not a substitute for live discovery everywhere.

`npm ci` also runs the existing `prepare` script, which sets this clone's `core.hooksPath` to `.githooks`. The [pre-push hook](.githooks/pre-push) runs local CI before a push.

## Configure external features

For live services, copy the example and replace or remove unused placeholder values:

```sh
cp .env.example .env.local
```

Restart Vite after editing environment variables. Set the same required values in your hosting provider for production builds. Vite exposes `VITE_*` values to the browser: never put service-account credentials or other server secrets in them, and never commit populated environment files.

### Google Places

Enable **Places API (New)** in a billing-enabled Google Cloud project. Configure `VITE_GOOGLE_MAPS_API_KEY` with restrictions appropriate to the APIs and domains used by your deployment. The current discovery client uses Places REST endpoints for Nearby Search, Text Search, Autocomplete and Details.

| Variable | Purpose / default |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Required for live Places requests |
| `VITE_GOOGLE_PLACES_REGION` | Region context; `MY` |
| `VITE_GOOGLE_PLACES_LANGUAGE` | Response language; `en` |
| `VITE_NEARBY_CACHE_TTL_DAYS` | Nearby snapshot TTL; `7` |
| `VITE_NEARBY_CACHE_MIN_RESULTS` | Results needed to reuse a matching cache; `12` |
| `VITE_NEARBY_CACHE_MOVEMENT_THRESHOLD_KM` | Maximum movement from cached center; `0.1` |
| `VITE_NEARBY_CACHE_AREA_KM` | Legacy fallback for the movement threshold |
| `VITE_PLACES_MONTHLY_CAP` | Request guard per usage kind/month; `1000` |
| `VITE_PLACES_BLOCK_AT_PERCENT` | Guard threshold percentage; `90` |

Nearby cache matching includes the search center, radius, categories and availability selection. Matching cached results can avoid another Nearby request. Candidate ranking uses a quality score that combines rating and review volume, followed by distance; it is not a guarantee of restaurant quality.

The budget guard tracks `nearby`, `text`, `autocomplete` and `details` requests, shared through Firebase when configured and otherwise local to the browser. It is a request counter, not a dollar budget, billing estimate or guarantee of free usage. Photo media requests are separate. Use Google Cloud quotas and billing monitoring as appropriate.

See [destination search](docs/destination-search.md) for persistence/session details and [photo usage](docs/photo-usage.md) for loading behavior. Check current Google documentation before changing API fields, storage policy or billing assumptions.

### Firebase

Cloud sharing and realtime/social features require Firebase Realtime Database and Anonymous Authentication. Configure:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
```

Enable Anonymous sign-in, create a Realtime Database, and configure applicable authorized domains for your authentication setup. Review [the supplied rules](docs/firebase-rtdb-rules.json) against your project. Publishing rules is a separate deployment action; committing this file does not publish it.

| Database path | Used for |
| --- | --- |
| `rooms/*` | Group lists, presence, roles, spins, preferences, reactions and attendance |
| `sharedLists/*` | Immutable personal-list snapshots |
| `usage/places/*` | Shared Places request counters |
| `challenges/*` | Seven-day challenges |
| `discover/*` | Nearby activity events |

Live Firebase configuration and installed rules must be checked independently; local tests do not prove what is deployed. The emulator job uses an isolated demo project, not production data.

### Analytics

`VITE_GA_MEASUREMENT_ID` enables optional Google Analytics. Omit it to leave that integration unconfigured. Do not describe the application as having no tracking when this integration is enabled.

## Storage and sharing boundaries

Personal lists are stored in this browser profile. They do not automatically sync between devices. Export a backup for a portable copy; restore adds independently identified lists without replacing the existing collection. Backups are limited to 2 MB and 100 lists per file.

Shared links contain a fixed snapshot of the selected list's name, meal time and place names, rather than personal history, ratings or photos. Recipients' saved copies remain after a link expires or is revoked. Owners can revoke a generated link while its share dialog is open; there is currently no saved-link management screen.

Expiry blocks access to a shared snapshot under the supplied rules. It does **not** automatically delete the stored record. Group offline edits are an in-memory pending queue and do not survive reload. Local data can also be lost when browser storage is cleared or unavailable.

Details: [list sharing](docs/list-sharing.md), [list/Group behavior](docs/list-group-rollout.md), and [administrative room cleanup](scripts/README.md). The room-cleanup script does not clean up shared-list snapshots.

## Validate changes

| Command | What it checks |
| --- | --- |
| `npm run build` | TypeScript project build and production assets |
| `npm run lint` | ESLint; existing legacy failures remain advisory in CI |
| `npm run test:unit` | Pure-function/unit regressions |
| `npm run test:e2e -- tests/critical-` | Critical browser regressions on Chromium and mobile |
| `npm run ci:local` | Typecheck, unit tests, and required smoke/result/Group-Me/critical browser flows |
| `npm run ci:local -- --quick` | Typecheck and unit tests only |

Install the browser once with `npx playwright install chromium`. The full local CI command uses empty service keys and CI browser settings. It does not run the Firebase emulator job. Shared-list/rules/room-sync changes also need the isolated emulator checks in the [CI workflow](.github/workflows/ci.yml), using Java 21 and the test tools described there. Record emulator-only skips rather than calling them passes.

For documentation-only changes, validate links, referenced paths, skill metadata and the diff. App tests are needed when app behavior or its build/test configuration changes. The existing push hook may still run its configured full checks; do not silently disable it. See [validation guidance](.agents/skills/eat-spin-dev/references/validation-checklists.md).

## Work with an AI agent

Start Codex inside this repository. [AGENTS.md](AGENTS.md) gives the shared defaults, and repo skills live in [`.agents/skills`](.agents/skills). Relevant skills can be selected from a normal request, or named explicitly:

```text
Use $eatspin-ui to preview a clearer My list empty state.
Use $eatspin-lists-groups to fix this room synchronization bug.
Use $eatspin-delivery to validate this commit and create a PR against main.
```

Default delivery is a local commit. An authorized push uses a feature branch and a PR against `main` unless you explicitly request direct main delivery. Batch implementation before pushing to avoid repeated Netlify previews. GitHub/Netlify may still build a docs-only push unless their hosting settings exclude it.

Skills guide work; Git hooks run checks. Neither restarts a stopped agent. [The agent workflow](docs/agent-workflow.md) documents checkpoints, routine failure handling and the external harness needed for automatic resume. It does not install a background runner or cron job.

## Project and asset notes

React 19, TypeScript, Vite 7, Tailwind, Radix UI, Firebase and Playwright power the app. Domain ownership is documented in the [project map](.agents/skills/eat-spin-dev/references/project-map.md).

- [Logo source and icon regeneration](assets/brand/README.md)
- [Approved sound source and regeneration](assets/audio/README.md)
- [Detailed Group/list rollout](docs/list-group-rollout.md)
- [Product roadmap](docs/eat-spin-product-roadmap.md) — planned work is not a claim that a feature has shipped.

A `LICENSE` file is not currently checked in. This README does not select or change the project's licensing terms.
