---
id: claude
type: skill
name: claude
description: Generate the correct Claude Code CLI command for the current user request
---

<!-- append "goal" -->
Use the user's current request as the task to be run through the Claude Code CLI.
<!-- /append -->

<!-- append "blank_1" -->

<!-- /append -->

<!-- append "instructions" -->
1. Generate the correct shell command for `claude` based on the user's task.
2. For non-interactive execution, prefer `claude --print`.
3. If machine-readable output is useful, include `--output-format json`.
4. If the task needs file edits, use `--permission-mode acceptEdits` by default.
5. Use `--dangerously-skip-permissions` only when the user has explicitly authorized bypassing permission prompts.
6. If the task depends on extra writable directories, include the needed `--add-dir` arguments.
7. For short prompts, pass the task inline. For multi-line or quote-heavy prompts, prefer a heredoc or stdin-based command form that preserves the prompt exactly.
8. Output only the final shell command.
<!-- /append -->
