---
name: eatspin-lists-groups
description: Implement or debug EatSpin personal lists, backups, fixed sharing and Firebase Group rooms. Use for persistence, cross-tab updates, import/export, roles, presence, shared spins, replay/history, attendance or room lifecycle changes.
---

# EatSpin lists and Group rooms

Read root [AGENTS.md](../../../AGENTS.md), the [project map](../eat-spin-dev/references/project-map.md), [rollout contracts](../../../docs/list-group-rollout.md) and [sharing behavior](../../../docs/list-sharing.md) as relevant. Check the actual source before relying on historical rollout notes.

## Personal lists

- Trace `useManualLists`, `listOperations` and the selected-list consumer. Keep legacy migration, stable IDs and v2 journal replay compatible.
- Do not replace a full collection from a stale tab, resurrect deleted IDs, silently discard failed writes or compact the journal without a concurrency-safe design.
- Duplicate, restore and shared import create independent IDs. Restore adds selected copies atomically. Undo preserves unrelated/remote changes.
- A list switch/search/preview is local UI behavior. Personal list browsing, editing and importing do not publish to a Group room.

## Shared snapshots

- Sharing explicitly chooses one list; snapshot fields omit history, photos and personal ratings. Keep cloud records immutable and recipient copies independent.
- Distinguish link expiry/revocation from deleting cloud records and from recipients' existing local copies. Do not claim automatic cleanup is installed.
- Check offline, invalid/expired/revoked links, failed local import and owner-only revocation. A loaded preview may be saved locally while a Group room remains independent.

## Group rooms

- Preserve host/co-host/member roles. The host explicitly assigns co-hosts or transfers ownership; disconnection does not promote a guest automatically.
- Keep shared room places in Group. Loading a personal list is an explicit action and replacing existing room places requires the app confirmation.
- Merge room edits with transactions/deltas and retain failed operations for acknowledged retry. Scope pending work and asynchronous callbacks to the room/session; the pending queue is not durable offline storage.
- Differentiate local offline state from missing/stale host presence. Reinstall consumed disconnect cleanup and restore complete participant records on reconnect. Rename without changing UID, join time, roles or votes.
- Count a unique committed Group spin once per browser/user across replay and reload. Recent results animate; older results display directly. Do not reveal the winner before the client's reveal completes. Attendance belongs to the current spin and active participants.
- Prefer/avoid nominations are advisory; avoid is not a veto. Only an explicit nominated-only selection narrows the candidates.

## Validation and rules

Trace server rules as well as UI guards when changing authorization. Add meaningful reload, multi-client, failure/retry or unauthorized-write coverage for affected contracts. Follow the [validation matrix](../eat-spin-dev/references/validation-checklists.md); rule/sync changes require isolated emulator checks, not just mocked UI tests.

Supplied rules are code for review, not proof of deployed rules. Do not publish rules, run administrative cleanup or write production data without explicit task authorization. Do not silently broaden permissions to make a failing test pass. Use [delivery guidance](../eatspin-delivery/SKILL.md) to finish the batch.
