---
id: planner
type: skill
name: planner
description: Route the current planning request into the correct planner mode and load the matching rules through fabric
---

<!-- append "routing_input" -->
Use the user's current planning request as the routing input.
<!-- /append -->

<!-- append "routing_mode_selection" -->
1. Pick the mode that best matches the request and load its rules via the listed command. Do not restate or inline the mode rules — defer to them:

   | Mode         | When to pick                                                                                                                              | Load                                       |
   | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
   | `brainstorm` | Decide task type, decomposition strategy, lifecycle, and which available skills / sub-agents to integrate per phase before any plan files exist. | `fabric prompt get planner-brainstorm`     |
   | `generate`   | Produce `plan.toml`, all `brief-*` files, and all `phase-*` files for a task whose decomposition is decided.                              | `fabric prompt get planner-generate`       |
   | `execute`    | Load and run the next executable phase from an existing `plan.toml` (sub-agent dispatch by default; inline fallback).                     | `fabric prompt get planner-execute`        |
   | `status`     | Report the current state of an existing plan from its `plan.toml`.                                                                        | `fabric prompt get planner-status`         |
   | `recover`    | Audit an abandoned or partially completed plan, repair manifest / lifecycle state, and resume from the earliest executable phase.         | `fabric prompt get planner-recover`        |
   | `review`     | Re-validate an existing plan after edits against `plan-checklist`.                                                                        | `fabric prompt get planner-review`         |
<!-- /append -->

<!-- append "routing_clarification" -->
2. If the intended mode is genuinely ambiguous, ask at most one short clarification question (per the questions-at-end middleware format) before dispatching. If the request is only slightly ambiguous, pick the most likely mode and note the assumption.
<!-- /append -->

<!-- append "routing_prompt_loading" -->
3. After choosing the mode, load the matching rules through the fabric tool and follow them exactly. Do not perform any planning, decomposition, compilation, execution, status, recovery, or review work in this router — the chosen mode owns it.
<!-- /append -->

<!-- append "routing_preserve_context" -->
4. Preserve the user's original task description, constraints, terminology, and any provided file paths or references when handing off to the selected mode. If the user supplied raw input that may exceed normal context limits, preserve it as-is for the mode rules to materialize.
<!-- /append -->

<!-- append "routing_output" -->
5. Output only the result produced by the selected mode.
<!-- /append -->
