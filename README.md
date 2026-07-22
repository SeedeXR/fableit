# Fableit

[![npm](https://img.shields.io/npm/v/@seedexr/fableit)](https://www.npmjs.com/package/@seedexr/fableit)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Fix (2026-07-13): v1.0.0 blocked every prompt in Claude Code on Windows**
> (a hook error on each submit). v1.0.1 fixes it and is live on npm; v1.0.0 is
> deprecated. If you are affected, run `npx @seedexr/fableit@latest` once — it also
> repairs the broken `settings.json` entry automatically, no hand-editing
> needed. Details: [PR #1](https://github.com/SeedeXR/fableit/pull/1).

**Fableit teaches your AI coding assistant to work like a careful senior
engineer.** It is a small ruleset you install once. After that, the model
checks facts before stating them, reads the code before changing it, verifies
its own work before reporting, and tells you honestly what it did and did not
do.

It packages the engineering process of Claude Fable 5 so that **any model in
any agent tool can run it**: Claude Code, OpenCode, Cursor, Codex CLI, Gemini
CLI, aider, and anything else that reads an instructions file. (Fable 5 itself
is not retired: its included access on paid Claude plans was
[extended through July 19, 2026](https://www.bleepingcomputer.com/news/artificial-intelligence/claude-fable-5-stays-free-for-paid-users-until-july-19-as-anthropic-buys-more-time/);
after that it costs separate usage credits, and Anthropic says it will return
to subscriptions when compute allows. Fableit is for every model, with or
without Fable 5 access.)

## Where this comes from

Published analysis found that Fable 5's lead over older models was not raw
intelligence on short tasks. It was learnable behavior:

- **Goal persistence**: after every error or detour, re-anchor on the original
  goal instead of drifting.
- **Killing incorrect beliefs**: treat your current theory as a hypothesis and
  drop it the moment evidence contradicts it.
- **Self-verification as a reflex**: test your own work before presenting it.
- **Keeping looking before asking**: exhaust what you can find yourself before
  interrupting the human with a question.
- **Effort allocation**: think hard on the genuinely hard parts, move fast
  through the mechanical parts.
- **Memory discipline**: with persistent memory, Fable improved 3x more than
  Opus.

Fableit injects those behaviors as an always-on ruleset:
**ground → comprehend → reason → design → execute → verify → report.**
In plain terms: check the facts, read the code, think, plan, do the work,
test it, then report honestly.

## How it works

Two files matter, and they say the same thing at different sizes:

- [`SKILL.md`](SKILL.md) is the full blueprint, written for the model to read
  when it needs the complete process.
- [`hooks/fableit-instructions.js`](hooks/fableit-instructions.js) holds the
  condensed ruleset that gets injected into every session. One source of
  truth for every host.

Once installed, the ruleset is added to the model's instructions
automatically at the start of every session. You never have to remember to
turn it on.

## Install

Fableit is published on npm as
[`@seedexr/fableit`](https://www.npmjs.com/package/@seedexr/fableit), owned by
the [SeedeXR](https://github.com/SeedeXR) organization. (It was previously also
published under the short name `fableit`; that name is now **deprecated** and
frozen — use `@seedexr/fableit`. Existing `fableit` installs keep working.)

### Claude Code

Recommended: the installer wires everything (hooks, skill, statusline badge).

```bash
npx @seedexr/fableit

# or straight from GitHub:
npx github:SeedeXR/fableit
```

What the installer does, step by step:

- Adds three hooks to `settings.json` in your Claude config dir:
  - **SessionStart** injects the ruleset when a session begins,
  - **SubagentStart** makes sub-agents follow the same rules,
  - **UserPromptSubmit** tracks level switches like `/fableit ultra`.
- Installs the `fableit` skill and copies the package to `~/.claude/fableit`.
- If you have no statusline, adds a `[FABLEIT]` / `[FABLEIT:ULTRA]` badge so
  you can see at a glance that it is active (a bash script, skipped on
  Windows).

It never overwrites an existing statusline, and it refuses to touch a
`settings.json` it cannot parse. Restart Claude Code or `/clear` to activate.

Alternative: install through the plugin marketplace.

```
/plugin marketplace add SeedeXR/fableit
/plugin install fableit@fableit
```

Skill only (no hooks, load on demand with `/fableit`):

```bash
git clone https://github.com/SeedeXR/fableit ~/.claude/skills/fableit
```

To remove everything the installer added (hooks, skill, flag, OpenCode entry,
installed copy), while leaving your other settings untouched:

```bash
npx @seedexr/fableit uninstall
```

### OpenCode

```bash
npx @seedexr/fableit opencode
```

This wires the plugin into `~/.config/opencode/opencode.json`, pointing at
the stable `~/.claude/fableit` copy. Or: `npm i -g @seedexr/fableit` and add
`"plugin": ["@seedexr/fableit"]` to your opencode.json. The plugin appends the
ruleset to every turn's system prompt and registers the `/fableit` command.

### Other tools (Cursor, Codex CLI, Copilot, Gemini CLI, Windsurf, aider, ...)

Any tool that reads an instructions file can run fableit: append the ruleset
to whatever file your tool loads.

```bash
npx @seedexr/fableit print >> AGENTS.md      # Codex, aider, many others
npx @seedexr/fableit print >> .cursorrules   # Cursor
npx @seedexr/fableit print >> GEMINI.md      # Gemini CLI
npx @seedexr/fableit print lite              # smaller variant, to stdout
```

## Levels

Fableit ships three intensity levels. Each level includes everything from
the one before it and adds more.

| Level | Adds |
|-------|------|
| `lite` | Grounding/zero-hallucination protocol, comprehension-first, the solution ladder, root-cause debugging, verify-before-report, honest reporting. |
| `full` (default) | + goal persistence, effort allocation & sub-agent orchestration, deciding vs asking, session rhythm & memory discipline. |
| `ultra` | + a mandatory verification gate: every claim in the final report must trace to observed evidence, and reports end with a "Verified:" list. |

Which one to pick: `lite` is the core discipline and the cheapest in tokens.
`full`, the default, adds the behaviors that matter on long tasks. `ultra`
adds a strict "no evidence, no claim" gate, built for models that tend to
guess confidently.

Switch anytime with `/fableit lite|full|ultra|off` (both Claude Code and
OpenCode). Turn it off with `stop fableit` or `normal mode`. All states,
including off, persist until changed. Set the default level with the
`FABLEIT_DEFAULT_MODE` env var or `~/.config/fableit/config.json`
(`{"defaultMode": "ultra"}`).

## Why it helps older models

The behaviors above are process, not parameters. A model that re-anchors on
the goal after every error, refuses to state unobserved facts, and runs a
verification gate before reporting closes most of the gap this ruleset was
distilled from. The `ultra` gate exists precisely for models that hallucinate
confidently: no evidence, no claim.

## Development

```bash
npm test        # node --test (unit, installer reconcile, hook bash-validity)
```

PRs welcome. Keep the spirit: it is a decision process, not a style guide.
Every addition should be a behavior a model can actually execute, grounded in
something observed or published, not vibes.
