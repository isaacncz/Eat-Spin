---
name: eatspin-delivery
description: Validate and deliver EatSpin changes through local commits, GitHub PRs, CI triage or authorized direct-main pushes while limiting repeated Netlify builds. Use for delivery, failures, resumable work and deciding which checks match a change.
---

# EatSpin delivery

Read root [AGENTS.md](../../../AGENTS.md), the [validation matrix](../eat-spin-dev/references/validation-checklists.md) and [agent workflow](../../../docs/agent-workflow.md).

1. Check current branch/worktree, user changes and the latest relevant main/PR head. Avoid duplicate implementation PRs or overwriting other work. Use an isolated worktree for independent changes.
2. Complete the authorized batch locally before pushing. Default delivery is one local commit; existing task authorization overrides that default. When a push is authorized without a destination, publish a feature branch and create/update one PR against `main`; direct main delivery needs an explicit instruction. Preserve an already specified PR/destination across follow-ups.
3. Run checks for the changed behavior. Markdown/skills-only work needs documentation/metadata checks, not new app tests. Runtime work needs build and relevant tests plus required local CI; rules/sync work also needs isolated emulator coverage. Do not report skipped emulator cases as passed.
4. Inspect failures, separate configuration/baseline issues from regressions, and fix routine authorized issues without repeatedly asking. Preserve existing assertions; do not weaken tests, suppress new lint errors or silently bypass hooks. After two failed evidence-based attempts, change approach or report the actual blocker and continue independent work.
5. The existing `.githooks/pre-push` runs `scripts/ci-local.sh` after installation enables it. It validates; it does not repair code or resume the agent. `--quick` is a partial check. Don't edit/bypass hooks simply to make a push succeed, or repeat a passed suite without a reason.
6. Before a push, inspect the final diff, exclude credentials/artifacts, verify the intended base/destination and use a concise commit/PR description explaining the behavior and validation. For multiline GitHub CLI text use a body file; prefer structured connector arguments where available.
7. Batch pushes to reduce Netlify previews. Do not trigger redundant deploys, force-push shared work or merge a PR without task authorization. Publishing Firebase rules/data is separate from shipping client code. A docs-only push may still build unless hosting ignores it.
8. After an authorized push, verify the remote head/PR and report CI/deployment status honestly. Verify live output before claiming a release is live; do not expose bundled credentials while inspecting artifacts. Do not wait indefinitely for unrelated external work after completing the requested delivery.
9. Checkpoint before long checks/handoffs and after meaningful milestones. Treat later user messages as task steering unless clearly cancelling/replacing it. A stopped process needs an external harness to resume; never claim Git hooks/skills install that capability.
