#!/usr/bin/env node
// fableit — SubagentStart hook. SessionStart context never reaches subagents,
// so inject the same ruleset into each Task-spawned agent when active.

'use strict';

const { readMode } = require('./fableit-config');

const mode = readMode();
if (!mode || mode === 'off') process.exit(0);

try {
  const { getFableitInstructions } = require('./fableit-instructions');
  process.stdout.write(getFableitInstructions(mode));
} catch (e) { /* stdout error must not surface as hook failure */ }
