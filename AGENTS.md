# Working on EatSpin

## Start each task

- Read the user's current request and the existing session decisions. Treat follow-up messages as steering the active task unless the user clearly cancels or replaces it.
- Check the branch, worktree and pending changes. Preserve unrelated work and credentials; use an isolated worktree when needed.
- Use [eat-spin-dev](.agents/skills/eat-spin-dev/SKILL.md) to locate the owning module, then load only relevant specialist guidance:

| Task | Skill |
| --- | --- |
| UI, mobile layout, accessibility, branding or sound | [eatspin-ui](.agents/skills/eatspin-ui/SKILL.md) |
| Personal lists, sharing or Group room behavior | [eatspin-lists-groups](.agents/skills/eatspin-lists-groups/SKILL.md) |
| Validation, commits, PRs, CI or delivery | [eatspin-delivery](.agents/skills/eatspin-delivery/SKILL.md) |

The user's instructions and already granted task authorization take precedence over these defaults. Do not ask again for authorization already given in the active session.

## Work autonomously within scope

- Implement authorized work through validation. Diagnose routine failures and make reversible fixes without repeatedly asking for confirmation.
- Continue independent work while a missing answer or external blocker affects another part of the task. Ask focused questions only when an answer materially changes the work and cannot be inferred.
- Use bounded, evidence-based retries. After two attempts at the same failure, change strategy or report the specific blocker; do not loop unchanged commands or generate repeated builds.
- Checkpoint meaningful milestones and before long checks/handoffs in an ignored `tmp/agent-progress/<task-id>.md`. Include objective, branch/head, completed work, test evidence, next action and blockers; exclude credentials. See [resume guidance](docs/agent-workflow.md).
- Skills and Git hooks do not restart stopped sessions. An external harness must resume from the task and checkpoint; do not claim automatic resume is installed.

## Preserve app contracts

- Keep `src/App.tsx` as orchestration. Prefer focused hooks, library functions and components over broad refactors.
- Preserve personal/room separation, stable IDs, storage migrations, role permissions and once-per-event Group history.
- Use existing design tokens and accessible app dialogs. Verify mobile keyboard/focus behavior when changing interactive UI.
- Never weaken required tests, expose credentials, publish Firebase rules or touch live data as a side effect of unrelated work. Production Firebase actions require explicit task authorization.

## Validate and deliver

- Choose checks from the [validation matrix](.agents/skills/eat-spin-dev/references/validation-checklists.md). Documentation-only work does not need new app tests. Runtime changes need relevant unit/browser coverage and the required local CI checks; rule/sync changes also need emulator checks.
- Distinguish new failures from existing main failures. Report actual passes, failures and skipped checks accurately.
- Default to one local commit after completing the batch. Push when authorized; use a feature branch and PR to `main` unless the user explicitly requests direct main delivery. Do not merge PRs without authorization.
- Avoid intermediate pushes, duplicate PRs, stacked implementation PRs and redundant Netlify builds. Keep production rules/data deployment separate from client delivery.
- Report the result, validation and any real blocker concisely. Do not claim a deployment is live until verified.
