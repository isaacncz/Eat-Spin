---
name: eatspin-ui
description: Design, preview, implement and validate EatSpin UI, copy, accessibility, mobile keyboard behavior, branding and wheel sound. Use for screens, pickers, dialogs, result flows and visual changes; preserve existing data and room behavior.
---

# EatSpin UI

1. Read root [AGENTS.md](../../../AGENTS.md) and the [project map](../eat-spin-dev/references/project-map.md). Identify the existing owning screen/component and its callbacks before adding state.
2. For a design/preview request, prepare a clearly labelled prototype or local screenshot without silently treating it as production implementation or deployment. After implementation, inspect the actual screen, not just the prototype.
3. Use the existing Fredoka type, navy outlines, arcade colors, spacing and primitives from `src/index.css`, `tailwind.config.js`, `src/screens/arcade.tsx` and `src/components/ui`. Reuse the app's sheet/confirmation patterns instead of introducing native confirm dialogs for app decisions.
4. Keep business logic in its owning hook/library. A UI affordance must call a real action; do not add placeholder buttons, invented reviews/counts, payment promises or unsupported feature claims.
5. Check 360px/390px phones and desktop. Keep important controls reachable, provide usable touch targets, wrap long text, and avoid overflow. For editable sheets/search, test the visible viewport above a keyboard; don't autofocus a phone search merely to switch a list.
6. Give controls accessible names and selected states, retain dialog focus trapping/Escape/cancel, restore focus to the opener and handle empty/loading/error states. Respect reduced motion. Test changed behavior with meaningful browser regressions rather than implementation-mirroring tests.
7. For branding/audio, preserve approved source assets and follow [logo regeneration](../../../assets/brand/README.md) or [sound regeneration](../../../assets/audio/README.md). Keep audio gesture-activated and cancellable; don't add late win playback or photo prefetch as incidental polish.
8. Use the [validation matrix](../eat-spin-dev/references/validation-checklists.md) and [delivery skill](../eatspin-delivery/SKILL.md). Preserve list/Group semantics; read [lists/Group](../eatspin-lists-groups/SKILL.md) when those domains are affected.
