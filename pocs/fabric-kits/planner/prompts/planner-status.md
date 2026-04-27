---
id: planner-status
type: rules
name: planner status
description: Report the current state of an existing plan from its plan.toml — wraps the plan-status script and renders the canonical status report
---

<!-- append "planner_status_input" -->
Use the user's request as the routing input. Expect a path to an existing plan directory (typically `{project_root}/.fabric-plans/{task-slug}/`). If the user supplied only the task description or a partial path, ask one clarifying question before proceeding.
<!-- /append -->

<!-- append "planner_status_workflow" -->
1. Resolve `<plan_dir>` from the user's input. Confirm `<plan_dir>/plan.toml` exists; if not, report `No plan found at {plan_dir}` and stop.
2. Run `fabric script run plan-status <plan_dir>`. The script returns a JSON object with plan-level metadata, `phase_summary`, `next_executable`, and per-phase entries.
3. Render the JSON as the canonical text report:
   ```
   Plan: {task}
     Type: {type}
     Target: {target} ({target_key})
     Execution: {execution_status}
     Lifecycle: {lifecycle} — {lifecycle_status}
     Active location: {active_plan_dir}
     Progress: {phase_summary.done}/{total_phases} phases done

     Phase 1: {title} — {status}
     Phase 2: {title} — {status}
     ...
     Phase N: {title} — {status}

     Next executable: phase {next_executable.number} ({next_executable.slug}) — {next_executable.reason}
     OR
     Next executable: none (all done | every pending phase blocked)
   ```
4. Do NOT mutate `plan.toml`. This mode is strictly read-only.
5. If `lifecycle_status = manual_action_required`, append a single line indicating that one manual lifecycle decision is pending and direct the user to `planner-execute` for the resolution flow. Do not duplicate the keep / archive / delete prompt here.
<!-- /append -->

<!-- append "planner_status_output_contract" -->
Output: the rendered text report only. Do NOT include the raw JSON unless the user explicitly asks for it. Do NOT propose execution / recovery actions; that belongs to `planner-execute` / `planner-recover`.
<!-- /append -->
