---
id: planner-execute
type: rules
name: planner execute
description: Load the next executable phase from an existing plan.toml, dispatch sub-agents per the brief or run inline, validate the result, update phase status, and emit the next-phase handoff prompt
---

<!-- append "planner_execute_input" -->
Use the user's request as the routing input. Expect a path to an existing plan directory whose `plan.toml` is valid (use `planner-review` first if the plan was hand-edited). The runner advances exactly one phase per invocation.

Companion rules to load: `fabric prompt get planner-subagent-protocol` (always — the protocol governs both dispatch and inline post-validation).
<!-- /append -->

<!-- append "planner_execute_load_next_phase" -->
1. Run `fabric script run plan-status <plan_dir>`. Read `next_executable` from the JSON.
2. If `next_executable` is null:
   - If `phase_summary.done = total_phases`, jump to the final-phase / lifecycle handling section (`planner_execute_final_phase_lifecycle`).
   - Otherwise the plan is blocked (failed phase, dependency chain broken, lifecycle mis-set). Stop and recommend `planner-recover` to audit and repair. Do NOT advance.
3. Otherwise read the phase file from disk at `{plan_dir}/{next_executable.file}` (resolve `file` from the `plan-status` `phases[]` entry whose `number` matches). Read the corresponding brief at `{plan_dir}/{next_executable.brief_file}`.
4. Re-run `fabric script run plan-phase-validate <phase_file> <brief_file>` and confirm `overall = "PASS"` before proceeding. If FAIL, stop and recommend rebuilding this phase via `planner-generate` (or hand-editing followed by `planner-review`).
5. Update the phase status in `plan.toml` to `in_progress` and recompute `plan.execution_status`. Use TOML round-trip via `@iarna/toml` (parse → mutate → stringify) — do NOT hand-edit the manifest.
<!-- /append -->

<!-- append "planner_execute_dispatch_or_inline" -->
Decide dispatch path per the phase's `subagents_dispatched` field in the manifest:

**If `subagents_dispatched` is non-empty (default for any phase whose brief listed sub-agents)**:
- For each entry, build the sub-agent input per `planner-subagent-protocol L2 input contract`: context boundary line + the brief content read from disk + a one-line task statement (`execute this phase per its Task section and report`).
- Send the input to the named sub-agent via the integration declared by that sub-agent (Claude Code Task tool, IDE agent, etc.).
- Await the structured return per `planner-subagent-protocol L3 return contract`.
- Verify the return per `planner-subagent-protocol L4 parent verification`. On any verification failure, mark the phase `failed` with the failing check named, and stop.
- For multiple sub-agents on the same phase, dispatch sequentially unless their `intermediate_outputs` are guaranteed disjoint (rare in execute mode — see `planner-subagent-protocol L5 parallel fan-out`).

**If `subagents_dispatched` is empty (inline or default-agent fallback)**:
- **Preferred fallback** when `fabric-planner-agent` is registered: dispatch to it with payload `mode: execute, plan_dir: <abs>, phase_number: <N>, phase_file: <name>` so the phase runs in an isolated context with the canonical `planner-agent-execute` discipline. This is materially safer than inline for non-trivial phases since it enforces the Context Boundary by construction.
- **Inline** when no agent infrastructure is available, or when the phase is trivial enough that the isolation overhead is wasted:
  - Load every entry in `skills_loaded` (`role = companion`) via `fabric prompt get {id}`.
  - Read every file listed in `input_files` and `inputs` and retain only the section ranges named in the brief.
  - Follow the phase file's `Task` section step by step. For every step that maps to a fabric script, invoke it. For every step that requires judgment, apply the loaded companion methodology.
  - After producing the declared `output_files` and `outputs`, verify each artifact exists on disk before claiming success — same Acceptance Criteria as the dispatch path.

**No third execution path**: the planner does NOT delegate to ralphex or any external runner. The dispatch / inline paths above are the entire surface.
<!-- /append -->

<!-- append "planner_execute_status_update" -->
After the phase completes (whether via dispatch or inline):

1. Re-verify every `output_files` and `outputs` path from the brief exists on disk.
2. Run the phase's Acceptance Criteria checks. Every checkbox in `Acceptance Criteria` MUST observably hold.
3. If all pass: set `phases[i].status = "done"` in `plan.toml` and recompute `plan.execution_status`:
   - all phases `done` → `done`
   - any failed → `failed`
   - mix of `done` / `in_progress` / `pending` → `in_progress`
   - all pending → `not_started` (won't happen post-execution but defensive)
4. If any acceptance criterion fails: set `phases[i].status = "failed"`, record the reason in a brief commentary, and stop. Recommend `planner-recover` if the plan should be retried.
5. Persist the updated `plan.toml` via `@iarna/toml` round-trip.
<!-- /append -->

<!-- append "planner_execute_handoff" -->
On phase completion (success path), emit a one-screen status block + the next-phase prompt for the user (or downstream chat):

```
Phase {N}/{M}: done

Files written:
  - {output_files entries}
  - {outputs entries}

Next phase prompt (copy-paste into a new chat for guaranteed clean context):
```
Then a single fenced code block containing:
```
I have a fabric plan at:
  {plan_dir}/plan.toml

Phase {N} is complete (done).
Please read the plan manifest, confirm the next executable phase, and execute it.
The expected next phase file is: {plan_dir}/phase-{NN+1}-{slug}.md
The phase file is self-contained — follow its instructions exactly.
After completion, report results and generate the prompt for Phase {N+2}.
```

End with one prompt:
```
Continue in this chat? [y] re-enter from plan.toml here | [n] copy prompt above to new chat
(Recommended: new chat for guaranteed clean context, especially after a long session)
```

If the user picks `y`, re-enter `planner-execute` from step 1 (`plan-status`) — do NOT trust chat memory about which phase is next, the manifest on disk is the only source of truth.
<!-- /append -->

<!-- append "planner_execute_final_phase_lifecycle" -->
When all delivery phases are `done`:

1. Set `plan.execution_status = "done"`.
2. Apply lifecycle handling exactly once, per `plan.lifecycle`:
   - **`gitignore`**: `lifecycle_status` should already be `done`. No further action.
   - **`cleanup`**: the reserved Cleanup phase is now `next_executable` (its `kind = "lifecycle"`). Execute it like any other phase via this same dispatch / inline flow. When Cleanup succeeds, set `lifecycle_status = "done"`. The brief / phase / out file removals are intentional and `planner-recover` exempts them.
   - **`archive`**: set `lifecycle_status = "ready"`, move `plan_dir` to `{project_root}/.fabric-plans/.archive/{task-slug}/`, update `active_plan_dir` and `lifecycle_status = "done"` in the moved manifest.
   - **`manual`**: set `lifecycle_status = "manual_action_required"` and present a single one-shot prompt:
     ```
     Plan execution complete. Manual lifecycle selected. What should happen to the plan files?
       [1] Keep — leave plan files for reference and set lifecycle_status = "done"
       [2] Archive — move to .fabric-plans/.archive/ and set lifecycle_status = "done"
       [3] Delete — remove the plan directory; no further manifest status remains on disk
     ```
3. Emit the completion summary:
   ```
   ═══════════════════════════════════════════════
   ALL PHASES COMPLETE ({M}/{M})
   ───────────────────────────────────────────────
   Plan: {plan_dir}/plan.toml
   Target: {target}
   Phases completed: {M}
   Execution status: done
   Lifecycle: {lifecycle} — {lifecycle_status}
   ═══════════════════════════════════════════════
   ```
4. Optionally offer post-completion follow-up (semantic review of the produced artifact via the kit's review skill if one exists). Do NOT auto-run it.
<!-- /append -->
