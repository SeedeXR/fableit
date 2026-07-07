// fableit — the one runnable check. Fails if the ruleset, levels, parsing,
// hook wiring, or installer safety break.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const { getFableitInstructions } = require('../hooks/fableit-instructions');
const {
  normalizeMode, parseFableitCommand, isDeactivationCommand,
  readJson, readMode, setMode,
} = require('../hooks/fableit-config');

test('levels nest: lite < full < ultra, each with its marker sections', () => {
  const lite = getFableitInstructions('lite');
  const full = getFableitInstructions('full');
  const ultra = getFableitInstructions('ultra');
  for (const [t, level] of [[lite, 'lite'], [full, 'full'], [ultra, 'ultra']]) {
    assert.match(t, new RegExp('^FABLEIT MODE ACTIVE — level: ' + level));
    assert.match(t, /Grounding \(zero hallucination\)/);
  }
  assert.ok(!lite.includes('Goal persistence') && full.includes('Goal persistence'));
  assert.ok(!full.includes('Verification gate') && ultra.includes('Verification gate'));
  assert.ok(lite.length < full.length && full.length < ultra.length);
  assert.match(getFableitInstructions('bogus'), /level: full/);
});

test('command parsing: valid switches, garbage ignored, deactivation standalone-only', () => {
  assert.strictEqual(parseFableitCommand('/fableit ultra'), 'ultra');
  assert.strictEqual(parseFableitCommand('/fableit:fableit lite'), 'lite');
  assert.strictEqual(parseFableitCommand('@fableit off'), 'off');
  assert.strictEqual(parseFableitCommand('/fableit'), 'full'); // bare = default
  assert.strictEqual(parseFableitCommand('/fableit bogus'), null); // never resets
  assert.strictEqual(parseFableitCommand('/fableit-help'), null);
  assert.strictEqual(parseFableitCommand('/fableits are odd'), null);
  assert.strictEqual(normalizeMode('review'), null);
  assert.ok(isDeactivationCommand('Stop fableit.'));
  assert.ok(!isDeactivationCommand('add a normal mode toggle'));
});

test('mode state: off persists; readJson never returns {} for corrupt files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fableit-'));
  const flag = path.join(dir, 'flag');
  setMode('off', flag);
  assert.strictEqual(readMode(flag), 'off'); // survives "restart"
  assert.strictEqual(readJson(path.join(dir, 'missing.json')), null);
  const corrupt = path.join(dir, 'corrupt.json');
  fs.writeFileSync(corrupt, '{ not json');
  assert.throws(() => readJson(corrupt));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('hooks.json references scripts that exist; manifests agree', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8'));
  for (const entries of Object.values(config.hooks)) {
    for (const { hooks } of entries) {
      for (const h of hooks) {
        const script = h.command.match(/hooks\/([\w-]+\.js)/)[1];
        assert.ok(fs.existsSync(path.join(root, 'hooks', script)), script + ' missing');
      }
    }
  }
  const plugin = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.strictEqual(plugin.version, pkg.version);
  assert.ok(fs.existsSync(path.join(root, plugin.hooks)));
});

test('installer: wires hooks derived from hooks.json, refuses corrupt settings, uninstalls cleanly', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fableit-home-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: path.join(home, 'claude'), XDG_CONFIG_HOME: path.join(home, 'xdg') };
  const cli = path.join(root, 'bin', 'fableit.js');
  const settingsPath = path.join(home, 'claude', 'settings.json');

  execFileSync('node', [cli, 'claude'], { env });
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(settings.hooks).sort(), Object.keys(manifest.hooks).sort());
  // idempotent
  execFileSync('node', [cli, 'claude'], { env });
  const again = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  for (const v of Object.values(again.hooks)) assert.strictEqual(v.length, 1);
  // installed copy is runnable and includes what the hooks need
  const dest = path.join(home, 'claude', 'fableit');
  assert.ok(fs.existsSync(path.join(dest, 'hooks', 'fableit-activate.js')));
  assert.ok(fs.existsSync(path.join(dest, '.opencode', 'command', 'fableit.md')));

  // corrupt settings must abort, not be clobbered
  fs.writeFileSync(settingsPath, '{ trailing, }');
  assert.throws(() => execFileSync('node', [cli, 'claude'], { env, stdio: 'pipe' }));
  assert.strictEqual(fs.readFileSync(settingsPath, 'utf8'), '{ trailing, }');

  // uninstall removes our entries but keeps foreign ones
  fs.writeFileSync(settingsPath, JSON.stringify({
    hooks: { ...again.hooks, PreToolUse: [{ hooks: [{ type: 'command', command: 'echo my-fableit-lint' }] }] },
    statusLine: again.statusLine,
  }));
  execFileSync('node', [cli, 'uninstall'], { env });
  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepStrictEqual(Object.keys(after.hooks), ['PreToolUse']); // foreign hook survives
  assert.strictEqual(after.statusLine, undefined);
  assert.ok(!fs.existsSync(dest));
  fs.rmSync(home, { recursive: true, force: true });
});
