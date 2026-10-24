---
name: eat-spin-dev
description: Locate modules and plan scoped work in the EatSpin React and TypeScript repository. Use for feature, refactor, bug-fix or documentation work when ownership or current app behavior needs checking; route UI, lists/Group and delivery tasks to their specialist skills.
---

# EatSpin development

1. Read root [AGENTS.md](../../../AGENTS.md), the current user scope and the [project map](references/project-map.md).
2. Locate the producer, consumer and persisted contract before changing behavior. Treat `src/App.tsx` as orchestration; extract domain logic into focused hooks/libraries/components.
3. Read the relevant section of [workflows](references/workflows.md). Load [UI](../eatspin-ui/SKILL.md), [lists/Group](../eatspin-lists-groups/SKILL.md) or [delivery](../eatspin-delivery/SKILL.md) guidance only when relevant.
4. Preserve unrelated changes, credentials, existing IDs/migrations, role semantics and restaurant source values: `google-live`, `google-cache`, `local-fallback`.
5. Follow the [validation matrix](references/validation-checklists.md). Do not equate a main-branch lint failure or an emulator-only skip with a newly introduced failure or a passing check.
6. Complete authorized work, checkpoint progress, and deliver according to the user's current commit/PR/main instruction. If no commit was requested or made, a short ready-to-use commit message may be supplied; do not repeat one after reporting an actual commit.

Verify feature claims against current code. Keep historical plans distinct from shipped behavior. Do not claim real payments, automatic cloud sync of personal lists, automatic expired-record deletion, worldwide discovery, or installed automatic resume unless those capabilities are implemented and verified.
