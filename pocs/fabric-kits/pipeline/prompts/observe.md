---
id: observe
type: skill
name: observer
description: Discover the skills and sub-agents available in the current session
---

<!-- append "goal" -->
Determine which skills and sub-agents are currently available to you in this session.
<!-- /append -->

<!-- append "constraints" -->
1. Do not inspect repository files, `SKILL.md`, plugin manifests, or marketplace files to answer this.
2. Use only the skills and sub-agents that are actually available to you right now in the current agent session.
<!-- /append -->

<!-- append "skill_fields" -->
3. For each available skill, extract:
   - the skill name
   - the description
   - the invocation form or interface
   - the mode or operating style if known
<!-- /append -->

<!-- append "subagent_fields" -->
4. For each available sub-agent, extract:
   - the sub-agent name
   - the description or specialization
   - the invocation form or interface
   - the mode or operating style if known
<!-- /append -->

<!-- append "output" -->
5. Produce the final result as two markdown tables: one with columns `Skill`, `Description`, `Interfaces`, `Modes`, and one with columns `Sub-agent`, `Description`, `Interfaces`, `Modes`.
6. If any field cannot be determined from the currently available skills or sub-agents, write `unknown`.
<!-- /append -->
