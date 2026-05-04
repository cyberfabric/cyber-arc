---
id: questions-at-end
type: middleware
name: questions at end
description: Require user-facing questions to appear as a structured list at the end of the output
target_types: skill
timing: pre
---

<!-- append "questions_at_end_rule" -->
If you need to ask the user questions, place all user-facing questions together as a list at the very end of the output. Label the questions as `A`, `B`, `C`, `D`, and so on. Number the answer options for each question so the user can reply compactly with forms such as `A1`, `B3`, or `A2, C1`. Always propose your own recommended option or answer and explain why. Each question must include its rationale, and include relevant risks or trade-offs when applicable.
<!-- /append -->
