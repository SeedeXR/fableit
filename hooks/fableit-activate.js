#!/usr/bin/env node
// fableit — Claude Code SessionStart hook.
// Emits the ruleset as context; writes the mode flag only when absent
// (statusline reads it). If no statusline is configured, nudges setup.

'use strict';

const path = require('path');
const {
  getClaudeDir, getDefaultMode, readMode, setMode, readJson,
  isShellSafe, buildStatusLineCommand,
} = require('./fableit-config');
const { getFableitInstructions } = require('./fableit-instructions');

const persisted = readMode();
const mode = persisted || getDefaultMode();

// 'off' is persisted, so it survives resume/compact instead of re-activating.
if (mode === 'off') process.exit(0);

if (!persisted) {
  try { setMode(mode); } catch (e) { /* flag is best-effort */ }
}

let output = getFableitInstructions(mode);

try {
  let hasStatusline = false;
  try {
    hasStatusline = !!readJson(path.join(getClaudeDir(), 'settings.json'))?.statusLine;
  } catch (e) { /* corrupt settings — don't nudge writes into it */ hasStatusline = true; }
  // ponytail: under a marketplace install __dirname is a version-pinned plugin
  // cache dir, so the snippet dangles after an update; `npx fableit` wires the
  // stable ~/.claude/fableit copy instead.
  const scriptPath = path.join(__dirname, 'fableit-statusline.sh');
  if (!hasStatusline && process.platform !== 'win32' && isShellSafe(scriptPath)) {
    output += '\n\nSTATUSLINE SETUP NEEDED: fableit ships a statusline badge showing the active ' +
      'level (e.g. [FABLEIT], [FABLEIT:ULTRA]). Not configured yet. To enable, add to ' +
      'settings.json in your Claude config dir: "statusLine": { "type": "command", "command": ' +
      JSON.stringify(buildStatusLineCommand(scriptPath)) + ' }. ' +
      'Proactively offer to set this up for the user on first interaction.';
  }
} catch (e) { /* nudge is best-effort */ }

process.stdout.write(output);
