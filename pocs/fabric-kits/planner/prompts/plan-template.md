---
id: plan-template
type: template
name: plan template
description: Phase-file layout (Task / Rules / Output Format / Acceptance Criteria / User Decisions / Handoff) consumed by planner-generate
---

<!-- append "template_overview" -->
This template is the canonical layout for every `phase-{NN}-{slug}.md` file written by `planner-generate`. A phase file is the self-contained instruction handed to a sub-agent (default) or the same chat (fallback) when that phase runs. Phase files MUST be compiled from a `brief-{NN}-{slug}.md` written by `plan-brief-write` — never by hand.

A phase file MUST be readable cold: a sub-agent that reads only this file (plus the load instructions inside it) and follows them exactly produces the declared `output_files` and `outputs`.
<!-- /append -->

<!-- append "template_phase_layout" -->
Every phase file MUST have these sections, in this order, with these exact H2 headings:

```markdown
# Phase {N}: {Phase Title}

## Context Boundary
Disregard all previous chat context. This phase file is self-contained. Read ONLY the files listed in the Load section below. Follow the Task section exactly. Do not introduce work that is not described here.

## Phase Metadata
- Plan: `{plan_dir}/plan.toml`
- Phase: `{N}` of `{total_phases}`
- Slug: `{slug}`
- Brief: `{plan_dir}/brief-{NN}-{slug}.md`
- Depends on: `{depends_on}` (phases listed must already be `done`)
- Inputs (intermediate results from prior phases): `{inputs}`
- Output files (project files this phase creates / modifies): `{output_files}`
- Intermediate outputs (handed to later phases): `{outputs}`
- Skills loaded as companions (read-and-follow): `{skills_loaded[role=companion]}`
- Skills invoked as tools: `{skills_loaded[role=tool]}`
- Sub-agents dispatched: `{subagents_dispatched}`
- Context budget: `{phase_file_lines + input_files + inputs + estimated_output_lines}` ≤ `2000` lines

## Load
1. Read the brief file at `{plan_dir}/brief-{NN}-{slug}.md` from disk and follow its Load Instructions verbatim.
2. For each entry in `skills_loaded[role=companion]`, run `fabric prompt get {id}` and treat its output as inlined rules for this phase.
3. For each entry in `input_files`, read the file and retain only the section ranges named in the brief.
4. For each entry in `inputs`, read `{plan_dir}/{path}` and retain only the section ranges named in the brief.
5. Do not load files outside this list.

## Dispatch
- If `subagents_dispatched` is non-empty, the parent runner dispatches one sub-agent per entry following `planner-subagent-protocol` and waits for the structured return before treating the dispatched work as done.
- If `subagents_dispatched` is empty, the runner executes Task inline.
- This section MUST NOT introduce a delegation target other than the listed sub-agents.

## Task
{Concrete imperative steps. Every step that has a single correct output for fixed inputs MUST cite a fabric script (`fabric script run <id> ...`) instead of describing the logic in prose. Steps that require judgment, drafting, discussion, or review MUST cite the loaded companion skill that owns that judgment.}

## Rules
{Inline every applicable `MUST` / `MUST NOT` rule that the brief assigns to this phase, verbatim. NEVER summarize, trim, or cherry-pick rules to fit budget — split the phase instead.}

## User Decisions
{For every interaction point assigned to this phase by `planner-brainstorm`, embed the question, the option set, the default recommendation, and the decision-recording target (which manifest field or which `outputs` file).}

If no interaction points are assigned, write: `No phase-bound user decisions.`

## Output Format
{Exactly the shape the runner / sub-agent must report on completion. List every file in `output_files` and every file in `outputs` that MUST exist after this phase runs, plus any inline summary fields the runner should print.}

## Acceptance Criteria
- [ ] Every file in `output_files` exists and matches the Output Format.
- [ ] Every file in `outputs` exists at `{plan_dir}/out/{filename}`.
- [ ] Every applicable rule under `Rules` is observably honored in the output.
- [ ] Every `User Decisions` interaction point has a recorded answer (in the manifest or in `outputs`).
- [ ] No file outside `output_files` and `outputs` was modified by this phase.

## Handoff
- On success: report status `done`, list every file written, and emit the next-phase prompt produced by `planner-execute` (do NOT duplicate that prompt inside this phase file).
- On failure: report status `failed`, name the failing acceptance criterion, and stop. Do not partially commit.
```
<!-- /append -->

<!-- append "template_load_section" -->
The Load section is the single discovery point for the phase. The runner MUST NOT read any file that is not reached transitively through the brief, the listed companion skills, the listed `input_files`, or the listed `inputs`. The brief is the only gateway: every file the phase ever needs is named there.

Companion skills are loaded with `fabric prompt get {id}` and treated as inlined rules. Tool skills are invoked once per use as `fabric script run {id} ...` (or the equivalent registered slash command). Sub-agents are dispatched per the Dispatch section, not loaded as rules.
<!-- /append -->

<!-- append "template_dispatch_section" -->
Sub-agent dispatch is the default execution path for any phase whose brief declares a `subagents_dispatched` entry. The parent runner:
1. Builds the sub-agent input strictly from this phase file plus the brief — no chat-context leak.
2. Sends the input over the integration the sub-agent declared (Task tool, IDE agent, etc.).
3. Awaits the structured return defined by `planner-subagent-protocol`: `{phase_file_path, line_count, validation_outcome, intermediate_outputs[]}`.
4. Validates the return against this phase's Acceptance Criteria before marking the phase `done`.

If multiple sub-agents are dispatched for the same phase, the runner dispatches them in parallel only when their `intermediate_outputs[]` paths do not collide.

Inline execution (no sub-agent) is reserved for phases whose Dispatch section explicitly lists no sub-agents. Inline runs follow the same Acceptance Criteria; they just skip the dispatch / return-validation step.
<!-- /append -->

<!-- append "template_field_reference" -->
Field reference (placeholders in this template are filled by `plan-brief-write` and the planner-generate compiler):

- `{N}` — phase number, 1-based.
- `{NN}` — phase number, zero-padded to two digits.
- `{slug}` — kebab-case phase slug from the brief.
- `{plan_dir}` — `{project_root}/.fabric-plans/{task-slug}`.
- `{total_phases}` — `[plan].total_phases` from `plan.toml`.
- `{depends_on}` — `[[phases]].depends_on` from the manifest.
- `{inputs}` — `[[phases]].inputs` (intermediate `out/*.md` paths from prior phases).
- `{output_files}` — `[[phases]].output_files` (project files this phase creates).
- `{outputs}` — `[[phases]].outputs` (intermediate results for later phases).
- `{skills_loaded[role=...]}` — filtered subset of `[[phases]].skills_loaded` whose `role` matches.
- `{subagents_dispatched}` — `[[phases]].subagents_dispatched` from the manifest.

Every placeholder MUST be resolved before the phase file is written. Unresolved `{...}` outside fenced code blocks is a `plan-phase-validate` CRITICAL finding.
<!-- /append -->
