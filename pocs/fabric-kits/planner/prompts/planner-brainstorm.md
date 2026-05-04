---
id: planner-brainstorm
type: rules
name: planner brainstorm
description: Decide task type, lifecycle, decomposition, skill/sub-agent integration per phase, and interaction points before any plan files exist; output a locked decomposition spec for planner-generate to compile
---

<!-- append "planner_brainstorm_input" -->
Use the user's planning request as the routing input. Expect a task description plus optional file references (raw input). The goal of this mode is to reach a locked decomposition spec — JSON describing the plan and every phase, ready to feed into `planner-generate`. NO `plan.toml` / brief / phase files are written in this mode.

Companion rules to load: `fabric-poc prompt get plan-decomposition` (always), `fabric-poc prompt get planner-subagent-protocol` (when sub-agent integration is being decided).

Default storage: `{project_root}/.fabric-plans/{task-slug}/`. The project root is the nearest enclosing git root (fall back to `process.cwd()`).
<!-- /append -->

<!-- append "planner_brainstorm_phase0_identity_and_lifecycle" -->
**Phase 0 — identity, target, lifecycle.**

1. Determine `task` (one-line description), `type` (`generate` / `analyze` / `implement`), `target_kind` (e.g. PRD, FEATURE, PROMPT), and `target` (artifact name, file path, or feature id). Ask one clarification question if any of these is ambiguous.
2. Resolve `target_form` (one of `artifact-path`, `artifact`, `path`, `feature-path`, `feature-id`, `feature-title`) per `plan-init`'s contract.
3. Ask the user which lifecycle to use BEFORE any decomposition (`plan-decomposition L6 lifecycle reservation` explains why upfront):
   ```
   Plan files live at {project_root}/.fabric-plans/{task-slug}/. How should completed plans be handled?
     [1] gitignore — keep plan files; .fabric-plans/ in .gitignore. Default for repo-internal work.
     [2] cleanup — add a final Cleanup phase that removes brief-/phase-/out/ after delivery.
     [3] archive — move to .fabric-plans/.archive/ when done.
     [4] manual — stop after execution and ask what to do with plan files.
   ```
4. Run `fabric-poc script run plan-init --task "..." --type ... --target-form ... --target ... [--target-kind ...] [--raw-input ...]... [--include-stdin] [--stdin-text "..."]` and capture: `task_slug`, `target_key`, `input_signature`, `plan_dir`, `needs_chunking`, `existing_plan_match`.
5. If `existing_plan_match = true`, ask whether to reuse the existing plan directory or replace it. Replacement requires the user's explicit confirmation; default is reuse.
<!-- /append -->

<!-- append "planner_brainstorm_phase1_raw_input_handling" -->
**Phase 1 — raw input materialization (only when applicable).**

1. If `plan-init.needs_chunking = false`, skip this phase. Raw input fits in the per-phase budget directly.
2. If `needs_chunking = true`, present:
   ```
   Raw input is {N} lines (threshold {T}). Materialize it as chunks under {plan_dir}/input/ now?
     [y] run plan-chunk-input and stage chunks + manifest.json
     [n] cancel — plan generation aborts (raw input cannot be passed inline)
   ```
3. On `y`, run `fabric-poc script run plan-chunk-input --output-dir {plan_dir}/input --raw-input ... [--include-stdin --stdin-text "..."] --max-lines 300`. Capture `input_signature` (must match plan-init's), `chunks[]`, `sources[]`. Add `input_chunks = [chunk paths]`, `input_dir`, `input_manifest`, `input_signature` to the decomposition spec.
4. On `n`, stop and report `Plan brainstorm cancelled — raw input not materialized.`
<!-- /append -->

<!-- append "planner_brainstorm_phase2_decomposition" -->
**Phase 2 — decompose.**

Apply `plan-decomposition` to derive the phase list:

1. Load the strategy that matches `plan.type` (`L2 strategy by task type`).
2. Inspect the target's structural rubric (template, checklist, FEATURE spec). For oversized rubrics, retain only the top-level list (H2 sections / categories / blocks) — not the bodies.
3. Group into phases per `L3 phase boundaries`. Aim for 3–8 phases for typical tasks; revisit boundaries if `total_phases > 10`.
4. Map intermediate-result data flow per `L4 intermediate results`: every phase that produces results consumed downstream gets `outputs = ["out/phase-{NN}-{what}.md"]`; the consuming phase lists those in `inputs`.
5. Estimate per-phase context budget per `L5 context budget`: `phase_file_lines + sum(input_files lines) + sum(inputs lines) + estimated_output_lines`. Flag every phase `> 1500`; SPLIT every phase `> 2000` before proceeding.
6. Reserve the final Cleanup phase per `L6 lifecycle reservation` if `lifecycle = cleanup`.

Produce a phase list with: `number`, `title`, `slug`, `kind` (`delivery` / `lifecycle`), `depends_on`, `input_files`, `output_files`, `outputs`, `inputs`, `template_sections` / `checklist_sections`, `phase_file_lines` (estimate).
<!-- /append -->

<!-- append "planner_brainstorm_phase3_skill_subagent_discovery" -->
**Phase 3 — skill / sub-agent integration per phase.**

1. Invoke the `fabric-observer` skill (or your platform's equivalent) ONCE to enumerate skills and sub-agents available in this session. Capture their names and one-line descriptions. The planner kit ships its own `fabric-planner-agent` (modes: `compile` / `execute` / `audit` / `rebuild-brief`) — it should appear in the discovery output when the kit is registered, and it is the default delegate for compile + execute work unless the user picks a more specialized sub-agent for a phase.
2. For each candidate phase from Phase 2, scan the skill / sub-agent inventory for plausible matches against that phase's work. Group candidates by role:
   - **load-as-companion**: rules / methodology to inline at runtime (`prompt-engineering`, `prd-template`, `script-engineering`, etc.). The companion's body is loaded via `fabric-poc prompt get {id}` inside the phase file's `Load` section.
   - **invoke-as-tool**: a skill / fabric-poc script the phase calls for deterministic transformations (`prompt-scaffold`, `script-scaffold`).
   - **delegate-as-subagent**: a sub-agent the phase dispatches per `planner-subagent-protocol` (Claude Code Task tool, `Explore`, `code-review`, etc.).
3. Present each phase's candidates to the user with the recommended pick:
   ```
   Phase {N}: {title}
     Candidates:
       - {candidate id / name} ({role}) — {one-line rationale}
       - ...
     Recommended: {your pick} ({role}) because {short justification}.
     User decision: [accept rec | pick others | none | combine multiple]
   ```
4. For multi-candidate phases (≥ 2 plausible matches), make the user's option set explicit: single, multiple, combined (use both), companion-only (load methodology, no dispatch). Persist the choice into the spec as `skills_loaded[]` / `subagents_dispatched[]` per phase.
5. When NO candidate fits a phase, mark it `inline` (no `subagents_dispatched`) and proceed — that is a legitimate state.
<!-- /append -->

<!-- append "planner_brainstorm_phase4_interaction_points" -->
**Phase 4 — interaction points.**

1. Recursively scan the target workflow / kit rules / checklist / template (and any file referenced by `ALWAYS open` / `OPEN and follow` directives) for interaction patterns:
   - questions: `ask the user`, `ask user`, `what is`, `which`, trailing `?`
   - inputs: `user provides`, `user specifies`, `input from user`
   - confirmations: `wait for`, `confirm`, `approval`, `before proceeding`
   - reviews: `review`, `present for`, `show to user`
   - decisions: `choose`, `select`, `option A or B`, `decide`
2. Classify each interaction point:
   - **pre-resolvable**: answerable now without context that only emerges mid-execution. Ask immediately, record the answer in the decomposition spec.
   - **phase-bound**: must be answered when its phase runs. Attach to that phase's `user_decisions` list with question text, options, default, and `record_in` target.
   - **cross-phase**: needed by multiple phases. Ask now and propagate to every consuming phase.
3. Report:
   ```
   Interaction points scan: {N} found ({pre-resolvable: a, phase-bound: b, cross-phase: c})
   ```
4. Ask all pre-resolvable / cross-phase questions now. Record answers under `decisions = {...}` in the spec. Phase-bound questions go into the corresponding phase's `user_decisions` array.
<!-- /append -->

<!-- append "planner_brainstorm_output_spec" -->
**Output — locked decomposition spec.**

Produce a single JSON document the user reviews and approves. After approval, this is the input to `planner-generate`. Shape:

```json
{
  "plan": {
    "task": "...",
    "type": "generate|analyze|implement",
    "target_kind": "...",
    "target": "...",
    "target_form": "...",
    "target_key": "...",
    "task_slug": "...",
    "kit_path": "...",
    "lifecycle": "gitignore|cleanup|archive|manual",
    "plan_dir": "...",
    "input_dir": "..." (when input_chunks non-empty),
    "input_manifest": "..." (when input_chunks non-empty),
    "input_signature": "..." (when input_chunks non-empty),
    "input_chunks": [],
    "decisions": {/* answered pre-resolvable + cross-phase questions */}
  },
  "phases": [
    {
      "number": 1,
      "title": "...",
      "slug": "...",
      "kind": "delivery|lifecycle",
      "depends_on": [],
      "input_files": [],
      "output_files": [],
      "outputs": [],
      "inputs": [],
      "template_sections": [],
      "checklist_sections": [],
      "phase_file_lines": 380,
      "skills_loaded": [{"id": "...", "role": "companion|tool", "purpose": "..."}],
      "subagents_dispatched": [{"name": "...", "role": "delegate|companion-runner", "purpose": "..."}],
      "user_decisions": [{"question": "...", "options": [...], "default": "...", "record_in": "..."}],
      "rules_to_inline": [{"source": "...", "section": "...", "purpose": "..."}],
      "load_instructions": [{"path": "...", "sections": "...", "reason": "..."}]
    }
  ]
}
```

Present this spec, then ask:
```
Lock this decomposition and dispatch to planner-generate? [y/n/edit]
```
On `y`, hand off to `planner-generate` (the user re-invokes the planner with the locked spec). On `n`, stop. On `edit`, list the editable fields and re-derive sections impacted by the edit.
<!-- /append -->

<!-- append "planner_brainstorm_no_ralphex" -->
**Execution path constraints.**

- The planner's only execution paths are sub-agent dispatch (per `planner-subagent-protocol`) and inline. Do NOT propose ralphex / external delegators in `subagents_dispatched`. If a future delegator is added, it will be a new entry in `planner-execute`'s dispatch table, not a per-phase configuration here.
- Do NOT silently inline a script's logic into a phase's Task section when a fabric-poc script already exists. Reference the script via `fabric-poc script run <id>` and let the runtime invoke it deterministically.
<!-- /append -->
