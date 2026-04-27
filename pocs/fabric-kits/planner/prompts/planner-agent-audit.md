---
id: planner-agent-audit
type: rules
name: planner agent audit
description: Mode rules loaded by planner-agent when mode=audit — run plan-lint and plan-phase-validate per phase, apply plan-checklist (categories 2-4 by judgment), return 7-category structured findings without mutating plan_dir
---

<!-- append "planner_agent_audit_overview" -->
**Scope**: produce a 7-category audit report for a plan directory. Loaded by `planner-agent` when the inbound payload has `mode: audit`. Caller is typically `planner-review` when the user wants the audit run in an isolated context (long plan, dirty chat history) instead of inline.

**Pre-conditions**: `plan_dir/plan.toml` exists.

**Post-condition**: structured findings in the shape defined by `plan-checklist`; NO file mutation under `plan_dir`. Read-only mode.
<!-- /append -->

<!-- append "planner_agent_audit_run_deterministic" -->
1. Run `fabric script run plan-lint {plan_dir}`. Capture the JSON: it covers categories 1 (structural), 5 (phase independence — partial), 6 (budget), 7 (lifecycle).
2. For each phase listed in the manifest:
   - Run `fabric script run plan-phase-validate {plan_dir}/{phases[i].file} {plan_dir}/{phases[i].brief_file}`.
   - Capture per-phase JSON; aggregate into category 5 (heading set + order, unresolved placeholders, line budget).
3. Load `fabric prompt get plan-checklist` for the 7-category specification.
<!-- /append -->

<!-- append "planner_agent_audit_run_judgment" -->
Categories 2 (interactive questions), 3 (rules coverage), 4 (context completeness) require content reading and judgment. Apply each:

- **Category 2 (Interactive Questions)**: read every brief and phase file. Did the planner identify all interaction points from the kit's source files? Are pre-resolvable + cross-phase questions answered in `plan.toml.decisions` or `plan_dir/decisions.md`? Are phase-bound questions present under each phase's `User Decisions`?
- **Category 3 (Rules Coverage)**: list every `MUST` / `MUST NOT` from the kit's authoritative rules file (path inferable from `plan.kit_path` and `plan.type`). Match each to a phase's `Rules` section. Unmatched rules → FAIL with the rule text and the phase that should have carried it.
- **Category 4 (Context Completeness)**: for each phase, do its brief's Load Instructions name every file the phase reads at runtime? When `plan.input_chunks` is non-empty, is every chunk assigned to at least one phase's `input_files`?

Categories 2-4 cannot be made fully deterministic without kit-specific extraction logic. Cite specific phase numbers / file paths in findings; do NOT issue blanket PASS / FAIL without evidence.
<!-- /append -->

<!-- append "planner_agent_audit_aggregate_and_return" -->
Compose the audit report:

```json
{
  "phase_number": null,
  "phase_file_path": null,
  "intermediate_outputs": [],
  "output_files": [],
  "validation_outcome": "PASS" | "FAIL",
  "audit_findings": {
    "structural": {"status": "PASS|FAIL", "items": [...]},
    "interactive_questions": {"status": "PASS|FAIL", "items": [...]},
    "rules_coverage": {"status": "PASS|FAIL", "items": [...]},
    "context_completeness": {"status": "PASS|FAIL", "items": [...]},
    "phase_independence": {"status": "PASS|FAIL", "items": [...]},
    "budget": {"status": "PASS|FAIL", "items": [...]},
    "lifecycle_handoff": {"status": "PASS|FAIL", "items": [...]}
  },
  "notes": "<short summary>"
}
```

`validation_outcome` is `PASS` only when every category PASSes. A single FAIL anywhere → overall FAIL. Each finding under `items[]` MUST name the affected phase or file path and be specific enough that a reviewer can act on it without re-running the audit.

Read-only enforcement: this mode MUST NOT write any file under `plan_dir`. If you observe yourself drafting a write (`fs.writeFile`, `fabric script run plan-manifest-write` with non-`--dry-run`, etc.), stop and return FAIL with `notes: "audit mode attempted a write — bug in the loaded mode rules"`.
<!-- /append -->
