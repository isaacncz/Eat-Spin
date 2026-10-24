# Agent workflow

A normal request should be enough to start. For Codex, launch inside this repository: root [AGENTS.md](../AGENTS.md) supplies defaults and skills in [`.agents/skills`](../.agents/skills) provide task-specific procedures. Explicit `$eatspin-ui`, `$eatspin-lists-groups`, `$eatspin-delivery` or `$eat-spin-dev` requests are also supported. Restart/reopen a Codex session if newly added skills are not yet discovered; agents can still follow the explicit AGENTS links.

## Request to delivery

```text
Request + existing session decisions
  -> read AGENTS.md and inspect branch/worktree
  -> select relevant skills and owning modules
  -> implement locally, checkpointing milestones
  -> validate, diagnose and resolve routine failures
  -> local commit by default
  -> authorized branch/PR or explicit direct-main delivery
  -> verify remote outcome and report status
```

The user's current instruction takes precedence over the default. “Implement” normally finishes locally. “Push” authorizes publishing the active batch; if no destination has already been specified, use a feature branch and one PR against main. “Push directly to main” specifies direct delivery. Do not ask again for an action already authorized in the active task. Do not treat authorization for an earlier unrelated task as permission to publish a different unfinished batch.

## Instructions, skills, hooks and harnesses

| Mechanism | Responsibility |
| --- | --- |
| `AGENTS.md` | Shared scope, autonomy, validation and delivery defaults |
| `SKILL.md` | A procedure chosen for relevant work; `agents/openai.yaml` permits implicit selection |
| Existing Git pre-push hook | Execute local CI and reject a failed push attempt; no AI repair loop |
| External harness/runner | Start a new agent turn after a stopped session, supplying the task and checkpoint |

The repository's skills have moved from the legacy `.codex/skills/eat-spin-dev` location to `.agents/skills`. Codex's [skill documentation](https://developers.openai.com/codex/skills/) describes discovery and implicit invocation. Do not retain duplicate skill definitions with the same name in both locations.

## Interruptions and routine failures

- **Tests/CI fail:** inspect evidence, fix relevant authorized regressions, and rerun the affected checks. A missing emulator or API configuration is not a passing result. Use mocked API responses and dummy keys where appropriate.
- **User steers the work:** incorporate the message into the current objective. Answer a status question and continue. Stop or replace the objective only when clearly instructed or incompatible with the new request.
- **An answer is needed:** ask one focused question and continue independent work. Do not guess missing authorization for an external action, bypass a denied action or keep reasking a settled decision.
- **A process/session stops:** use the last checkpoint to inspect actual files, Git state, remote actions and test results before continuing. A checkpoint is a hint, not proof that a command finished.

Retries must be bounded and evidence-based. After two attempts at the same failure, change strategy or record the concrete blocker. Avoid repeated pushes/deploys, polling loops and unchanged failing commands. This does not require abandoning independent authorized work.

## Checkpoint contract

Use an ignored path such as `tmp/agent-progress/<task-id>.md` in the active worktree. `tmp/` is already ignored. Save after meaningful milestones and before long checks/handoffs; unexpected termination may occur before the latest step is recorded.

```text
Task: <objective and task id>
Scope and decisions: <accepted behavior, exclusions and user corrections>
Delivery authorization: <local commit / PR branch / explicit main instruction>
Worktree and branch: <path, branch, known head>
Completed: <actual edits/commits/remote actions>
Validation: <commands, results, output/log paths, running process if applicable>
Next action: <one concrete step>
Blockers or pending input: <specific issue or none>
```

Never store keys, tokens, service-account contents or user data in checkpoints. Keep them local by default. A fresh checkout does not contain an ignored checkpoint: the harness must retain/provide its path or an intentionally sanitized handoff. Store any runner's durable state outside files the agent may overwrite.

## External resume integration — not installed here

This documentation does not create a background worker, scheduler, lifecycle hook or automatic restart. A runner would need to:

1. Retain the task, allowed delivery action and checkpoint location across turns.
2. Detect a stopped/failed run and inspect whether the last command/remote action already completed.
3. Start a fresh agent turn with that context. Let the agent re-check the worktree and current remote state before editing or pushing.
4. Cap automatic attempts and resource use; do not duplicate a still-running task. Pause for unresolved user input or denied authorization rather than repeatedly restarting it.
5. Stop after validated authorized delivery or an actionable blocker; no perpetual cron loop.

Add a runner only as a separate implementation request matched to the actual harness. Instructions alone cannot guarantee that another tool will start an agent again.

## Documentation-only validation

Check local Markdown links, referenced source paths and commands, parse all skill frontmatter/agent YAML, confirm unique skill names and compare the final diff with scope. Do not invent a paid service, shipped roadmap feature, deployed rule, installed hook or live deployment in documentation. New app tests are unnecessary when app/build/test code is unchanged; the existing pre-push hook may still enforce its configured checks.
