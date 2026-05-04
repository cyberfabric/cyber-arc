---
id: plan-brief-template
type: template
name: plan brief template
description: Brief-file layout (context boundary / phase metadata / load instructions / phase file structure / context budget) consumed by plan-brief-write and planner-generate
---

<!-- append "brief_overview" -->
A brief is the contract between decomposition (what to include in a phase) and compilation (how to assemble the phase file). Every `phase-{NN}-{slug}.md` MUST be compiled from a `brief-{NN}-{slug}.md` written first. The brief itself is `~50-80` lines; it carries metadata, load instructions, and budget — never copied kit content and never the phase file itself.

`plan-brief-write` writes briefs deterministically from a JSON spec produced by `planner-brainstorm` (locked decomposition) and `planner-generate` (compiler). A brief-by-hand path is not supported.
<!-- /append -->

<!-- append "brief_layout" -->
Every brief MUST have these sections, in this order, with these exact H2 headings:

```markdown
# Brief {N}: {Phase Title}

## Context Boundary
The phase compiled from this brief is self-contained. The compiler MUST read this brief from disk before writing the phase file. Do not enrich the phase file with content not named here.

## Phase Metadata
- Plan: `{plan_dir}/plan.toml`
- Phase: `{N}` of `{total_phases}`
- Slug: `{slug}`
- Phase file: `{plan_dir}/phase-{NN}-{slug}.md`
- Kind: `delivery` | `lifecycle`
- Depends on: `{depends_on}`
- Inputs (intermediate results from prior phases): `{inputs}`
- Output files (project files this phase creates / modifies): `{output_files}`
- Intermediate outputs (handed to later phases): `{outputs}`
- Template sections (H2 numbers from the target template, when applicable): `{template_sections}`
- Checklist sections (H2 numbers from the target checklist, when applicable): `{checklist_sections}`
- Skills loaded as companions (read-and-follow rules at runtime): `{skills_loaded[role=companion]}`
- Skills invoked as tools (`fabric-poc script run` / registered slash command): `{skills_loaded[role=tool]}`
- Sub-agents dispatched: `{subagents_dispatched}`
- Estimated phase file size: `~{phase_file_lines}` lines
- Context budget: `phase_file_lines + sum(input_files) + sum(inputs) + estimated_output_lines` ≤ `2000`

## Load Instructions
Files the compiler MUST read before assembling the phase file. Each entry names a path AND the section / line range to retain. The compiler MUST NOT load files outside this list.

- `path = {absolute or plan-relative path}`, `reason = {why this is needed}`, `sections = {H2 numbers or line ranges}`
- ...

For every `skills_loaded` entry with `role = companion`, the runtime Load step in the phase file MUST include `fabric-poc prompt get {id}`; the brief lists the id and the purpose so the compiler can render that line.

For every `subagents_dispatched` entry, the brief lists the agent name, the role (`delegate` | `companion-runner`), and the purpose; the compiler renders the Dispatch section in the phase file accordingly.

## Phase File Structure
The compiler MUST emit a `phase-{NN}-{slug}.md` file whose H2 headings, in order, are exactly: `Context Boundary`, `Phase Metadata`, `Load`, `Dispatch`, `Task`, `Rules`, `User Decisions`, `Output Format`, `Acceptance Criteria`, `Handoff`. See `plan-template` for the canonical body of each section.

## Rules To Inline
List every applicable `MUST` / `MUST NOT` rule the phase file MUST carry verbatim under its `Rules` heading. Rules are referenced by source (companion skill id or kit-rules path + section) so the compiler can fetch them. NEVER summarize or trim — if all rules don't fit the budget, request a phase split before compilation.

- `source = {skill id | rules-path}`, `section = {H2 or H3 anchor}`, `purpose = {why this rule applies to this phase}`
- ...

## User Decisions To Embed
List every interaction point assigned to this phase by `planner-brainstorm`. Each entry MUST name the question, the option set, the recommended default, and the decision-recording target (manifest field or `outputs` file).

- `question = "..."`, `options = [...]`, `default = "..."`, `record_in = {manifest path or outputs/file}`
- ...

If empty, write `none`.

## Acceptance Criteria For The Compiled Phase File
- [ ] All headings listed above are present in the order specified.
- [ ] Every `Rules To Inline` entry is present verbatim under `Rules`.
- [ ] Every `User Decisions To Embed` entry is present under `User Decisions`.
- [ ] No unresolved `{...}` placeholders outside fenced code blocks.
- [ ] Phase file size ≤ `1000` lines, total runtime context ≤ `2000` lines (per `Phase Metadata.Context budget`).
- [ ] `output_files` and `outputs` paths match this brief exactly.
```
<!-- /append -->

<!-- append "brief_load_instructions" -->
Load Instructions discipline:

- Every path is absolute or plan-relative. No globs, no wildcards — explicit list.
- Every entry names the section / line range to retain. The compiler must NOT keep full file bodies once the slice is extracted.
- Every entry names the reason. A path with no reason is a `plan-lint` finding.
- Companion skills appear here as a single `fabric-poc prompt get {id}` line per skill, with `reason = "load companion methodology"`.
- Tool skills appear here only when their output is needed at compile time (rare). Most tool invocations belong in the phase file's Task section instead.
- Raw-input chunk files (`{plan_dir}/input/*.md`) appear here exactly as named in `plan.input_chunks`; the compiler MUST NOT widen the chunk list.
<!-- /append -->

<!-- append "brief_field_reference" -->
Field reference (every placeholder is filled by `plan-brief-write` from the JSON spec produced by `planner-brainstorm`):

- `{N}` / `{NN}` — phase number, 1-based / zero-padded.
- `{slug}` — kebab-case phase slug.
- `{total_phases}` — total number of phases declared in the manifest.
- `{depends_on}` — phases that must be `done` before this one runs.
- `{inputs}` — intermediate `out/*.md` paths from prior phases consumed by this one.
- `{output_files}` — project files this phase creates / modifies.
- `{outputs}` — intermediate `out/*.md` paths this phase produces for later phases.
- `{template_sections}` / `{checklist_sections}` — template / checklist H2 numbers covered by this phase, when applicable.
- `{skills_loaded}` / `{subagents_dispatched}` — per-phase integration choices recorded by `planner-brainstorm`.
- `{phase_file_lines}` — estimated line count for the compiled phase file.
- `{plan_dir}` — `{project_root}/.fabric-plans/{task-slug}`.

Unresolved `{...}` outside fenced code blocks in a written brief is a `plan-lint` CRITICAL finding.
<!-- /append -->
