---
id: plan-decomposition
type: rules
name: plan decomposition
description: Decomposition methodology by task type for the fabric planner — phase boundary heuristics, intermediate-result data flow, review-phase placement, context budget per phase, lifecycle phase reservation
---

<!-- append "plan_decomposition_overview" -->
**Scope**: how to break a task into phases for a `plan.toml` driven by the fabric planner. Loaded by `planner-brainstorm` (to lock the decomposition spec) and `planner-generate` (to validate the plan being compiled). Cite layers (`L2 phase boundaries`, `L4 context budget`) rather than restating.

**Goal**: produce a phase list where (a) every phase is independently runnable from its brief, (b) intermediate data flow between phases is explicit, (c) per-phase runtime context stays under the budget, (d) lifecycle handling is structurally part of the plan, not an afterthought.

**Out of scope**: choice of skills/sub-agents per phase (that's `planner-brainstorm`'s integration discovery step), and the brief / phase file content itself (that's `planner-generate`'s compilation step). This rule decides only the *shape* of the phase list.
<!-- /append -->

<!-- append "plan_decomposition_strategy_by_task_type" -->
Pick the strategy matching `plan.type`:

- **`generate`**: load the target template (or the artifact's structural rubric), list its top-level sections (typically H2s), group them into phases of `2-4` sections each. Phase 1 covers the structural spine (metadata, overview); the final phase covers integration / acceptance.
- **`analyze`**: load the target checklist, list its categories, group by validation pipeline order: structural → semantic → cross-reference → traceability → synthesis. One phase per natural pipeline boundary.
- **`implement`**: load the FEATURE spec, list its CDSL blocks (or implementation units), assign one block + its tests per phase, prepend a scaffolding phase if scaffolding is needed, and append a final integration / verification phase.

If the task does not map to any of these (rare), document why in the brainstorm output and proceed by analogy with the closest type.
<!-- /append -->

<!-- append "plan_decomposition_phase_boundaries" -->
A phase boundary is well-placed when:

1. **Self-contained input**: the phase's `input_files` and `inputs` are explicit and bounded; it does not need to read additional files at runtime.
2. **Verifiable output**: the phase declares concrete `output_files` and `outputs` whose presence after execution is observable.
3. **No mid-phase user gate**: a phase that needs a user decision either embeds it in `User Decisions` (phase-bound) or exposes it as a pre-resolvable question answered before plan generation. A user gate that splits a phase mid-task is a phase-boundary defect — split into two phases instead.
4. **Single artifact focus**: a phase modifies one canonical artifact (one PRD, one feature spec, one set of CDSL blocks). Phases that touch multiple artifacts almost always want splitting.
5. **No backtracking dependency**: phase N never produces an output that phase N-k (k > 0) needs to revise. Forward-only data flow.

When `total_phases > 10`, re-examine boundaries — usually you've over-decomposed or the task should have been split into multiple plans.
<!-- /append -->

<!-- append "plan_decomposition_intermediate_results" -->
Phases communicate via `outputs` and `inputs`:

- **`outputs`**: list of `out/{filename}` paths under `plan_dir/out/` that this phase writes for downstream phases. These are intermediate scratch — not the project's final artifact. Naming: `out/phase-{NN}-{what}.md`.
- **`inputs`**: list of `out/{filename}` paths from prior phases that this phase reads. Every entry MUST appear in some upstream phase's `outputs`.
- **`output_files`**: project files this phase creates or modifies (the actual artifact under construction). These persist after the plan is done.

Discipline:
- If a later phase needs a phase result, route it through `outputs` / `inputs` — never assume re-reading `output_files` will recover it (the artifact may have been consolidated or partially overwritten).
- If only the final phase consumes a prior result, list it as that final phase's `inputs`; intermediate phases don't need it.
- If the final phase assembles prior outputs into one artifact, its `inputs` MUST list ALL upstream `outputs` it reads.
<!-- /append -->

<!-- append "plan_decomposition_context_budget" -->
Per-phase context budget at runtime:

```
phase_file_lines + sum(input_files lines) + sum(inputs lines) + estimated_output_lines  ≤  2000
```

Levels:
- `≤ 1500`: nominal. Compile and run inline or via sub-agent.
- `1501-2000`: WARNING. Trim load instructions to the smallest necessary slices; drop nonessential template excerpts. Validate via `plan-phase-validate`.
- `> 2000`: OVERFLOW. The phase MUST be split before compilation. NEVER compile an overflowing phase by hand-trimming rules.

The phase file itself stays `≤ 1000` lines (`plan-phase-validate` `line_budget` category enforces this). The other 1000 lines are the runtime context the phase pulls in via Load.

When raw input (`input_chunks`) is large enough to push runtime context over budget, dedicate one or more ingestion phases that consolidate chunks into smaller `outputs` for downstream phases.
<!-- /append -->

<!-- append "plan_decomposition_lifecycle_reservation" -->
Lifecycle is a structural property of the plan, decided **before** phase numbering is locked:

- **`gitignore`**: planning-time hygiene. No reserved lifecycle phase. Add `.fabric-plans/` to the project's `.gitignore` once and set `lifecycle_status = "done"` immediately. No post-completion plan-file prompt.
- **`cleanup`**: reserve a final Cleanup phase **now** so `total_phases`, dependencies, and budget estimates are structurally correct before `plan.toml` is written. The Cleanup phase depends on the last delivery phase and removes `brief-*`, `phase-*`, and `out/` after delivery passes. `plan.toml` itself stays as the terminal receipt. Audits MUST treat the absence of those files as exempt under this lifecycle (see `planner-recover` cleanup-exemption).
- **`archive`**: no reserved phase. After all phases are `done`, the plan directory is moved to `.fabric-plans/.archive/{task-slug}/`. `active_plan_dir` updates accordingly.
- **`manual`**: no reserved phase. After all phases are `done`, present one keep / archive / delete prompt — only this lifecycle allows a post-completion plan-file decision.

Ask the user once, early in `planner-brainstorm`, which lifecycle to use; record the choice in `plan.lifecycle`. Reserving a Cleanup phase after-the-fact requires re-numbering and is a structural defect — decide upfront.
<!-- /append -->
