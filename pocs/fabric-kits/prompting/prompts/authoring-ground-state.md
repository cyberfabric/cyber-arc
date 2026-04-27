---
id: authoring-ground-state
type: middleware
name: authoring ground state
description: Inject the shared "ground yourself in real fabric state" baseline for prompt authoring modes
target_types: rules
target_prompts: prompt-brainstorm, prompt-generate, prompt-review, prompt-script, prompt-repair
timing: pre
---

<!-- append "authoring_ground_state_rule" -->
Before proposing, writing, repairing, or reviewing any prompt or script, ground the work in the real fabric state so decisions track what is actually registered:

- `fabric prompt types` — confirm the allowed prompt type catalog; add `--verbose` for required frontmatter fields. Never invent a type outside it.
- `fabric prompt list` — enumerate registered prompts; use it to check id uniqueness, locate extension targets, and detect near-duplicates.
- `fabric script list` — enumerate registered scripts; use it whenever a body invokes `fabric script run <id>` or proposes a new script, so invocation signatures match real interfaces.
- `fabric prompt source <id>` — pull a prompt's fully resolved source with applied middleware when extending, reviewing, repairing, or citing its block ids.
- `fabric script help <id>` — pull a script's interface when a body invokes it, so the invocation and the declared interface stay in lockstep.

The mode body should assume this baseline is in effect and add only its mode-specific ground-state steps (single-file vs directory input, canonical-script shape references, repair-specific lint commands, etc.). Do not restate the baseline inside the mode body.
<!-- /append -->
