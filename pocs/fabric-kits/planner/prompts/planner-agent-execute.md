---
id: planner-agent-execute
type: rules
name: planner agent execute
description: Mode rules loaded by planner-agent when mode=execute — read phase file, load companion skills, read inputs, follow Task section, write outputs, verify Acceptance Criteria, return structured payload
---

<!-- append "planner_agent_execute_overview" -->
**Scope**: execute a single phase from its compiled phase file. Loaded by `planner-agent` when the inbound payload has `mode: execute`. Caller is typically `planner-execute` when the phase's brief did not pick a more specialized sub-agent.

**Pre-conditions**: `plan_dir/{phase_file}` exists and was previously validated by `plan-phase-validate`. The phase's status in `plan.toml` is `pending` or `in_progress`.

**Post-condition**: every path in the phase's `output_files` list exists on disk and matches the Output Format; every path in the phase's `outputs` list exists at `plan_dir/{path}`; every checkbox in `Acceptance Criteria` observably holds.

You DO NOT update `plan.toml` status — that is the dispatcher's responsibility after verifying your return payload per `planner-subagent-protocol L4`.
<!-- /append -->

<!-- append "planner_agent_execute_load" -->
1. Read `plan_dir/{phase_file}` from disk. Extract:
   - phase metadata block: `output_files`, `outputs`, `inputs`, `skills_loaded`, `input_files`, `depends_on`
   - the `Task` section (imperative steps)
   - the `Rules` section (verbatim rules to honor)
   - the `User Decisions` section (any phase-bound questions to resolve before producing outputs)
   - the `Acceptance Criteria` section (the checkbox list you must satisfy)
2. For each entry in `skills_loaded[role=companion]`, run `fabric prompt get {id}` and treat the output as inlined methodology rules for this phase. Cite specific layers when applicable.
3. For each entry in `input_files`, read the file and retain only the section ranges named in the phase's Load section.
4. For each entry in `inputs`, read `plan_dir/{path}` (the upstream phase's intermediate output) and retain only what the Task section actually consumes.
5. Do NOT load files outside this list. The phase is self-contained per the Context Boundary; widen the load only if the loaded methodology explicitly requires it AND the brief / phase Load instructions allow it.
<!-- /append -->

<!-- append "planner_agent_execute_run" -->
Follow the phase's `Task` section step by step:

- For every step that maps to a `fabric script run <id>` invocation, run the script and use its output. Do NOT inline the logic.
- For every step that maps to a `fabric prompt get <id>` invocation, load that prompt and apply its instructions.
- For every step requiring judgment, apply the loaded companion methodology and cite layers / bug-class codes rather than restating.
- For every `User Decisions` entry that is unanswered: HALT, return FAIL with `notes` naming the unresolved decision. Do NOT guess defaults — the dispatcher should have resolved them before dispatch (per `planner-brainstorm` Phase 4 / `planner-execute` pre-dispatch handling).

Honor every Rule under the `Rules` section as a hard constraint. A produced output that violates a Rule is a FAIL even if Acceptance Criteria appear satisfied.

Write each declared output:

- `output_files` (project-side files): write to the path exactly as declared. If the path is relative, resolve relative to the project root inferred from `plan_dir` (`plan_dir = {project_root}/.fabric-plans/{task-slug}`).
- `outputs` (intermediate scratch for downstream phases): write to `plan_dir/{path}` exactly. The convention is `out/phase-{NN}-{what}.md`.
- Atomicity: prefer writing each output once at the end of the run. If interleaved writes are necessary (large outputs assembled in stages), still verify each file is fully written before claiming success.
<!-- /append -->

<!-- append "planner_agent_execute_verify_and_return" -->
Before returning, verify every Acceptance Criteria checkbox observably holds:

1. Every path in `output_files` and `outputs` exists on disk at the declared location.
2. Every Output-Format requirement (file content, schema, fenced-block contract) is satisfied.
3. Every Rule under `Rules` was honored (this is judgment — if any rule was paraphrased, summarized, or skipped, that is a FAIL).
4. No phase-bound `User Decisions` were silently defaulted.

On full PASS, return:
```json
{
  "phase_number": <N>,
  "phase_file_path": "{plan_dir}/{phase_file}",
  "intermediate_outputs": [<absolute paths under plan_dir/out/>],
  "output_files": [<absolute paths of project-side files written>],
  "validation_outcome": "PASS",
  "notes": "executed and verified"
}
```

On any failure, return `validation_outcome: "FAIL"` with `validation_findings` listing the failing Acceptance Criterion(s) and `notes` explaining what blocked completion. The dispatcher MUST mark the phase `failed` based on this — never mark PASS to `plan.toml` while findings exist.
<!-- /append -->
