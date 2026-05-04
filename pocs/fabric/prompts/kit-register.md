---
id: kit-register
type: rules
name: kit register
description: Register an existing fabric-poc kit so its prompts and scripts are discoverable and skill entry points are refreshed, without modifying kit contents
---

<!-- append "kit_register_scope" -->
Use fabric-poc kit registration mode. The kit already exists on disk and its contents must not change — only registry coverage and skill entry points are refreshed. If the user asks to scaffold a new kit, add new prompts/scripts, or delete a kit, stop and tell them this mode does not apply.
<!-- /append -->

<!-- append "kit_register_inputs" -->
1. Resolve the concrete registration inputs before touching the registry:
   - the kit path — an absolute or cwd-relative directory containing a `resources.toml` manifest
   - the target scope — one of: default fabric targets, project-local (`--local`), global surfacing (`--include-global`), both scopes (`--local --include-global`), or a specific kit folder passed as a positional path to `fabric-poc register`
   - the kit id for confirmation — derived from the kit's directory name unless the user specifies otherwise
   If any of these is ambiguous, ask one short clarification question before continuing.
<!-- /append -->

<!-- append "kit_register_preflight" -->
2. Run the deterministic preflight before registering. Do not register a kit with unresolved CRITICAL or HIGH findings.
   - `fabric-poc script run prompt-kit-lint <kit-path>` — cross-file defects: duplicate ids, registry collisions, orphan `target_prompts`, orphan `fabric-poc prompt get` / `fabric-poc script run` body references, missing `prompt_files` / `script_files` keys for populated directories, and physical files outside declared globs
   - `fabric-poc script run prompt-audit <kit-path>` — per-file lint plus coverage cross-check for every declared prompt and script
   - Treat every CRITICAL and HIGH finding from either script as a blocker; report them to the user and stop. Route fixes through `fabric-poc prompt get prompt-repair` (for prompts) or `fabric-poc prompt get prompt-script` → repair (for scripts). Do not mutate kit files in this mode.
<!-- /append -->

<!-- append "kit_register_command_selection" -->
3. Pick the registration command that matches the declared scope. Use the canonical forms from the register-commands middleware:
   - default fabric targets → `fabric-poc register`
   - project-local only → `fabric-poc register --local`
   - also surface globally registered prompts → `fabric-poc register --include-global`
   - both scopes → `fabric-poc register --local --include-global`
   - a kit folder outside the active manifests → `fabric-poc register <kit-path> [--local] [--include-global]`
   Prefer the narrowest scope that satisfies the user's request; do not silently add `--include-global` or `--local` if the user did not ask for them.
<!-- /append -->

<!-- append "kit_register_execute_and_verify" -->
4. Execute the chosen command, then verify the registration deterministically:
   - `fabric-poc prompt list` — every `skill`-typed prompt declared by the kit appears with the expected id, name, and description
   - `fabric-poc script list` — every script declared by the kit appears with the expected id
   - For each `skill`-typed prompt id `<id>`, confirm the generated entry points exist on disk: `.claude/skills/<id>/` and `.agents/skills/<id>/` under the active fabric home (or the project root for `--local`)
   - For non-`skill` prompt types (`rules`, `template`, `middleware`, `workflow`, `checklist`, `agent`) and for scripts, do not expect new entry points — `fabric-poc register` only refreshes manifest coverage for these; confirmation is that `fabric-poc prompt list` / `fabric-poc script list` surface them
<!-- /append -->

<!-- append "kit_register_output" -->
5. Report back with:
   - the exact `fabric-poc register` command that was run
   - a short table of the skills that were (re)generated, the non-skill prompts whose coverage was refreshed, and the scripts whose coverage was refreshed
   - any findings from `prompt-kit-lint` or `prompt-audit` that were resolved as part of the preflight, or the blockers that caused registration to be skipped
   - explicit next steps if the kit declares `skill` routers whose mode `rules` files are missing (router dispatch will fail until those files exist)
<!-- /append -->
