---
id: register-commands
type: middleware
name: register commands
description: Inject the canonical fabric register command reference into the prompt-authoring rules
target_types: rules
target_prompts: prompt-brainstorm, prompt-generate, prompt-review, prompt-script, prompt-repair
timing: post
---

<!-- append "register_commands_reference" -->
When a prompt or script has just been authored or edited and needs to be registered, use the canonical fabric register commands rather than restating them:
- `fabric register` — refresh the default registry targets
- `fabric register --local` — register into the current project only
- `fabric register --include-global` — also surface globally registered prompts
- `fabric register --local --include-global` — both scopes together
- `fabric register <path> [--local] [--include-global]` — register a kit folder at `<path>`
<!-- /append -->
