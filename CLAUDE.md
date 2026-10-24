@AGENTS.md

## Claude Code

- Skills: `.claude/skills/*` are symlinks to `.agents/skills/*`, shared with Codex. Edit the `.agents/skills` files. Claude picks them from a normal request, or invoke `/eat-spin-dev`, `/eatspin-ui`, `/eatspin-lists-groups` or `/eatspin-delivery`.
- `.claude/settings.json` pre-approves the local check commands and runs `.claude/hooks/guard-delivery.mjs` before each Bash call. It refuses pre-push hook bypasses (`git push --no-verify`, `EATSPIN_PREPUSH=off`, `core.hooksPath` changes) and asks before Firebase or Netlify deploys. Don't route around it: fix the check or ask the user. Its tests: `node --test .claude/hooks/guard-delivery.test.mjs`.
- Personal overrides go in `CLAUDE.local.md` or `.claude/settings.local.json` (git-ignored).
