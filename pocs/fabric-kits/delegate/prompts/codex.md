---
id: codex
type: skill
name: codex
description: Generate the correct Codex CLI command for the current user request
---

<!-- append "goal" -->
Use the user's current request as the task to be run through the Codex CLI.
<!-- /append -->

<!-- append "blank_1" -->

<!-- /append -->

<!-- append "instructions" -->
1. Generate the correct shell command for `codex` based on the user's task.
2. For non-interactive execution, prefer `codex exec`.
3. If a working directory is relevant, include `-C <dir>`.
4. For machine-readable output, include `--json`.
5. If the task writes files or runs commands, prefer explicit approval/sandbox flags appropriate to the task.
6. Use `--dangerously-bypass-approvals-and-sandbox` only when the user has explicitly authorized bypassing approvals and sandboxing.
7. For prompts that are long or contain complex quoting, prefer a heredoc or stdin-based command form that preserves the prompt exactly.
8. Output only the final shell command.
<!-- /append -->
