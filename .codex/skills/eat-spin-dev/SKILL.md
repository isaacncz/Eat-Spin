---
name: eat-spin-dev
description: Architecture-first development copilot for the Eat-Spin React + TypeScript app. Use when implementing, refactoring, or debugging features in this repo, especially around App orchestration, Google Places nearby caching, Firebase group-spin sync, restaurant filtering, and section/component UI updates.
---

# Eat-Spin Development

## Execution Contract
- Treat `src/App.tsx` as the orchestration layer.
- Prefer extraction-first changes: add new business logic in `src/hooks`, `src/lib`, and focused components before expanding `App.tsx`.
- Keep changes minimal and behavior-preserving unless the request explicitly asks for behavior changes.
- Preserve stable data contracts and role/permission semantics across integrations.

## Repo Workflow
1. Locate the owning domain module using `references/project-map.md`.
2. Choose the smallest safe change set for the requested behavior.
3. Implement with extraction-first boundaries.
4. Run `npm run lint` and `npm run build`.
5. Run relevant manual checks from `references/validation-checklists.md`.
6. Summarize assumptions, tradeoffs, residual risks, and validation results.
7. When files were changed, always provide at least one ready-to-use commit message.

## Reference Loading Rules
- Load `references/project-map.md` first for file targeting and contract boundaries.
- Load `references/workflows.md` for implementation procedure by change type.
- Load `references/validation-checklists.md` before finalizing any implementation.
- Load only the sections needed for the active task to keep context lean.

## Hard Rules
- Preserve existing environment-variable and config contracts.
- Do not change source labels: `google-live`, `google-cache`, `local-fallback`.
- Do not break Firebase host/co-host/participant permission semantics.
- Keep UI changes aligned with existing design tokens in `src/index.css` and current section/component structure.
- Avoid broad refactors unless explicitly requested.
- Always include a commit message suggestion after any completed file changes.

## Done Criteria
- `npm run lint` passes.
- `npm run build` passes.
- Relevant manual scenarios pass using `references/validation-checklists.md`.
- Final summary includes assumptions, chosen defaults, and known tradeoffs.
- Final response includes at least one commit message suggestion when changes were made.
