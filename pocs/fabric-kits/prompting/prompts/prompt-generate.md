---
id: prompt-generate
type: rules
name: prompt generate
description: Generate a valid fabric-poc prompt markdown file (frontmatter plus marker blocks) and the matching registration command
---

<!-- append "generate_intro" -->
Use fabric-poc prompt generation mode.
<!-- /append -->

<!-- append "generate_ground_state" -->
1. Anchor on the generate-specific side of fabric state: confirm the proposed `id` is unused when CREATE, and pull the existing block layout with `fabric-poc prompt source <id>` when EXTEND. The shared `fabric-poc prompt types` / `fabric-poc prompt list` / `fabric-poc script list` baseline is injected by the `authoring-ground-state` middleware — do not restate it here.
<!-- /append -->

<!-- append "generate_scaffold_via_script" -->
2. Emit the skeleton deterministically via fabric-poc script instead of writing frontmatter and marker syntax by hand:
   - run `fabric-poc script run prompt-scaffold --id <kebab-id> --type <type> --name <name> --description <description> [--target-types <csv>] [--target-prompts <csv>] [--timing pre|post] [--blocks <csv>]` to produce a valid starter skeleton
   - use `--target-prompts` to narrow a middleware to specific prompt ids; use `fabric-poc script help prompt-scaffold` when you need the full parameter list or examples
   - fill the generated `TODO: body for <block_id>` placeholders with the real body content; do not alter the frontmatter layout or rename generated block ids unless you have a reason
<!-- /append -->

<!-- append "generate_type_rules" -->
3. Honor the constraints of the chosen type when filling the body:
   - `skill`: write the body as direct instructions to the invoker; state inputs, behavior, and output format; for routers, limit the body to mode selection, delegation via `fabric-poc prompt get <router>-<mode>`, and context preservation
   - `rules`: write mode-specific rules loaded by a router skill; do not include routing logic
   - `template`: write only the template content consumed by another prompt
   - `middleware`: keep the body short and narrowly scoped; frontmatter fields are already set by `prompt-scaffold`; use `--target-prompts <csv>` when the middleware should apply only to a named subset of prompts instead of every prompt matching `target_types`
   - `workflow` / `checklist`: write concrete ordered steps or verifiable items
   - `agent`: describe the agent role and the expected invocation interface
<!-- /append -->

<!-- append "generate_router_pattern" -->
4. When generating a router skill together with its mode rules:
   - the router is a `skill` whose body selects a mode and instructs the caller to run `fabric-poc prompt get <router>-<mode>`
   - each mode file is a `rules` prompt whose id is `<router>-<mode>`
   - keep mode-specific content out of the router and routing logic out of the mode files
<!-- /append -->

<!-- append "generate_delegate_to_scripts" -->
5. Offload deterministic work to fabric scripts instead of inlining it in the prompt body:
   - if the generated prompt needs a lookup, list, transformation, validation, or anything with a single correct output given fixed inputs, instruct the caller to run `fabric-poc script run <id> [args...]`, and use `fabric-poc script help <id>` to expose its interface
   - if the required script does not yet exist, emit an explicit follow-up item naming the script id, inputs, and expected output so it can be created before the prompt is registered; confirm via `fabric-poc script list` whether a matching script is already available before proposing a new one
<!-- /append -->

<!-- append "generate_file_location" -->
6. Place the generated file according to its registration scope and verify coverage deterministically:
   - for a core fabric-poc prompt, put it in the fabric core prompts directory
   - for a kit-scoped prompt, place it under the target kit's `prompts/` directory
   - for a project-local prompt, place it under the directory referenced by the project's local `.fabric/resources.toml`
   - after choosing the path, run `fabric-poc script run prompt-register-dryrun <path>` to confirm the file is covered by an active `prompt_files` glob; if `covered` is `false`, do not register yet — extend the appropriate manifest or choose a different directory first
<!-- /append -->

<!-- append "generate_lint_before_register" -->
7. Before registering, lint the generated file deterministically:
   - run `fabric-poc script run prompt-lint <path>` and fix any CRITICAL or HIGH finding it reports
   - only proceed once `findings` is empty
<!-- /append -->

<!-- append "generate_output" -->
8. Output contract — follow the shared rules injected by the `authoring-output-contract` middleware below. This mode adds no extra output rules; the generated artifact is a markdown prompt file whose registration behavior (skill → skill entry point; everything else → manifest coverage only) is already covered by the shared contract.
<!-- /append -->
