# Validation Checklists

## Required Commands
Run from repository root:

```bash
npm run lint
npm run build
```

Record pass/fail state and include key error output if failing.

## Manual Scenario Checklist

### Location Flow
- Load app with location permission allowed; confirm nearby flow activates.
- Deny location permission; confirm fallback messaging and non-crash behavior.

### Source Banner Behavior
- Confirm banner text reflects active source state:
  - Loading nearby
  - Cached nearby results (`google-cache`)
  - Live nearby results (`google-live`)
  - Local fallback (`local-fallback`)

### Cache Fallback Behavior
- Simulate/observe Google failure path and confirm cached results are used when available.
- Confirm local fallback activates only when both live fetch and usable cache are unavailable.

### Manual Spin List and Presets
- Add, deduplicate, remove, clear manual restaurants.
- Save and delete presets.
- Verify preset load behavior and manual wheel reset/spin flow.

### Group Room Lifecycle and Roles
- Create room as host.
- Join room from another participant identity.
- Confirm host/co-host can edit list and start spin.
- Confirm non-host/non-co-host cannot start room spin.
- Verify room join/leave and shared list sync behavior.

## Failure Triage Checklist

### Environment and Config
- Confirm `.env` values exist for required Firebase and Google keys.
- Confirm `.env.example` reflects required keys and documented defaults.
- Confirm Firebase Anonymous Auth is enabled in project settings.
- Confirm RTDB rules are current with `docs/firebase-rtdb-rules.json`.

### Network and API
- Check browser console for fetch/network errors.
- Check Google Places error payload and rate/permission status.
- Check Firebase permission-denied and connectivity errors.

### Data and Contract Integrity
- Verify source labels remain `google-live`, `google-cache`, `local-fallback`.
- Verify type changes are propagated across hooks/libs/components.
- Verify no stale assumptions around cache TTL, radius, or ranking order.
