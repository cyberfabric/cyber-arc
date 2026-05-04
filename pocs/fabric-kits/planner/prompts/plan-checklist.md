---
id: plan-checklist
type: checklist
name: plan checklist
description: Seven-category validation checklist for a fabric plan directory — structural, interactive questions, rules coverage, context completeness, phase independence, budget compliance, lifecycle and handoff
---

<!-- append "plan_checklist_intro" -->
Apply this checklist when validating a generated plan or re-validating after edits. Categories 1, 5, 6, 7 have a deterministic backstop in `fabric-poc script run plan-lint <plan_dir>` and `fabric-poc script run plan-phase-validate <phase_file> <brief_file>`. Categories 2, 3, 4 require judgment and content reading — they cannot be fully automated and need a human or LLM reviewer pass.

For each item: PASS / FAIL / N/A. A single FAIL in any item makes the overall checklist FAIL. Use `planner-review` to apply this checklist programmatically.
<!-- /append -->

<!-- append "plan_checklist_1_structural" -->
**1. Structural** (deterministic via `plan-lint`):

- [ ] `plan.toml` exists at `{plan_dir}/plan.toml` and parses as TOML.
- [ ] `[plan]` table contains every required field: `task`, `type`, `target`, `target_key`, `kit_path`, `created`, `lifecycle`, `execution_status`, `lifecycle_status`, `plan_dir`, `active_plan_dir`, `total_phases`.
- [ ] `phases` is an array, length equals `plan.total_phases`.
- [ ] Phase numbering is `1..N` contiguous (no gaps, no duplicates).
- [ ] Every `phases[].number` is a positive integer.
- [ ] Every `phases[].depends_on` entry is an integer in `[1, this_phase_number)` and `≤ total_phases`.
- [ ] Every `phases[].file` is `phase-{NN}-{slug}.md`; every `phases[].brief_file` is `brief-{NN}-{slug}.md`.
- [ ] Every `phases[].slug` is kebab-case.
- [ ] Every brief and phase file referenced in the manifest exists on disk under `plan_dir`.
<!-- /append -->

<!-- append "plan_checklist_2_interactive_questions" -->
**2. Interactive Questions** (judgment):

- [ ] Every interaction point in the target workflow / rules / checklist / template has been identified during `planner-brainstorm` (recursively scanned, including navigation-rule-linked files).
- [ ] Each interaction point is classified `pre-resolvable`, `phase-bound`, or `cross-phase`.
- [ ] Pre-resolvable and cross-phase questions were asked BEFORE plan generation; their answers are recorded in `plan.toml` (a dedicated table or a per-phase manifest field) or in `plan_dir/decisions.md`.
- [ ] Phase-bound questions appear under the corresponding phase file's `User Decisions` heading with question text, option set, default recommendation, and decision-recording target (manifest field or `outputs/...` file).
- [ ] No interaction point has been silently dropped to fit budget.
<!-- /append -->

<!-- append "plan_checklist_3_rules_coverage" -->
**3. Rules Coverage** (judgment):

- [ ] Every applicable `MUST` / `MUST NOT` rule from the kit's authoritative rules file (e.g. PRD-kit `rules.md`) appears verbatim under some phase's `Rules` section.
- [ ] No rule was summarized, paraphrased, or trimmed to fit a phase's line budget. When all rules don't fit, the phase was split — never trimmed.
- [ ] The union of all phases' `Rules` sections covers `100%` of applicable kit rules.
- [ ] Rules-completeness can be cross-checked by listing every `MUST` / `MUST NOT` from the kit rules file and matching it to a phase. Unmatched rules → FAIL.
- [ ] When `task_type ≠ generic`, the kit's matching rules are explicitly named in the brief's `Rules To Inline` for at least one phase.
<!-- /append -->

<!-- append "plan_checklist_4_context_completeness" -->
**4. Context Completeness** (judgment):

- [ ] Every navigation rule (`ALWAYS open`, `OPEN and follow`, `ALWAYS open and follow`) from the target workflow has been processed during decomposition; the loaded-file manifest is recorded.
- [ ] Each phase's brief Load Instructions name every file the phase needs at runtime, with the specific section / line range to retain.
- [ ] No phase reads a file at runtime that is not named in its brief Load Instructions.
- [ ] Companion skills loaded via `fabric-poc prompt get <id>` are named in the brief and in the phase file's Load section.
- [ ] When `plan.input_chunks` is non-empty, every chunk file is assigned to at least one phase's `input_files` and appears in that phase's brief Load Instructions.
<!-- /append -->

<!-- append "plan_checklist_5_phase_independence" -->
**5. Phase Independence** (deterministic + judgment):

- [ ] Each phase file begins with `## Context Boundary` instructing the runner / sub-agent to disregard prior context.
- [ ] Each phase file is compiled from its corresponding brief on disk (the brief was read from disk, not reconstructed from chat).
- [ ] Each phase file contains every required H2 heading in order: `Context Boundary`, `Phase Metadata`, `Load`, `Dispatch`, `Task`, `Rules`, `User Decisions`, `Output Format`, `Acceptance Criteria`, `Handoff` (`plan-phase-validate` `required_headings`).
- [ ] No phase file references "as we discussed earlier" or any other chat-context dependency.
- [ ] No unresolved `{...}` placeholders outside fenced code blocks (`plan-phase-validate` `unresolved_placeholders`).
<!-- /append -->

<!-- append "plan_checklist_6_budget" -->
**6. Budget Compliance** (deterministic via `plan-lint` + `plan-phase-validate`):

- [ ] Every phase file is `≤ 1000` lines (`plan-phase-validate` `line_budget`, `plan-lint` `budget`).
- [ ] For each phase, `phase_file_lines + sum(input_files lines) + sum(inputs lines) + estimated_output_lines ≤ 2000` at runtime.
- [ ] Phases flagged `1501-2000` lines have been reviewed and the load slices trimmed to the smallest necessary range.
- [ ] No phase exceeds `2000` total runtime context — split before compile, never trim rules to fit.
<!-- /append -->

<!-- append "plan_checklist_7_lifecycle_handoff" -->
**7. Lifecycle & Handoff** (deterministic via `plan-lint`):

- [ ] `plan.lifecycle` is one of `gitignore`, `cleanup`, `archive`, `manual`.
- [ ] `plan.lifecycle_status` is one of `pending`, `ready`, `in_progress`, `manual_action_required`, `done`, `failed`.
- [ ] `plan.execution_status` is one of `not_started`, `in_progress`, `done`, `failed`.
- [ ] When `lifecycle = "cleanup"`, the final phase is reserved for cleanup, depends on the last delivery phase, and is marked `kind = "lifecycle"` in `plan.toml`.
- [ ] When `lifecycle = "gitignore"`, `.fabric-plans/` is in the project's `.gitignore` and `plan.lifecycle_status = "done"` from creation onward.
- [ ] No reference to `ralphex` or any external delegator in any phase file or brief — the planner's only execution paths are sub-agent dispatch (per `planner-subagent-protocol`) and inline.
<!-- /append -->
