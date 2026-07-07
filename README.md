# Fableit

Claude Fable 5's engineering process (retired 2026-07-07), packaged so **any
model in any agent tool runs it** — the ponytail treatment for process instead
of laziness.

Published analysis found Fable 5's lead over older models is not raw
intelligence on short tasks; it is learnable behavior: goal persistence,
killing incorrect beliefs, self-verification as a reflex, keeping looking
before asking, effort allocation, and memory discipline (persistent memory
improved Fable 3x more than Opus). Fableit injects those behaviors as an
always-on ruleset: **ground → comprehend → reason → design → execute →
verify → report.**

The full blueprint lives in [`SKILL.md`](SKILL.md); the injected ruleset is a
condensed version of it in [`hooks/fableit-instructions.js`](hooks/fableit-instructions.js)
— one source of truth for every host.

## Install

### Claude Code

Recommended — the installer wires everything (hooks, skill, statusline badge):

```bash
# until the package is published to npm, install straight from GitHub:
npx github:BernardMasika/fableit

# after `npm publish`, simply:
npx fableit
```

This adds three hooks to `settings.json` in your Claude config dir
(SessionStart injects the ruleset, SubagentStart makes sub-agents follow it
too, UserPromptSubmit tracks level switches), installs the `fableit` skill,
copies the package to `~/.claude/fableit`, and — if you have no statusline —
adds a `[FABLEIT]` / `[FABLEIT:ULTRA]` badge (bash script, skipped on
Windows). It never overwrites an existing statusline and refuses to touch a
`settings.json` it cannot parse. Restart Claude Code or `/clear` to activate.

Alternative — plugin marketplace:

```
/plugin marketplace add BernardMasika/fableit
/plugin install fableit@fableit
```

Skill only (no hooks, load on demand with `/fableit`):

```bash
git clone https://github.com/BernardMasika/fableit ~/.claude/skills/fableit
```

Remove everything the installer added (hooks, skill, flag, OpenCode entry,
installed copy — leaves your other settings untouched):

```bash
npx github:BernardMasika/fableit uninstall
```

### OpenCode

```bash
npx github:BernardMasika/fableit opencode
```

Wires the plugin into `~/.config/opencode/opencode.json` (pointing at the
stable `~/.claude/fableit` copy). Or, once published to npm:
`npm i -g fableit` and add `"plugin": ["fableit"]` to your opencode.json.
The plugin appends the ruleset to every turn's system prompt and registers
the `/fableit` command.

### Other orchestration tools (Cursor, Codex CLI, Copilot, Gemini CLI, Windsurf, aider, ...)

Any tool that reads an instructions file can run fableit — append the ruleset
to whatever file the tool loads:

```bash
npx github:BernardMasika/fableit print >> AGENTS.md      # Codex, aider, many others
npx github:BernardMasika/fableit print >> .cursorrules   # Cursor
npx github:BernardMasika/fableit print >> GEMINI.md      # Gemini CLI
npx github:BernardMasika/fableit print lite               # smaller variant, to stdout
```

## Levels

| Level | Adds |
|-------|------|
| `lite` | Grounding/zero-hallucination protocol, comprehension-first, the solution ladder, root-cause debugging, verify-before-report, honest reporting. |
| `full` (default) | + goal persistence, effort allocation & sub-agent orchestration, deciding vs asking, session rhythm & memory discipline. |
| `ultra` | + a mandatory verification gate: every claim in the final report must trace to observed evidence, and reports end with a "Verified:" list. |

Switch anytime with `/fableit lite|full|ultra|off` (both Claude Code and
OpenCode); turn off with `stop fableit` or `normal mode`. All states —
including off — persist until changed. Set the default level with the
`FABLEIT_DEFAULT_MODE` env var or `~/.config/fableit/config.json`
(`{"defaultMode": "ultra"}`).

## Why it helps older models

The behaviors above are process, not parameters — a model that re-anchors on
the goal after every error, refuses to state unobserved facts, and runs a
verification gate before reporting closes most of the gap this ruleset was
distilled from. The `ultra` gate exists precisely for models that hallucinate
confidently: no evidence, no claim.

## Development

```bash
npm test        # node --test tests/*.test.js (unit + installer integration)
```

PRs welcome. Keep the spirit: it is a decision process, not a style guide.
Every addition should be a behavior a model can actually execute, grounded in
something observed or published, not vibes.
