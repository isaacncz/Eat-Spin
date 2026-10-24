# Validation matrix

Choose checks for the changed behavior; record commands and outcomes. Preserve required CI and existing assertions. Do not rerun a passing suite without a new change, failure or unresolved concern.

| Change | Local evidence |
| --- | --- |
| Markdown/skills only | Parse skill frontmatter and `agents/openai.yaml`; verify local links, file references, documented commands and `git diff --check`. No new app test required. |
| UI/copy/component | Build/typecheck, focused ESLint, affected browser specs and visual checks at phone/desktop widths. For runtime delivery, run required local CI. |
| Library or hook behavior | Relevant meaningful unit tests plus build and affected browser flows; required local CI before runtime delivery. |
| Lists/storage/sharing | Reload, cross-tab changes, stable/independent IDs, failed saves/retry, undo and shared-link errors, plus relevant critical specs. |
| Room synchronization or supplied rules | Isolated rules emulator and real multi-client hook tests, including unauthorized writes and reconnect. No live credentials/data. |
| New static logo/audio asset | Regeneration, size/format/visual or playback checks, public-asset/service-worker references, relevant wheel/audio regressions and build. |

## Existing commands

Run from the repository root after `npm ci`; install Chromium with `npx playwright install chromium` when needed.

```sh
npm run build
npm run lint
npm run test:unit
npm run test:e2e -- tests/critical-
npm run ci:local
```

`ci:local` runs typecheck, unit tests and the required smoke/result/Group-Me/critical browser flows with service keys empty and CI browser settings. `--quick` omits browsers, so it is not equivalent to a full pass. The emulator job is separate; follow `.github/workflows/ci.yml` for the isolated Firebase tools/SDK setup. `tests/critical-group-sync.spec.ts` requires `EATSPIN_GROUP_EMULATOR=1` and the demo emulator.

ESLint and `test:cache` have existing advisory failures in CI. Compare failures with main; do not suppress a new issue, weaken a test or claim the whole check passed because its failure was previously known. An emulator-only skip is a skip, not a pass.

## UI regression scenarios

- Picker/search results, close/cancel, focus restoration and keyboard-only navigation.
- At least 360px and 390px phone widths and desktop; long names and no horizontal overflow.
- An overlaying software keyboard: use the visual viewport, not just a resized layout viewport.
- Reduced motion, optional sound, unmount/mute/hidden-tab cancellation for wheel changes.
- Existing My list/Group separation, shared result reveal and start-button tab navigation.

## External-service scenarios

Mock success, permission failure, empty data, aborted/late responses and budget exhaustion as relevant. API mocks may still need a dummy Google key to pass the configuration guard; keep every external request intercepted. Do not read or print real keys to make a test pass. Verify actual deployed rules/site state separately when deployment is authorized.
