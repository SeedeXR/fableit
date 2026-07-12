'use strict';

// fableit — hooks.json integrity + hook-script behaviour.
//
// Why this file exists: Claude Code runs every hook command through bash on
// ALL platforms (including Windows/Git Bash). A hook whose command isn't valid
// bash, or a UserPromptSubmit hook that exits non-zero, silently BLOCKS every
// prompt. That is exactly the regression this suite guards against. See the
// self-check at the bottom, which asserts the guard actually has teeth against
// a known-bad fixture.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, 'hooks');
const HOOKS_JSON = path.join(HOOKS_DIR, 'hooks.json');

// Fields that Claude Code will hand to a shell. `commandWindows` is a legacy
// field some hosts pick up on Windows; if present it is ALSO run through bash,
// so it must be valid bash too. Validate every one of them.
const SHELL_FIELDS = ['command', 'commandWindows'];

function bashAvailable() {
  try { execFileSync('bash', ['-c', 'true'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

// Returns a list of human-readable problems. Empty list = the file is safe.
function validateHooksFile(file) {
  const problems = [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return [`invalid JSON: ${e.message}`];
  }
  const events = parsed && parsed.hooks;
  if (!events || typeof events !== 'object') return ['missing top-level "hooks" object'];

  for (const [event, groups] of Object.entries(events)) {
    if (!Array.isArray(groups)) { problems.push(`${event}: expected an array`); continue; }
    groups.forEach((group, gi) => {
      const handlers = group && group.hooks;
      if (!Array.isArray(handlers)) { problems.push(`${event}[${gi}]: missing "hooks" array`); return; }
      handlers.forEach((h, hi) => {
        const where = `${event}[${gi}].hooks[${hi}]`;
        if (h.type !== 'command') { problems.push(`${where}: type must be "command"`); return; }
        if (typeof h.command !== 'string' || !h.command.trim()) {
          problems.push(`${where}: "command" must be a non-empty string`);
        }
        // Every shell-bearing field must parse as bash. This is the check that
        // catches PowerShell (or any non-bash) syntax like `if (...) { }`.
        for (const field of SHELL_FIELDS) {
          if (typeof h[field] !== 'string') continue;
          try {
            execFileSync('bash', ['-n', '-c', h[field]], { stdio: 'pipe' });
          } catch (e) {
            const msg = (e.stderr ? e.stderr.toString() : e.message).trim().split('\n').pop();
            problems.push(`${where}.${field}: not valid bash -> ${msg}`);
          }
        }
        // The referenced script must exist in hooks/.
        const m = /([A-Za-z0-9_.-]+\.js)/.exec(h.command || '');
        if (m && !fs.existsSync(path.join(HOOKS_DIR, m[1]))) {
          problems.push(`${where}: references missing script hooks/${m[1]}`);
        }
      });
    });
  }
  return problems;
}

// Run a hook script with a mock stdin payload in an isolated config dir, so we
// never touch the developer's real ~/.claude/.fableit-active flag.
function runHook(script, stdin) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fableit-test-'));
  try {
    const out = execSync(`node "${path.join(HOOKS_DIR, script)}"`, {
      input: stdin,
      env: { ...process.env, CLAUDE_CONFIG_DIR: sandbox, FABLEIT_DEFAULT_MODE: 'full' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { code: 0, stdout: out.toString() };
  } catch (e) {
    return { code: e.status == null ? 1 : e.status, stdout: (e.stdout || '').toString() };
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

test('bash is available to run the shell-syntax checks', () => {
  assert.ok(bashAvailable(),
    'bash not found on PATH. Claude Code runs hooks through bash, and so does ' +
    'this test. On Windows, run via Git Bash (bundled with Git for Windows).');
});

test('hooks.json is present and valid (JSON, shape, bash-parseable, scripts exist)', () => {
  assert.ok(fs.existsSync(HOOKS_JSON), 'hooks/hooks.json is missing');
  const problems = validateHooksFile(HOOKS_JSON);
  assert.deepEqual(problems, [], 'hooks.json problems:\n' + problems.join('\n'));
});

test('UserPromptSubmit hook never blocks a prompt (always exits 0)', () => {
  const cases = [
    '{"prompt":"/fableit ultra"}',   // a real mode switch
    '{"prompt":"how do I center a div"}', // an ordinary prompt
    '{"prompt":""}',                  // empty prompt field
    'this is not json at all',        // garbage stdin
    '',                               // empty stdin
  ];
  for (const stdin of cases) {
    const { code } = runHook('fableit-mode-tracker.js', stdin);
    assert.equal(code, 0, `mode-tracker exited ${code} on stdin: ${JSON.stringify(stdin)}`);
  }
});

test('mode switch emits guidance to stdout', () => {
  const { code, stdout } = runHook('fableit-mode-tracker.js', '{"prompt":"/fableit ultra"}');
  assert.equal(code, 0);
  assert.ok(stdout.trim().length > 0, 'expected a ruleset/directive on stdout for a mode switch');
});

test('SessionStart and SubagentStart hooks exit 0', () => {
  assert.equal(runHook('fableit-activate.js', '{}').code, 0, 'activate must exit 0');
  assert.equal(runHook('fableit-subagent.js', '{}').code, 0, 'subagent must exit 0');
});

// Self-check: the guard must actually reject the pre-fix file. Without this,
// a validator that silently passes everything would look "green" forever.
test('validator rejects the known-bad fixture (PowerShell command run via bash)', () => {
  const bad = path.join(__dirname, 'fixtures', 'hooks.broken.json');
  const problems = validateHooksFile(bad);
  assert.ok(problems.length > 0, 'expected the broken fixture to be rejected');
  assert.ok(problems.some(p => /commandWindows/.test(p) && /not valid bash/.test(p)),
    'expected a bash-syntax rejection on the commandWindows field, got:\n' + problems.join('\n'));
});
