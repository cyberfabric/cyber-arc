---
id: planner-recover
type: rules
name: planner recover
description: Audit an abandoned or partially completed plan, repair manifest / lifecycle state, and resume from the earliest executable phase — wraps the plan-resume script
---

<!-- append "planner_recover_input" -->
Use the user's request as the routing input. Expect a path to an existing plan directory whose execution was interrupted, whose phase artifacts may have been deleted, or whose `lifecycle_status` is stuck in `manual_action_required` / `in_progress`.
<!-- /append -->

<!-- append "planner_recover_workflow" -->
1. Resolve `<plan_dir>`. Confirm `<plan_dir>/plan.toml` exists.
2. Run `fabric-poc script run plan-resume <plan_dir>` (read-only by default). The script:
   - Audits every phase marked `done` against on-disk presence of its brief, phase file, and intermediate `outputs`.
   - Lists the cascade of phases that need to be reopened (transitively, through `depends_on`).
   - Recommends a `lifecycle_repair` when work is reopened (resets `lifecycle_status` to `pending` for all lifecycles except `gitignore`).
   - Computes the projected `execution_status`.
   - Identifies the earliest executable phase after the audit.
3. Present the audit report to the user. Format:
   ```
   Recovery audit: {plan_dir}
     Audit findings: {N}
       phase {p}: {issue} at {path}
       ...
     Phases to reopen: [{1, 3, ...}]
     Lifecycle repair: {from} → {to} ({reason}) | none
     Next executable after recovery: phase {N} ({slug}) | none
   ```
4. If `audit_findings` is empty AND `phases_to_reopen` is empty AND `lifecycle_repair` is null, report `Plan is consistent — no recovery actions needed.` and stop. Direct the user to `planner-execute` for normal continuation.
5. Otherwise, ask:
   ```
   Apply recovery and rewrite plan.toml? [y/n]
   ```
6. On `y`, run `fabric-poc script run plan-resume <plan_dir> --apply` and re-run `fabric-poc script run plan-status <plan_dir>` to confirm the post-recovery state. On `n`, stop without mutating anything.
<!-- /append -->

<!-- append "planner_recover_cleanup_exemption" -->
When `lifecycle = "cleanup"` and `lifecycle_status = "done"`, the absence of `brief-*`, `phase-*`, and `out/` files is intentional — the Cleanup phase removed them. `plan-resume` already exempts this case (`cleanup_exempt: true` in the audit output). Do NOT propose reopening delivery phases solely because their files are gone under this lifecycle.

If the user insists on re-running phases after a cleanup-completed plan, recommend creating a new plan instead of reopening the terminated one — the original raw inputs may have changed and the original artifact may diverge.
<!-- /append -->

<!-- append "planner_recover_output_contract" -->
Output: the audit report, the explicit user gate, and either the post-apply confirmation or a clean stop message. Do NOT execute phases — that belongs to `planner-execute`. Do NOT propose alternative execution targets like `ralphex` — the planner's only execution paths are sub-agent dispatch and inline.
<!-- /append -->
