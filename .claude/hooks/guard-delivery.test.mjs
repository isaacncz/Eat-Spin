// Run: node --test .claude/hooks/guard-delivery.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { checkCommand } from './guard-delivery.mjs'

const decision = (command) => checkCommand(command)?.decision ?? null

test('denies skipping the pre-push hook', () => {
  for (const command of [
    'git push --no-verify',
    'git push -u origin feature --no-verify',
    'npm run build && git push --no-verify origin feature',
    'git -C . push --no-verify',
    'EATSPIN_PREPUSH=off git push',
    "EATSPIN_PREPUSH='off' git push origin feature",
    'env EATSPIN_PREPUSH=off git push',
    'export EATSPIN_PREPUSH=off; git push',
    'git -c core.hooksPath=/dev/null push',
    'GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'" git push',
    'git config core.hooksPath /dev/null',
    'git config --unset core.hooksPath',
    'bash -c "git push --no-verify"',
  ]) assert.equal(decision(command), 'deny', command)
})

test('asks before production deploys', () => {
  for (const command of [
    'firebase deploy --only database',
    'npx firebase-tools@13 deploy',
    'npx -y firebase-tools database:set /rooms data.json',
    'npm exec -- firebase hosting:channel:deploy preview',
    'netlify deploy --prod',
    'npx netlify-cli deploy',
  ]) assert.equal(decision(command), 'ask', command)
})

test('allows normal work', () => {
  for (const command of [
    'git push -u origin feature',
    'EATSPIN_PREPUSH=quick git push',
    'git config core.hooksPath',
    'git config core.hooksPath .githooks',
    'git commit -m "docs: explain git push --no-verify"',
    'grep -n "EATSPIN_PREPUSH=off" .githooks/pre-push',
    'npx firebase-tools emulators:exec --only database "node --test scripts/group-room-rules.test.mjs"',
    'npm run ci:local -- --quick',
    'echo "netlify deploy"',
  ]) assert.equal(decision(command), null, command)
})

test('prints a PreToolUse decision when run as a hook', () => {
  const script = fileURLToPath(new URL('./guard-delivery.mjs', import.meta.url))
  const run = (command) => execFileSync('node', [script], { input: JSON.stringify({ tool_input: { command } }) }).toString()
  assert.equal(JSON.parse(run('git push --no-verify')).hookSpecificOutput.permissionDecision, 'deny')
  assert.equal(run('git status'), '')
  assert.equal(execFileSync('node', [script], { input: 'not json' }).toString(), '')
})
