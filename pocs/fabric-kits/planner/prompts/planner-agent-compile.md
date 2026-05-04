---
id: planner-agent-compile
type: rules
name: planner agent compile
description: Mode rules loaded by planner-agent when mode=compile — read brief from disk, follow plan-template, write phase-{NN}-{slug}.md, validate via plan-phase-validate, return structured payload
---

<!-- append "planner_agent_compile_overview" -->
**Scope**: compile a single phase file from its brief. Loaded by `planner-agent` when the inbound payload has `mode: compile`. Caller is typically `planner-generate` Path 1 (sub-agent dispatch fan-out per dependency layer) but any caller respecting `planner-subagent-protocol` may invoke this.

**Pre-conditions**: `plan_dir` exists, `plan_dir/{brief_file}` exists, the brief was written by `plan-brief-write` (you trust its structure).

**Post-condition**: `plan_dir/{phase_file}` exists, follows `plan-template` heading set + order, contains every Rule from the brief verbatim, contains every User Decision from the brief, has no unresolved `{...}` placeholders outside fences, ≤ 1000 lines.
<!-- /append -->

<!-- append "planner_agent_compile_load" -->
1. Read `plan_dir/{brief_file}` from disk. Extract:
   - phase number, title, slug from `# Brief N: title`
   - phase metadata: depends_on, inputs, output_files, outputs, skills_loaded, subagents_dispatched, kind, plan_dir
   - Load Instructions list (paths + sections + reasons)
   - Phase File Structure heading list (the canonical 10 H2 headings)
   - Rules To Inline list (verbatim text to embed under the phase's `Rules` section)
   - User Decisions To Embed list (or "none")
2. Load `fabric-poc prompt get plan-template` for the canonical phase-file body shape; cite specific block ids (`template_phase_layout`, `template_load_section`, `template_dispatch_section`, `template_field_reference`) — do NOT restate.
3. Load any companion methodologies the brief references through Rules To Inline `source` fields, when they materially shape the phase body (e.g. `prd-template`, `prompt-engineering`).
<!-- /append -->

<!-- append "planner_agent_compile_emit" -->
Emit the phase file with EXACTLY these H2 headings in order (per `plan-template`):

`Context Boundary` → `Phase Metadata` → `Load` → `Dispatch` → `Task` → `Rules` → `User Decisions` → `Output Format` → `Acceptance Criteria` → `Handoff`.

Per heading:

- **Context Boundary**: verbatim `Disregard all previous chat context. This phase file is self-contained. Read ONLY the files listed in the Load section below. Follow the Task section exactly.`
- **Phase Metadata**: render the brief's metadata as a bulleted list per `plan-template template_phase_layout`. Resolve every placeholder (`{N}`, `{slug}`, `{plan_dir}`, etc.) — no `{...}` outside fenced code blocks.
- **Load**: enumerate the brief's Load Instructions verbatim as numbered steps. Add a `fabric-poc prompt get {id}` line for every `skills_loaded[role=companion]` entry.
- **Dispatch**: per `plan-template template_dispatch_section`, render based on the brief's `subagents_dispatched`. If the list is empty, write `Inline.` and nothing else.
- **Task**: imperative steps that produce the declared `output_files` and `outputs`. Every step that maps to a fabric-poc script MUST cite `fabric-poc script run <id>`. Steps requiring judgment cite the loaded companion skill that owns that judgment.
- **Rules**: paste every Rules-To-Inline entry verbatim. NEVER summarize, trim, or cherry-pick. If everything does not fit under 1000 phase-file lines, return FAIL with `validation_findings: ["budget exceeds 1000 — split the phase before recompile"]` — do NOT trim rules.
- **User Decisions**: paste every entry from User Decisions To Embed, or `No phase-bound user decisions.` if empty.
- **Output Format**: list every `output_files` path and every `outputs` path, plus any inline summary fields the runner must print.
- **Acceptance Criteria**: a checkbox list whose items mirror the brief's Acceptance Criteria For The Compiled Phase File but expressed for the runtime (e.g. `[ ] {output_files[0]} exists and matches the Output Format.`).
- **Handoff**: `On success: report status done, list every file written, and emit the next-phase prompt produced by planner-execute.` and `On failure: report status failed, name the failing acceptance criterion, and stop.`
<!-- /append -->

<!-- append "planner_agent_compile_validate_and_return" -->
After writing the phase file:

1. Run `fabric-poc script run plan-phase-validate {plan_dir}/{phase_file} {plan_dir}/{brief_file}`. The script returns JSON with `categories` and `overall`.
2. If `overall = "PASS"`: return success per `planner-subagent-protocol L3`:
   ```json
   {
     "phase_number": <N>,
     "phase_file_path": "{plan_dir}/{phase_file}",
     "intermediate_outputs": [],
     "output_files": [],
     "validation_outcome": "PASS",
     "notes": "compiled and validated"
   }
   ```
3. If `overall = "FAIL"`: do NOT consider compilation done. Either fix the violations (re-emit the phase) and re-validate, OR if the violation is structural (budget overflow, missing rules text), return FAIL with the script's `categories` as `validation_findings` and a `notes` line explaining what the caller must fix in the brief.

NEVER mark `validation_outcome: "PASS"` while `plan-phase-validate` reports findings.
<!-- /append -->
