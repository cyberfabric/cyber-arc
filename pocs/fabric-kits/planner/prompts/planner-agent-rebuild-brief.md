---
id: planner-agent-rebuild-brief
type: rules
name: planner agent rebuild brief
description: Mode rules loaded by planner-agent when mode=rebuild-brief — re-derive a brief JSON spec from the decomposition spec + plan.toml and rewrite brief-{NN}-{slug}.md via plan-brief-write
---

<!-- append "planner_agent_rebuild_brief_overview" -->
**Scope**: regenerate a single brief from authoritative sources (the decomposition spec produced by `planner-brainstorm` and the manifest written by `plan-manifest-write`). Loaded by `planner-agent` when the inbound payload has `mode: rebuild-brief`. Caller is typically `planner-recover` after a hand-edit accidentally damaged a brief, or after a phase needs a corrected Load instruction set.

**Pre-conditions**: `plan_dir/plan.toml` exists; the decomposition spec is reachable via the payload's `decomposition_spec_path` (a JSON file the caller wrote).

**Post-condition**: `plan_dir/{brief_file}` exists and matches the canonical brief shape produced by `plan-brief-write`. The corresponding phase file (`plan_dir/{phase_file}`) is NOT regenerated — the dispatcher decides whether to also re-run `mode=compile` after this.
<!-- /append -->

<!-- append "planner_agent_rebuild_brief_load" -->
1. Read `plan_dir/plan.toml`. Locate the entry in `phases[]` whose `number` matches the payload's `phase_number`. Capture: `slug`, `kind`, `depends_on`, `input_files`, `output_files`, `outputs`, `inputs`, `template_sections`, `checklist_sections`, `skills_loaded`, `subagents_dispatched`.
2. Read the decomposition spec at the payload's `decomposition_spec_path`. Locate the same phase by `number`. Capture per-phase fields not stored in the manifest: `phase_file_lines` (estimate), `load_instructions[]`, `rules_to_inline[]`, `user_decisions[]`.
3. Cross-check the manifest's per-phase fields against the decomposition spec. Mismatches (different `output_files`, `depends_on`, etc.) are a manifest-vs-spec divergence — return FAIL with `notes` naming the divergence; do NOT silently overwrite. The caller decides which source to trust.
<!-- /append -->

<!-- append "planner_agent_rebuild_brief_emit" -->
Build the brief JSON spec required by `plan-brief-write`:

```json
{
  "number": <int>,
  "total_phases": <int from manifest>,
  "title": "<from spec>",
  "slug": "<from manifest>",
  "phase_file": "phase-{NN}-{slug}.md",
  "brief_file": "brief-{NN}-{slug}.md",
  "plan_dir": "<absolute>",
  "kind": "<delivery|lifecycle from manifest>",
  "depends_on": [<from manifest>],
  "inputs": [<from manifest>],
  "output_files": [<from manifest>],
  "outputs": [<from manifest>],
  "template_sections": [<from manifest>],
  "checklist_sections": [<from manifest>],
  "skills_loaded": [<from manifest>],
  "subagents_dispatched": [<from manifest>],
  "user_decisions": [<from spec>],
  "phase_file_lines": <from spec>,
  "load_instructions": [<from spec>],
  "rules_to_inline": [<from spec>]
}
```

Run `fabric-poc script run plan-brief-write --output {plan_dir}/{brief_file} --spec '<json>'`. The script validates required fields and the canonical naming; trust its validation as the deterministic gate.
<!-- /append -->

<!-- append "planner_agent_rebuild_brief_return" -->
Return per `planner-subagent-protocol L3`:

```json
{
  "phase_number": <N>,
  "phase_file_path": null,
  "intermediate_outputs": [],
  "output_files": ["{plan_dir}/{brief_file}"],
  "validation_outcome": "PASS" | "FAIL",
  "notes": "<short summary>"
}
```

`validation_outcome` follows `plan-brief-write`'s exit: success → PASS, validation error → FAIL with the script's error message under `validation_findings`.

If the rebuilt brief diverges from the existing brief (when one was on disk), include a one-line `notes` summary like `existing brief at {path} replaced; major diffs: {fields}`. The dispatcher may want to also dispatch `mode=compile` to regenerate the phase file from the new brief.
<!-- /append -->
