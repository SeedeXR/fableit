#!/usr/bin/env node
// fableit — shared config + runtime helpers (mode state, command parsing, JSON IO).
//
// Default mode resolution:
//   1. FABLEIT_DEFAULT_MODE env var
//   2. defaultMode in $XDG_CONFIG_HOME/fableit/config.json (or ~/.config/fableit/config.json)
//   3. 'full'

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MODES = ['off', 'lite', 'full', 'ultra'];
const DEFAULT_MODE = 'full';

function normalizeMode(mode) {
  if (typeof mode !== 'string') return null;
  const m = mode.trim().toLowerCase();
  return MODES.includes(m) ? m : null;
}

// One parser for every host. Returns the requested mode, or null when the text
// is not a fableit command / carries an unrecognized argument (which must be
// ignored, never silently reset to the default).
function parseFableitCommand(text) {
  const m = String(text || '').trim().toLowerCase()
    .match(/^[/@$]fableit(?::fableit)?(?:\s+(\S+))?\s*$/);
  if (!m) return null;
  if (m[1] === undefined) return getDefaultMode(); // bare /fableit re-activates
  return normalizeMode(m[1]);
}

// "stop fableit" / "normal mode" only as a standalone message, so ordinary
// requests containing the phrase don't switch it off mid-task.
function isDeactivationCommand(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[.!?\s]+$/, '');
  return t === 'stop fableit' || t === 'normal mode';
}

// Read+parse a JSON file, tolerating a UTF-8 BOM. Missing file → null.
// Corrupt file → throws, so callers decide whether that is fatal (installer)
// or ignorable (hooks). Never returns {} for a file that exists but won't parse.
function readJson(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return null;
  }
  return JSON.parse(raw.replace(/^﻿/, ''));
}

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function getConfigDir() {
  const base = process.env.XDG_CONFIG_HOME ||
    (process.platform === 'win32'
      ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
      : path.join(os.homedir(), '.config'));
  return path.join(base, 'fableit');
}

// OpenCode keeps its config under XDG on every platform.
function getOpencodeDir() {
  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
    'opencode',
  );
}

let cachedDefault;
function getDefaultMode() {
  if (cachedDefault) return cachedDefault;
  let mode = normalizeMode(process.env.FABLEIT_DEFAULT_MODE);
  if (!mode) {
    try {
      mode = normalizeMode(readJson(path.join(getConfigDir(), 'config.json'))?.defaultMode);
    } catch (e) { /* corrupt config — fall through to default */ }
  }
  return (cachedDefault = mode || DEFAULT_MODE);
}

// Mode state: one flag file per host, 'off' persisted like any level so it
// survives resume/compact/restart. Absent flag = never configured → default.
// ponytail: the flag is global across concurrent sessions of the same host;
// per-session flags (keyed by session_id, plus GC) if that ever bites.
const claudeFlagPath = () => path.join(getClaudeDir(), '.fableit-active');

function readMode(file) {
  try {
    return normalizeMode(fs.readFileSync(file || claudeFlagPath(), 'utf8'));
  } catch (e) {
    return null;
  }
}

function setMode(mode, file) {
  const target = file || claudeFlagPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, mode);
}

// Only embed the install path in a shell snippet when it's ordinary path
// characters; a hostile path (quotes, $, ;, backtick...) falls back to manual setup.
function isShellSafe(p) {
  return typeof p === 'string' && /^[A-Za-z0-9 _.\-:/\\~]+$/.test(p);
}

function buildStatusLineCommand(scriptPath) {
  return 'bash "' + scriptPath + '"';
}

module.exports = {
  normalizeMode,
  parseFableitCommand,
  isDeactivationCommand,
  readJson,
  getClaudeDir,
  getConfigDir,
  getOpencodeDir,
  getDefaultMode,
  readMode,
  setMode,
  isShellSafe,
  buildStatusLineCommand,
};
