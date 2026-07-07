#!/usr/bin/env node
// fableit — UserPromptSubmit hook. Runs on every prompt: tracks
// `/fableit <level>` switches and standalone deactivation phrases.

'use strict';

const {
  parseFableitCommand, isDeactivationCommand, readMode, setMode,
} = require('./fableit-config');

const RANK = { lite: 1, full: 2, ultra: 3 };

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^﻿/, ''));
    const prompt = (data.prompt || '').trim();

    const mode = parseFableitCommand(prompt) ||
      (isDeactivationCommand(prompt) ? 'off' : null);
    if (!mode) process.exit(0); // not a fableit command (or garbage arg) — untouched

    const prev = readMode();
    setMode(mode);

    if (mode === 'off') {
      process.stdout.write('FABLEIT MODE OFF — stop applying the fableit ruleset.');
    } else if (!prev || prev === 'off' || RANK[mode] > RANK[prev]) {
      // Escalation (or unknown previous level): context may lack the higher
      // level's sections, so emit the full ruleset at the new level.
      const { getFableitInstructions } = require('./fableit-instructions');
      process.stdout.write(getFableitInstructions(mode));
    } else {
      // Downgrade or same level: the ruleset is already in context; a one-line
      // directive avoids re-injecting ~1.5k tokens.
      process.stdout.write('FABLEIT MODE CHANGED — level: ' + mode +
        '. Apply the fableit ruleset already in context only up to this level' +
        (mode === 'lite' ? ' (sections 1-6; ignore 7+).' : ' (ignore the ultra verification gate).'));
    }
  } catch (e) { /* malformed stdin — do nothing */ }
  process.exit(0);
});
