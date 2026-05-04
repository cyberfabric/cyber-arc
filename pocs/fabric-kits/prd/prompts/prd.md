---
id: prd
type: skill
name: prd
description: Route the current PRD request into the correct PRD mode and load the matching rules through fabric
---

<!-- append "routing_input" -->
Use the user's current PRD-related request as the routing input.
<!-- /append -->

<!-- append "routing_mode_selection" -->
1. Determine which PRD mode best matches the user's request:
   - `brainstorm` when the user wants to explore product intent, users, goals, scope, risks, or open questions before writing a PRD.
   - `generate` when the user wants to create a new PRD or produce a substantial PRD draft.
   - `review` when the user wants to evaluate an existing PRD for structure, completeness, quality, or compliance.
   - `repair` when the user wants to revise an existing PRD based on feedback, violations, or missing sections.
<!-- /append -->

<!-- append "routing_clarification" -->
2. If the intended mode is ambiguous, ask one concise clarification question before continuing.
<!-- /append -->

<!-- append "routing_prompt_loading" -->
3. After choosing the mode, load the matching rules through the fabric tool and follow them exactly:
   - `brainstorm` -> `fabric-poc prompt get prd-brainstorm`
   - `generate` -> `fabric-poc prompt get prd-generate`
   - `review` -> `fabric-poc prompt get prd-review`
   - `repair` -> `fabric-poc prompt get prd-repair`
<!-- /append -->

<!-- append "routing_preserve_context" -->
4. Preserve the user's original domain, constraints, terminology, and any provided document context.
<!-- /append -->

<!-- append "routing_output" -->
5. Output only the result produced by the selected mode.
<!-- /append -->
