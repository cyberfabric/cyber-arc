---
id: planner-generate
type: rules
name: planner generate
description: Compile plan.toml, all brief-{NN}-{slug}.md files, and all phase-{NN}-{slug}.md files from a locked decomposition spec; sub-agent dispatch is the default phase-compilation path
---

<!-- append "planner_generate_input" -->
Use the locked decomposition spec from `planner-brainstorm` as the input. The spec is JSON with `plan` and `phases[]`. If the user did not run brainstorm first or the spec is incomplete, stop and direct them to `planner-brainstorm`.

Companion rules to load: `fabric-poc prompt get plan-decomposition` (for budget / boundary validation), `fabric-poc prompt get planner-subagent-protocol` (governs the dispatch path used to compile phase files).

This mode writes `plan.toml`, every `brief-*.md`, and every `phase-*.md` under `{plan_dir}`. It does NOT execute phases — that is `planner-execute`.
<!-- /append -->

<!-- append "planner_generate_step1_validate_spec" -->
**Step 1 — validate the decomposition spec.**

1. Confirm `plan` has `task`, `type`, `target`, `target_key`, `task_slug`, `lifecycle`, `plan_dir`. Confirm `phases[]` is non-empty.
2. Confirm phase numbering is `1..N` contiguous; every `depends_on` entry references an earlier phase.
3. Confirm budget per `plan-decomposition L5`: every phase's estimated runtime context (`phase_file_lines + sum(input_files lines) + sum(inputs lines) + estimated_output_lines`) is `≤ 2000`. Stop and recommend `planner-brainstorm` re-decomposition if any phase overflows.
4. Confirm lifecycle reservation per `plan-decomposition L6`: when `lifecycle = "cleanup"`, the final phase is `kind = "lifecycle"` and depends on the prior delivery phase.
5. If validation fails on any check, stop and surface the failing item; do not write any files.
<!-- /append -->

<!-- append "planner_generate_step2_create_plan_dir" -->
**Step 2 — create plan_dir and the manifest.**

1. `mkdir -p {plan_dir}` (and `{plan_dir}/out/` for intermediate outputs).
2. If `plan.input_chunks` is non-empty, the chunks were already staged by `planner-brainstorm` via `plan-chunk-input` — confirm `{plan_dir}/input/manifest.json` exists and its `input_signature` matches `plan.input_signature`.
3. Build the JSON spec for `plan-manifest-write` from the decomposition spec: copy every plan-level field, copy every phase entry verbatim including `skills_loaded[]` and `subagents_dispatched[]`. Add the schema-required fields the brainstorm spec didn't carry: `kit_path` (already present), `created` (current ISO 8601 timestamp), `execution_status = "not_started"`, `lifecycle_status = "pending"` (or `"done"` immediately for `lifecycle = "gitignore"`), `active_plan_dir = plan_dir`, `total_phases = phases.length`, derive `file = phase-{NN}-{slug}.md` and `brief_file = brief-{NN}-{slug}.md` for every phase.
4. Run `fabric-poc script run plan-manifest-write --output {plan_dir}/plan.toml --spec '<json>'`. Validate the script's `wrote = true`; if it errored, surface the validation message and stop.
5. If `lifecycle = "gitignore"` and the project's `.gitignore` does not yet exclude `.fabric-plans/`, add the line and stage the change.
<!-- /append -->

<!-- append "planner_generate_step3_write_briefs" -->
**Step 3 — write briefs.**

For each phase, build the brief JSON spec and call `fabric-poc script run plan-brief-write --output {plan_dir}/brief-{NN}-{slug}.md --spec '<json>'`. The brief spec MUST include:

- `number`, `total_phases`, `title`, `slug`, `phase_file`, `brief_file`, `plan_dir`, `kind`
- `depends_on`, `inputs`, `output_files`, `outputs`, `template_sections`, `checklist_sections`
- `skills_loaded`, `subagents_dispatched`, `user_decisions` (from brainstorm spec)
- `phase_file_lines` (estimate)
- `load_instructions[]` — name every file the phase will load at runtime, with `path`, `sections`, `reason`. NO globs.
- `rules_to_inline[]` — every kit rule the phase MUST carry verbatim under its `Rules` section, with `source` (kit rules path or companion skill id), `section` (anchor), `purpose`.

After all briefs are written, the brief package is the contract for phase compilation. NEVER edit briefs after this step without rerunning the corresponding `plan-brief-write`.
<!-- /append -->

<!-- append "planner_generate_step3a_user_gate" -->
**Step 3a — user gate before phase compilation.**

After `plan.toml` and every brief are on disk, STOP and present:
```
Plan manifest + briefs written: {plan_dir}/
  plan.toml ✓
  briefs: {N}/{N}
  phase files: 0/{N}

How should phase files be compiled?

  [1] Sub-agent dispatch (recommended) — one sub-agent per brief, parallelized within each dependency layer per planner-subagent-protocol L5
  [2] Inline — compile every phase here in this chat (slower; safer for small plans)
  [3] Downstream prompts only — emit one self-contained compile prompt per brief, no compilation in this run
  [4] Stop here — keep manifest and briefs, compile later with a fresh planner-generate invocation
```

Wait for the user's explicit choice. Do not advance until they pick.
<!-- /append -->

<!-- append "planner_generate_step4_compile_phase_files" -->
**Step 4 — compile phase files.**

The compilation path depends on the user's choice in Step 3a.

**Path 1 — Sub-agent dispatch (default, recommended):**

1. Build dependency layers from `phases[].depends_on`: layer 0 = phases with empty `depends_on`; layer N = phases whose `depends_on` are all in layers 0..N-1.
2. For each layer, dispatch one sub-agent per brief in parallel per `planner-subagent-protocol L2 input contract`. The default compilation sub-agent shipped by this kit is `fabric-planner-agent` with payload `mode: compile, plan_dir: <abs>, phase_number: <N>, brief_file: <name>` — it loads `planner-agent-compile` rules and produces a validated phase file. If `planner-brainstorm` recorded a different sub-agent name in the brief's `subagents_dispatched` for compilation, that pick overrides the default.
3. Await all returns of the layer per `L3 return contract` and verify each per `L4 parent verification`. Specifically for compilation: re-run `fabric-poc script run plan-phase-validate {phase_file} {brief_file}` and require `overall = "PASS"`.
4. On any verification failure, stop dispatching subsequent layers; surface the failing brief and the validator findings; do NOT mark the affected phase compiled.
5. After all layers complete, all `phase-*.md` files exist on disk.

**Path 2 — Inline:**

1. For each brief in dependency order, read the brief from disk, apply the context boundary, and compile one phase file in this chat following the brief's `Phase File Structure` and `Rules To Inline` sections.
2. Run `fabric-poc script run plan-phase-validate {phase_file} {brief_file}` after each compile; require `overall = "PASS"` before continuing.

**Path 3 — Downstream prompts only:**

1. For each brief, emit one self-contained compile prompt to the user. The prompt MUST instruct the downstream worker to read the brief from disk, apply the context boundary, compile exactly one phase file, and run `plan-phase-validate` before returning.
2. Do NOT write `phase-*.md` files in this run. Report `Phase {N} prompt prepared → {brief_file}` per phase and stop.

**Path 4 — Stop here:**

Report what was written (`plan.toml` + briefs) and stop. The user can re-invoke `planner-generate` later with the same spec; the cache-skip on `plan-manifest-write` should detect the existing manifest.
<!-- /append -->

<!-- append "planner_generate_step5_validate_kit" -->
**Step 5 — validate the compiled plan (Path 1 / Path 2 only).**

Run `fabric-poc script run plan-lint {plan_dir}` and confirm `overall = "PASS"` across all five categories. If FAIL, report the failing categories and recommend `planner-review` for full seven-category audit.

When all phases compiled and `plan-lint` passes:
```
Plan compiled: {plan_dir}
  Phases: {N}/{N}
  Validation: PASS (all 5 plan-lint categories)
```
Then present next steps:
```
What would you like to do next?
  [1] Validate plan thoroughly — run planner-review (full seven-category checklist)
  [2] Execute Phase 1 — run planner-execute
  [3] Inspect plan files — open phase-01-{slug}.md to review the first phase
  [4] Stop here — plan ready, no further action
```
<!-- /append -->

<!-- append "planner_generate_no_ralphex" -->
**Execution path constraints.**

- This mode writes plan files and dispatches sub-agents for COMPILATION only. It NEVER executes phases — that is `planner-execute`. Do NOT confuse "compile a phase file" (this mode) with "run the phase's task" (planner-execute).
- Do NOT propose ralphex or any external delegator. The planner's only execution paths are sub-agent dispatch and inline. The compilation step in this mode follows the same constraint.
<!-- /append -->
