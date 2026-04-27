---
id: prompt
type: skill
name: prompt
description: Route fabric prompt and script authoring: brainstorm, generate, review, repair, or script
---

<!-- append "routing_input" -->
Use the user's current fabric prompt authoring request as the routing input.
<!-- /append -->

<!-- append "routing_mode_dispatch" -->
1. Pick the mode that best matches the request and load its rules via the listed command. Do not restate or inline the mode rules — defer to them:

   | Mode        | When to pick                                                                                                                             | Load                                        |
   | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
   | `brainstorm`| Explore which prompts or prompt types are needed, clarify intent, or decide between new / extend / script.                               | `fabric prompt get prompt-brainstorm`       |
   | `generate`  | Create a new prompt file or materially extend an existing one.                                                                           | `fabric prompt get prompt-generate`         |
   | `review`    | Evaluate an existing prompt file for structural, typing, or content quality.                                                             | `fabric prompt get prompt-review`           |
   | `repair`    | Apply fixes to an existing prompt file against review findings or type / determinism / router contracts.                                 | `fabric prompt get prompt-repair`           |
   | `script`    | Author a fabric script (JS module exporting `id`/`name`/`description`/`interface`/`run`) or materially extend an existing one.            | `fabric prompt get prompt-script`           |
<!-- /append -->

<!-- append "routing_clarification" -->
2. If the intended mode is genuinely ambiguous, ask at most one short clarification question (per the questions-at-end middleware format) before dispatching. If the request is only slightly ambiguous, pick the most likely mode and note the assumption.
<!-- /append -->

<!-- append "routing_preserve_context" -->
3. Preserve the user's original domain, constraints, terminology, and any provided prompt files or references when handing off to the selected mode.
<!-- /append -->

<!-- append "routing_output" -->
4. Output only the result produced by the selected mode.
<!-- /append -->
