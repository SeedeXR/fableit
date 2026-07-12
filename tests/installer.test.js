'use strict';

// fableit — installer (bin/fableit.js) hook reconciliation.
//
// Guards the "self-healing" behaviour: re-running the installer must replace any
// previous fableit hook entry in settings.json (including a stale PowerShell one
// from an older version) with the current, bash-valid entry — without touching
// the user's own unrelated hooks, and without leaving duplicates.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// getClaudeDir() (used inside the installer to compute DEST/SETTINGS) honours
// CLAUDE_CONFIG_DIR. Set it to a temp dir BEFORE requiring the module so every
// derived path is sandboxed and deterministic.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'fableit-install-'));
process.env.CLAUDE_CONFIG_DIR = SANDBOX;

const installer = require('../bin/fableit.js');
const DEST_HOOKS = path.join(SANDBOX, 'fableit', 'hooks'); // where our scripts live

function bashOK(cmd) {
  try { execFileSync('bash', ['-n', '-c', cmd], { stdio: 'pipe' }); return true; }
  catch { return false; }
}

// A settings.json as an older install would have left it on Windows: a stale
// PowerShell UserPromptSubmit entry pointing at our install dir (this is the
// exact shape that blocked every prompt), plus a user's own unrelated hook.
function staleSettings() {
  const winPath = path.join(DEST_HOOKS, 'fableit-mode-tracker.js');
  return {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [{
            type: 'command',
            command: `if (Get-Command node -ErrorAction SilentlyContinue) { node "${winPath}" }`,
            timeout: 5,
          }],
        },
        {
          // the user's own hook — must survive untouched
          hooks: [{ type: 'command', command: 'echo "my own hook"' }],
        },
      ],
    },
  };
}

test('reconcile replaces a stale PowerShell entry with a valid bash entry', () => {
  const settings = staleSettings();
  installer.reconcileClaudeHooks(settings, installer.hookEntries());

  const ups = settings.hooks.UserPromptSubmit;
  const ours = ups.filter(installer.isOurs);
  const theirs = ups.filter(e => !installer.isOurs(e));

  // exactly one of ours (no duplicate), user's hook preserved
  assert.equal(ours.length, 1, 'expected exactly one fableit UserPromptSubmit entry');
  assert.equal(theirs.length, 1, "user's own hook must be preserved");
  assert.equal(theirs[0].hooks[0].command, 'echo "my own hook"');

  // the surviving fableit command is bash-valid and carries no PowerShell
  const cmd = ours[0].hooks[0].command;
  assert.ok(!/Get-Command|SilentlyContinue/.test(cmd), 'PowerShell must be gone');
  assert.ok(bashOK(cmd), `fableit command must be valid bash, got: ${cmd}`);
  assert.match(cmd, /; exit 0$/, 'command must end with "; exit 0" so it never blocks');
});

test('reconcile is idempotent (running twice changes nothing)', () => {
  const settings = { hooks: {} };
  installer.reconcileClaudeHooks(settings, installer.hookEntries());
  const once = JSON.stringify(settings);
  installer.reconcileClaudeHooks(settings, installer.hookEntries());
  assert.equal(JSON.stringify(settings), once, 'second run should be a no-op');
});

test('every event our installer emits is valid bash', () => {
  const settings = { hooks: {} };
  installer.reconcileClaudeHooks(settings, installer.hookEntries());
  for (const [event, groups] of Object.entries(settings.hooks)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        assert.ok(bashOK(h.command), `${event}: not valid bash -> ${h.command}`);
      }
    }
  }
});

test.after(() => fs.rmSync(SANDBOX, { recursive: true, force: true }));
