---
id: prompt-brainstorm
type: rules
name: prompt brainstorm
description: Decide which fabric prompts to create or extend, choose the right type for each, and push deterministic logic into fabric scripts
---

<!-- append "brainstorm_intro" -->
Use fabric prompt brainstorming mode.
<!-- /append -->

<!-- append "brainstorm_goal" -->
1. The goal of this mode is to reach concrete authoring decisions: which fabric prompts to create, which to extend, which type each must be, which parts belong in a fabric script instead, and how each artifact should be registered.
<!-- /append -->

<!-- append "brainstorm_load_types_catalog" -->
2. Use the shared prompt type catalog from the `authoring-ground-state` baseline as the authoritative source for allowed types, their summaries, and their required frontmatter fields. Never invent a prompt type outside that catalog.
<!-- /append -->

<!-- append "brainstorm_load_existing" -->
3. Use the shared prompt and script inventory from the `authoring-ground-state` baseline to identify related artifacts before proposing anything new:
   - for any prompt that looks related, inspect its fully resolved source so you understand its marker blocks, applied middleware, and current behavior
   - prefer extending an existing prompt (via additional `append`, targeted `insert`, or `replace` blocks in a new overlay file) over creating a duplicate one, and justify the choice
   - prefer reusing an existing script over proposing a new one when the interface fits
<!-- /append -->

<!-- append "brainstorm_ask_clarifications" -->
4. Ask focused clarification questions whenever intent is not unambiguous. Do not silently guess when the answer materially changes the design. Typical areas to clarify:
   - who invokes this prompt (user via slash command, another skill via `fabric prompt get`, middleware auto-applied around matching types)
   - what inputs it consumes and what outputs it must produce
   - which modes it supports if it is a router
   - which existing prompts it complements, replaces, or extends
   - whether it is global, project-local, or both
<!-- /append -->

<!-- append "brainstorm_determinism_first" -->
5. Push deterministic behavior out of prompts and into fabric scripts:
   - any step that is pure computation, transformation, lookup, validation, formatting, or otherwise has a single correct output given fixed inputs is deterministic — it does not belong in a prompt
   - propose a fabric script for each such step and describe it as `fabric script run <id> [args...]`, with a matching `fabric script help <id>` for its interface
   - consult the shared script inventory before proposing anything new; prefer reusing or extending an existing script whose interface already fits
   - keep prompts for judgment, discussion, drafting, challenge, and review — behaviors where an LLM is genuinely required
   - when an existing prompt smells deterministic, recommend extracting that part into a script and having the prompt call the script instead of describing the logic in prose
<!-- /append -->

<!-- append "brainstorm_type_selection" -->
6. For every prompt you propose, pick its type deliberately and justify it against the catalog from step 2:
   - `skill` for things the user invokes directly and that should appear as a `fabric-<id>` agent skill after `fabric register`
   - `rules` for mode-specific bodies loaded by a router skill via `fabric prompt get`
   - `template` for static reusable layouts consumed by another prompt
   - `middleware` for cross-cutting pre/post constraints that wrap a whole set of target types; always declare `target_types` and `timing`
   - `workflow` / `checklist` for structured procedures or checklists loaded as plain prompts
   - `agent` for prompts intended to drive an autonomous agent invocation
<!-- /append -->

<!-- append "brainstorm_router_pattern" -->
7. If the idea involves more than one distinct mode, propose the router pattern explicitly:
   - one `skill` prompt that selects a mode and defers to `fabric prompt get <router>-<mode>`
   - one `rules` prompt per mode, with id `<router>-<mode>`
   - describe each mode and reject merging unrelated modes into a single prompt
<!-- /append -->

<!-- append "brainstorm_register_plan" -->
8. Include a registration plan for each new or changed prompt: state whether it should be registered globally, locally to the current project, or both. See the register-commands middleware appendix for the canonical command set — do not restate it.
<!-- /append -->

<!-- append "brainstorm_output" -->
9. End with a decision summary in these sections:
   - Existing prompts reviewed: `<id>` -> relevance
   - Prompts to create: `<id>`, type, purpose, registration scope
   - Prompts to extend: `<id>`, which block ids to append / insert / replace and why
   - Scripts to create instead of prompts: `<id>`, inputs, output, rationale for determinism
   - Open questions still blocking a decision
<!-- /append -->
