# Development workflows

## UI or section copy

Locate the screen/component through the project map and use [eatspin-ui](../../eatspin-ui/SKILL.md). Keep logic in existing domain modules. Copy must describe current behavior; remove invented metrics, reviews and inert actions. Keep existing meaningful browser assertions when controls or labels change.

## Personal lists, shared links or Group rooms

Use [eatspin-lists-groups](../../eatspin-lists-groups/SKILL.md). Trace persistence and permissions before changing UI. Keep personal lists separate from room data and shared snapshots. Update supplied rules only when server authorization/schema semantics require it; publishing is a separate, explicitly authorized operation.

## Places, destination or cache work

1. Define the affected search center, radius, availability, categories, TTL, source/fallback or budget policy.
2. Trace requests in the relevant `googlePlaces*` library, hook orchestration, cache keys and result consumers. Preserve cancellation and stale-response protection when any search dimension changes.
3. Keep GPS separate from a selected destination. Preserve original destination fetch age on reload and the currently implemented names/address storage boundary.
4. Verify Google API fields, session billing and storage assumptions against current official documentation before changing them. Do not infer cost from request count or assume the guard covers photo requests.
5. Update `.env.example` and operator documentation if contracts change. Preserve the four usage kinds and supplied rules when relevant.
6. Use mocked responses and dummy test keys for API regressions; avoid spending live requests for routine validation. See the validation matrix.

## Shared model or storage work

Trace producers and consumers of `src/types/index.ts` and any persisted shape. Design migration/backward behavior before writing. Do not change IDs to hide migration failures. Add meaningful failure, reload or concurrency coverage when behavior requires it.

## Documentation or skills

Verify claims against current source and commands against package/workflow scripts. Keep plans clearly labelled. Validate local links, reference paths, skill frontmatter and agent metadata. Use [delivery guidance](../../eatspin-delivery/SKILL.md) for a single reviewable batch; no app behavior change means no new app test is required.
