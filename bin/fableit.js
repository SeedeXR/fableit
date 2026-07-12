#!/usr/bin/env node
// fableit — npx installer / CLI.
//
//   npx fableit              install for Claude Code (hooks + skill + statusline)
//   npx fableit opencode     wire the plugin into ~/.config/opencode/opencode.json
//   npx fableit print [lvl]  dump the ruleset (pipe into AGENTS.md/.cursorrules for any other tool)
//   npx fableit uninstall    remove hooks, skill, flag, opencode entry, installed copy

'use strict';

const fs = require('fs');
const path = require('path');
const { getClaudeDir, getOpencodeDir, readJson, buildStatusLineCommand } = require('../hooks/fableit-config');
const { getFableitInstructions } = require('../hooks/fableit-instructions');

const SRC = path.resolve(__dirname, '..');
const CLAUDE_DIR = getClaudeDir();
// npx runs from an ephemeral cache, so copy the package to a stable path first.
const DEST = path.join(CLAUDE_DIR, 'fableit');
const SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const SKILLS_DIR = path.join(CLAUDE_DIR, 'skills');
const OPENCODE_CONFIG = path.join(getOpencodeDir(), 'opencode.json');

// An entry/value is ours iff it references the installed copy — never match by
// the bare substring 'fableit', which could appear in a user's own paths.
const norm = s => String(s).replace(/[\\/]+/g, '/');
const ownMarker = norm(path.join(DEST, 'hooks')) + '/';
const isOurs = v => norm(JSON.stringify(v)).includes(ownMarker);

function fatal(msg) {
  console.error('fableit: ' + msg);
  process.exit(1);
}

// Corrupt JSON aborts the install instead of being rewritten from {} — that
// would silently destroy the user's entire config.
function readConfigOrDie(file, what) {
  try {
    return readJson(file) || {};
  } catch (e) {
    fatal(what + ' at ' + file + ' exists but is not valid JSON (' + e.message +
      '). Fix or back it up first; refusing to overwrite it.');
  }
}

function writeSettings(s) {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2) + '\n');
}

function copyPackage() {
  // Re-running from the installed copy itself must not delete-then-fail.
  if (path.resolve(SRC) === path.resolve(DEST)) return;
  fs.rmSync(DEST, { recursive: true, force: true });
  // Filter on the path relative to SRC: an npx cache path contains
  // node_modules as an ancestor, which an absolute-path test would match,
  // silently copying nothing. Handle both separators for Windows.
  fs.cpSync(SRC, DEST, {
    recursive: true,
    filter: p => {
      const segs = path.relative(SRC, p).split(/[\\/]/);
      return !segs.includes('node_modules') && !segs.includes('.git');
    },
  });
}

// Derive settings.json hook entries from hooks/hooks.json — one source of
// truth, so the npx path can't drift from the marketplace-plugin path.
function hookEntries() {
  const manifest = readJson(path.join(SRC, 'hooks', 'hooks.json'));
  const entries = {};
  for (const [event, list] of Object.entries(manifest.hooks)) {
    entries[event] = list.map(({ matcher, hooks }) => {
      const entry = {
        hooks: hooks.map(h => ({
          type: h.type,
          // hooks.json is the single source of truth and its `command` is bash;
          // Claude Code runs every hook through bash (Git Bash on Windows), so
          // substitute the plugin-root placeholder and normalise to '/'. node
          // accepts forward slashes on Windows, keeping the command valid bash.
          command: h.command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, norm(DEST)),
          timeout: h.timeout,
        })),
      };
      if (matcher) entry.matcher = matcher;
      return entry;
    });
  }
  return entries;
}

// Reconcile our hooks within a settings object: drop any previous fableit
// entries (including a stale or broken one written by an older version) and
// add the current correct ones. Makes re-running install idempotent and
// self-healing, so a user never has to hand-remove a bad entry.
function reconcileClaudeHooks(settings, desired) {
  settings.hooks = settings.hooks || {};
  for (const [event, entries] of Object.entries(desired)) {
    const kept = (settings.hooks[event] || []).filter(e => !isOurs(e));
    settings.hooks[event] = [...kept, ...entries];
  }
  // Also strip our entries from events we no longer register.
  for (const event of Object.keys(settings.hooks)) {
    if (desired[event]) continue;
    settings.hooks[event] = settings.hooks[event].filter(e => !isOurs(e));
    if (!settings.hooks[event].length) delete settings.hooks[event];
  }
  return settings;
}

function installClaude() {
  copyPackage();

  // Skill, so the full blueprint is also loadable on demand via /fableit.
  // Remove a legacy pre-plugin clone at skills/Fableit first, so two skills
  // don't register under the same name on case-sensitive filesystems.
  fs.rmSync(path.join(SKILLS_DIR, 'Fableit'), { recursive: true, force: true });
  fs.mkdirSync(path.join(SKILLS_DIR, 'fableit'), { recursive: true });
  fs.copyFileSync(path.join(SRC, 'SKILL.md'), path.join(SKILLS_DIR, 'fableit', 'SKILL.md'));

  const settings = readConfigOrDie(SETTINGS, 'Claude settings');
  reconcileClaudeHooks(settings, hookEntries());
  // Statusline badge — only if the user has none; never clobber an existing one.
  if (!settings.statusLine && process.platform !== 'win32') {
    settings.statusLine = {
      type: 'command',
      command: buildStatusLineCommand(path.join(DEST, 'hooks', 'fableit-statusline.sh')),
    };
  }
  writeSettings(settings);
  console.log('fableit installed for Claude Code.');
  console.log('  hooks   -> ' + SETTINGS);
  console.log('  skill   -> ' + path.join(SKILLS_DIR, 'fableit'));
  console.log('  package -> ' + DEST);
  if (process.platform === 'win32') {
    console.log('Note: the [FABLEIT] statusline badge is a bash script and was skipped on Windows.');
  }
  console.log('Restart Claude Code (or /clear) to activate. Switch levels with /fableit lite|full|ultra|off.');
}

function installOpencode() {
  copyPackage();
  const config = readConfigOrDie(OPENCODE_CONFIG, 'OpenCode config');
  config.plugin = config.plugin || [];
  const pluginPath = path.join(DEST, '.opencode', 'plugins', 'fableit.mjs');
  if (!config.plugin.includes(pluginPath)) config.plugin.push(pluginPath);
  fs.mkdirSync(path.dirname(OPENCODE_CONFIG), { recursive: true });
  fs.writeFileSync(OPENCODE_CONFIG, JSON.stringify(config, null, 2) + '\n');
  console.log('fableit wired into ' + OPENCODE_CONFIG);
  console.log('Switch levels inside OpenCode with /fableit lite|full|ultra|off.');
}

function uninstall() {
  let settings;
  try { settings = readJson(SETTINGS); } catch (e) { settings = null; }
  if (settings) {
    if (settings.hooks) {
      for (const event of Object.keys(settings.hooks)) {
        settings.hooks[event] = settings.hooks[event].filter(e => !isOurs(e));
        if (!settings.hooks[event].length) delete settings.hooks[event];
      }
    }
    if (settings.statusLine && isOurs(settings.statusLine)) delete settings.statusLine;
    writeSettings(settings);
  }
  try {
    const config = readJson(OPENCODE_CONFIG);
    if (config && Array.isArray(config.plugin)) {
      config.plugin = config.plugin.filter(p => !String(p).startsWith(DEST));
      fs.writeFileSync(OPENCODE_CONFIG, JSON.stringify(config, null, 2) + '\n');
    }
  } catch (e) { /* corrupt opencode config — leave it alone */ }
  fs.rmSync(path.join(SKILLS_DIR, 'fableit'), { recursive: true, force: true });
  fs.rmSync(path.join(SKILLS_DIR, 'Fableit'), { recursive: true, force: true });
  fs.rmSync(path.join(CLAUDE_DIR, '.fableit-active'), { force: true });
  fs.rmSync(DEST, { recursive: true, force: true });
  console.log('fableit uninstalled (Claude Code hooks, skill, flag, OpenCode entry, installed copy).');
}

if (require.main === module) {
  const cmd = process.argv[2] || 'claude';
  switch (cmd) {
    case 'claude':
    case 'install':
      installClaude(); break;
    case 'opencode':
      installOpencode(); break;
    case 'print':
      console.log(getFableitInstructions(process.argv[3] || 'full')); break;
    case 'uninstall':
      uninstall(); break;
    default:
      console.log('usage: npx fableit [claude|opencode|print [lite|full|ultra]|uninstall]');
      process.exit(1);
  }
}

// Exported for tests; the CLI above only runs when the file is executed directly.
module.exports = { hookEntries, reconcileClaudeHooks, isOurs };
