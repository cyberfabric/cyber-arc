---
id: kit
type: skill
name: kit
description: Route the current fabric kit lifecycle request into the correct kit mode and load the matching rules through fabric
---

<!-- append "routing_input" -->
Use the user's current fabric kit lifecycle request as the routing input. A "kit" is a directory that declares fabric prompts and/or scripts through a `resources.toml` manifest with `prompt_files` and `script_files` globs.
<!-- /append -->

<!-- append "routing_mode_selection" -->
1. Pick the mode that best matches the request and load its rules via the listed command. Do not restate or inline the mode rules — defer to them:

   | Mode        | When to pick                                                                                                                                                   | Load                                 |
   | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
   | `register`  | The user wants to (re)register an existing kit's prompts and scripts so skill entry points and manifest coverage are refreshed, without changing the kit contents. | `fabric prompt get kit-register`     |
<!-- /append -->

<!-- append "routing_clarification" -->
2. If the request does not match any listed mode (for example the user wants to scaffold a new kit or remove a kit), say so explicitly and stop — do not guess a mode. Only dispatch when the request clearly maps to one of the listed modes.
<!-- /append -->

<!-- append "routing_preserve_context" -->
3. Preserve the user's original kit path, kit id, target scope (core / project / global), and any provided `resources.toml` content, prompt files, or script files when handing off to the selected mode.
<!-- /append -->

<!-- append "routing_output" -->
4. Output only the result produced by the selected mode.
<!-- /append -->
