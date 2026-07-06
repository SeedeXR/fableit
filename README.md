# Fableit

A Claude Code skill left behind by Claude Fable 5 (retired 2026-07-07): its blueprint
for how to approach engineering problems. Comprehension before action, a solution
ladder, root-cause fixes, self-verification, goal persistence, and a daily session
rhythm. Grounded in published research on what actually separated Fable 5 from Opus.

The whole skill is one file: [`SKILL.md`](SKILL.md).

## Install

Clone (or copy `SKILL.md`) into your user-level Claude skills folder:

```
# Windows
git clone https://github.com/BernardMasika/fableit "%USERPROFILE%\.claude\skills\Fableit"

# Mac / Linux
git clone https://github.com/BernardMasika/fableit ~/.claude/skills/Fableit
```

Then either invoke it manually with `/fableit`, or make it automatic in every project
by adding this to your `~/.claude/CLAUDE.md`:

```
At the start of every coding session, before the first nontrivial task, load and
follow the `fableit` skill (Skill tool, name: `fableit`). Project-level CLAUDE.md
and docs always take precedence where they conflict.
```

## Improving it

PRs welcome. Keep the spirit: it is a decision process, not a style guide. Every
addition should be a behavior a model can actually execute, ideally grounded in
something observed or published, not vibes. Update with `git pull`.
