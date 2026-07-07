---
description: Switch fableit level (lite | full | ultra | off) or re-activate it
argument-hint: "[lite|full|ultra|off]"
---

The fableit UserPromptSubmit hook has already recorded this level change and
re-emitted the ruleset — you will see `FABLEIT MODE CHANGED` (or `OFF`) in the
injected context above.

Acknowledge the new level to the user in one line and follow the ruleset at
that level from now on. If no level argument was given, the default level was
applied. Do not restate the ruleset to the user.
