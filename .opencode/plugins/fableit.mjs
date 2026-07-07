// fableit — OpenCode plugin.
// Appends the ruleset to every turn's system prompt at the active level,
// registers the /fableit command, and persists level switches. Reuses the
// shared CommonJS builders so all hosts read one source of truth.
//
// opencode.json: { "plugin": ["fableit"] }  (npm)  or a path to this file.

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { getFableitInstructions } = require('../../hooks/fableit-instructions');
const { normalizeMode, getDefaultMode, getOpencodeDir, isDeactivationCommand } =
  require('../../hooks/fableit-config');

// Keep mode state beside OpenCode's own config; 'off' persists like any level.
const statePath = path.join(getOpencodeDir(), '.fableit-active');

function readMode() {
  try {
    return normalizeMode(fs.readFileSync(statePath, 'utf8')) || getDefaultMode();
  } catch (e) {
    return getDefaultMode();
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

// The three possible instruction strings never change within a process.
const memo = {};
const instructions = mode => (memo[mode] ??= getFableitInstructions(mode));

export function parseCommandFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Tolerate CRLF: a Windows checkout (autocrlf) delivers \r\n, npm ships \n.
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const description = match[1].match(/description:\s*(.+)/)?.[1]?.trim();
  return { description, template: match[2].trim() };
}

export default async () => ({
  // Register the /fableit command so it works when installed from npm.
  config: async (config) => {
    if (!config.command) config.command = {};
    try {
      const parsed = parseCommandFile(path.join(__dirname, '..', 'command', 'fableit.md'));
      if (parsed) config.command.fableit = parsed;
    } catch (e) { /* command file missing — level switching via config only */ }
  },

  // Append the ruleset to the system prompt every turn.
  'experimental.chat.system.transform': async (_input, output) => {
    const mode = readMode();
    if (mode === 'off') return;
    output.system.push(instructions(mode));
  },

  // Persist `/fableit <level>` so the next turn's injection follows it.
  // ponytail: mode applies from the next message, not the current one — the
  // transform reads the flag the command writes.
  'command.execute.before': async (input) => {
    if (!input || input.command !== 'fableit') return;
    const arg = (input.arguments || '').trim();
    const mode = arg ? normalizeMode(arg) : getDefaultMode();
    if (mode) writeMode(mode); // unrecognized args are ignored, never reset
  },

  // Standalone "stop fableit" / "normal mode" typed as plain chat text.
  'chat.message': async (_input, output) => {
    const text = (output?.parts || [])
      .map(p => (p && p.type === 'text' ? p.text : ''))
      .join(' ');
    if (isDeactivationCommand(text)) writeMode('off');
  },
});
