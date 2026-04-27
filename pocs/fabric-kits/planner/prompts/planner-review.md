---
id: planner-review
type: rules
name: planner review
description: Re-validate an existing plan after edits against plan-checklist using the plan-lint script, surface failures by category, and recommend specific repairs
---

<!-- append "planner_review_input" -->
Use the user's request as the routing input. Expect a path to an existing plan directory the user wants validated — typically after manual edits to `plan.toml`, briefs, or phase files, or before handing the plan off to execution.
<!-- /append -->

<!-- append "planner_review_workflow" -->
1. Resolve `<plan_dir>`. Confirm `<plan_dir>/plan.toml` exists.
2. Load the seven-category checklist via `fabric prompt get plan-checklist`.
3. Run the deterministic backstops:
   - `fabric script run plan-lint <plan_dir>` — covers categories 1 (structural), 5 (phase independence — partial), 6 (budget), 7 (lifecycle).
   - For each phase listed in the manifest, run `fabric script run plan-phase-validate <plan_dir>/<phases[i].file> <plan_dir>/<phases[i].brief_file>` — covers category 5 (heading set + order, unresolved placeholders, line budget per phase).
4. For categories 2 (interactive questions), 3 (rules coverage), 4 (context completeness): inspect the briefs and phase files yourself. These require judgment and content reading; the deterministic scripts do not cover them.
5. Aggregate findings into a single report grouped by checklist category. For each FAIL, name the specific item, the affected phase / file, and a concrete repair recommendation citing the corresponding script (`plan-phase-validate`, `plan-lint`) or the brief / phase file to edit.
<!-- /append -->

<!-- append "planner_review_report_format" -->
Output format:
```
Plan review: {plan_dir}

═══════════════════════════════════════════════
Plan Self-Validation: {task-slug}
───────────────────────────────────────────────
| Category                  | Status |
|---------------------------|--------|
| 1. Structural             | PASS/FAIL |
| 2. Interactive Questions  | PASS/FAIL |
| 3. Rules Coverage         | PASS/FAIL |
| 4. Context Completeness   | PASS/FAIL |
| 5. Phase Independence     | PASS/FAIL |
| 6. Budget Compliance      | PASS/FAIL |
| 7. Lifecycle & Handoff    | PASS/FAIL |
Overall: PASS/FAIL
═══════════════════════════════════════════════

Findings:
  [Category N] {item} — phase {p} / {path}
    Why this failed: {short explanation}
    Repair: {concrete next action, e.g. "rewrite the brief to include section X" or "split phase 4 — current file 1240 lines exceeds 1000 budget"}
```

When all categories PASS, report `Overall: PASS` and add `Plan ready for execution.` Do NOT recommend running `planner-execute` — let the user decide based on the PASS report.
<!-- /append -->

<!-- append "planner_review_output_contract" -->
Output: the validation report only. Do NOT mutate any files in `plan_dir`. Repair recommendations are advisory; if the user wants you to apply them, that is a separate `planner-generate` (rewrite a phase) or `planner-recover` (manifest repair) invocation.
<!-- /append -->
