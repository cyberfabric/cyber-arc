---
id: authoring-output-contract
type: middleware
name: authoring output contract
description: Shared post-write / registration / follow-up rules for prompt-authoring modes that produce or modify files
target_types: rules
target_prompts: prompt-generate, prompt-repair, prompt-script
timing: post
---

<!-- append "authoring_output_contract_rule" -->
Shared output contract for authoring modes that produce or modify files on disk. Every mode below applies these rules; each mode may add a short mode-specific delta in its own `Output contract` block but MUST NOT restate the shared rules:

1. Write the new or modified file directly to its target path using the invoker's file-writing tools; then print a short confirmation with the path(s) written.
2. If the invoker cannot write files in this environment, print the full file content verbatim, clearly labeled with the target path so the user can paste it.
3. Print the registration command that applies ONLY when registration would change registry state — a newly created file that still needs to be covered by a manifest glob, a coverage glob change, or a `skill`-typed prompt whose entry points need regeneration. See the register-commands middleware appendix for the canonical command set; do not restate the commands.
4. `fabric-poc register` ONLY generates skill entry points (CLI / agent skills) for prompts whose `type` is `skill`. See `pocs/fabric/src/register.js` `isRegistrablePromptType`. For `rules`, `template`, `middleware`, `workflow`, `checklist`, and `agent` prompts — and for fabric scripts — `fabric-poc register` only refreshes manifest coverage; it does not produce a slash command, agent binary, or any generated artifact. Do not promise "running `fabric-poc register` will create a skill for this" unless the authored file is a `skill` prompt.
5. List any follow-up scripts or prompts still to be authored, each with an id and a one-line purpose.
<!-- /append -->
