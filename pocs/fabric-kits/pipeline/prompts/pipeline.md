---
id: pipeline
type: skill
name: pipeline
description: Generate an orchestration prompt from the current planning request
---

<!-- append "goal" -->
Use the user's current planning request as the planning input.
<!-- /append -->

<!-- append "instructions" -->
1. Invoke the `fabric-observer` skill first to discover which skills and sub-agents are currently available to you in this session.
2. Review the available skills and sub-agents, then select the smallest useful set that can complete the user's task.
3. Before generating the final plan, ask the user for each planned step whether it should be handled in the current chat or delegated to an external agent.
4. If the user chooses delegation for a step, propose the most suitable available sub-agent for that step and ask for confirmation.
5. Do not execute the selected skills.
6. Generate a single orchestration prompt that lists the steps sequentially, in the order they should be used.
7. For steps that stay in the current chat, name the skill to invoke directly.
8. For steps that are delegated, name the chosen sub-agent, explain briefly why it fits the step, and use the matching `claude` or `codex` skill to generate the correct shell command for that step when applicable.
9. If a delegated step needs elevated permissions or relaxed approvals, require explicit user authorization before including dangerous flags in the generated command.
10. The orchestration prompt must preserve the user's original goal and constraints.
11. If one part of the task cannot be mapped to an available skill or sub-agent, state that explicitly inside the orchestration prompt.
12. Output only the final orchestration prompt.
<!-- /append -->
