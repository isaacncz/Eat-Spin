#!/usr/bin/env node
// Claude Code PreToolUse hook for Bash (wired in .claude/settings.json).
// Enforces the AGENTS.md delivery rules that instructions alone cannot:
//   deny: skipping the pre-push CI hook (git push --no-verify, EATSPIN_PREPUSH=off, core.hooksPath changes)
//   ask:  Firebase deploys or live database writes, and Netlify deploys, which need explicit authorization
// It reads the command text Claude writes; it is a guard rail, not a sandbox.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const WRAPPERS = new Set(['command', 'builtin', 'exec', 'nohup', 'time', 'nice', 'timeout', 'sudo', 'env', 'xargs'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash'])
const RUNNERS = new Set(['npx', 'bunx'])
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const FIREBASE_WRITES = /^(deploy|hosting:channel:deploy|database:(set|update|push|remove|import))$/

// Splits a shell command into simple commands (token arrays, quotes removed).
// Operators inside quotes are kept; $(...) and backticks start a new command.
export function splitCommands(text) {
  const commands = []
  let tokens = []
  let token = ''
  let inToken = false
  let quote = ''
  const endToken = () => {
    if (inToken) tokens.push(token)
    token = ''
    inToken = false
  }
  const endCommand = () => {
    endToken()
    if (tokens.length) commands.push(tokens)
    tokens = []
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote === "'") {
      if (ch === "'") quote = ''
      else token += ch
      continue
    }
    if (ch === '\\' && i + 1 < text.length) {
      token += text[++i]
      inToken = true
      continue
    }
    if (quote === '"') {
      if (ch === '"') quote = ''
      else if (ch === '`' || (ch === '$' && text[i + 1] === '(')) endCommand()
      else token += ch
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      inToken = true
    } else if (/\s/.test(ch) && ch !== '\n') {
      endToken()
    } else if (';&|\n()`'.includes(ch)) {
      endCommand()
    } else if (ch === '$' && text[i + 1] === '(') {
      endCommand()
      i++
    } else {
      token += ch
      inToken = true
    }
  }
  endCommand()
  return commands
}

// VAR=value before a command, or after export/env.
function checkAssignment(assignment) {
  if (assignment === 'EATSPIN_PREPUSH=off') return deny('turns off the pre-push hook (EATSPIN_PREPUSH=off)')
  if (/^GIT_CONFIG_(PARAMETERS|KEY_\d+)=.*core\.hookspath/i.test(assignment)) return deny('changes core.hooksPath')
  return null
}

function checkGit(args) {
  let i = 0
  for (; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-c') {
      if (/^core\.hookspath=/i.test(args[i + 1] ?? '')) return deny('changes core.hooksPath')
      i++
    } else if (arg === '-C' || arg === '--git-dir' || arg === '--work-tree' || arg === '--namespace') {
      i++
    } else if (!arg.startsWith('-')) {
      break
    }
  }
  const subcommand = args[i]
  const rest = args.slice(i + 1)
  if (subcommand === 'push' && rest.includes('--no-verify')) return deny('skips the pre-push hook (--no-verify)')
  if (subcommand === 'config') {
    const key = rest.findIndex((arg) => arg.toLowerCase() === 'core.hookspath')
    if (key === -1) return null
    const reads = ['get', 'list', '--get', '--get-all', '--get-regexp', '--list', '-l', '--show-origin']
    if (rest.some((arg) => reads.includes(arg))) return null
    const value = rest[key + 1]
    if (value === undefined && !rest.some((arg) => arg === 'unset' || arg.startsWith('--unset'))) return null
    if (value === '.githooks') return null
    return deny('changes core.hooksPath')
  }
  return null
}

// Returns { decision: 'deny' | 'ask', reason } for the strongest match, or null.
export function checkCommand(text) {
  let result = null
  for (const tokens of splitCommands(text)) {
    const found = checkSimpleCommand(tokens)
    if (found && (!result || found.decision === 'deny')) result = found
    if (result?.decision === 'deny') break
  }
  return result
}

function checkSimpleCommand(tokens) {
  // Leading assignments and wrappers (env, timeout 30, nice -n 5, ...) don't change the program.
  for (;;) {
    while (tokens.length && ASSIGNMENT.test(tokens[0])) {
      const found = checkAssignment(tokens[0])
      if (found) return found
      tokens = tokens.slice(1)
    }
    if (!tokens.length || !WRAPPERS.has(basename(tokens[0]))) break
    tokens = tokens.slice(1)
    while (tokens.length && (tokens[0].startsWith('-') || /^\d+[smhd]?$/.test(tokens[0]))) tokens = tokens.slice(1)
  }
  if (!tokens.length) return null
  let program = basename(tokens[0])
  let args = tokens.slice(1)

  if (program === 'export') return args.map(checkAssignment).find(Boolean) ?? null
  if (SHELLS.has(program)) {
    const flag = args.findIndex((arg) => /^-[a-z]*c[a-z]*$/.test(arg))
    return flag === -1 || args[flag + 1] === undefined ? null : checkCommand(args[flag + 1])
  }
  // npx firebase-tools@13 deploy, npm exec -- netlify deploy, pnpm dlx ..., yarn dlx ...
  const viaPackageManager = ['npm', 'pnpm', 'yarn'].includes(program) && ['exec', 'x', 'dlx'].includes(args[0])
  if (RUNNERS.has(program) || viaPackageManager) {
    args = viaPackageManager ? args.slice(1) : args
    while (args.length && args[0].startsWith('-')) args = args.slice(args[0] === '-p' || args[0] === '--package' ? 2 : 1)
    if (!args.length) return null
    program = args[0].replace(/(.)@.*$/, '$1')
    args = args.slice(1)
  }

  if (program === 'git') return checkGit(args)
  if ((program === 'firebase' || program === 'firebase-tools') && args.some((arg) => FIREBASE_WRITES.test(arg))) {
    return ask('Firebase deploy or live database write')
  }
  if ((program === 'netlify' || program === 'netlify-cli' || program === 'ntl') && args.includes('deploy')) {
    return ask('Netlify deploy')
  }
  return null
}

function deny(what) {
  return {
    decision: 'deny',
    reason: `Blocked by .claude/hooks/guard-delivery.mjs: this command ${what}. AGENTS.md forbids bypassing the pre-push CI checks. Fix the failing check or ask the user.`,
  }
}

function ask(what) {
  return {
    decision: 'ask',
    reason: `${what}: AGENTS.md requires explicit authorization for production actions. Approve only if you asked for this.`,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let command = ''
  try {
    command = String(JSON.parse(readFileSync(0, 'utf8'))?.tool_input?.command ?? '')
  } catch {
    process.exit(0) // unreadable input: no decision, normal permission flow applies
  }
  const result = checkCommand(command)
  if (result) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: result.decision,
        permissionDecisionReason: result.reason,
      },
    }))
  }
}
