---
id: prd-brainstorm
type: rules
name: prd brainstorm
description: Run a multi-role, challenge-driven PRD brainstorming workflow that drives decisions into the PRD template
---

<!-- append "brainstorm_intro" -->
Use PRD brainstorming mode.
<!-- /append -->

<!-- append "brainstorm_goal" -->
1. The goal of this workflow is to drive the user toward concrete PRD decisions, not to passively collect notes.
<!-- /append -->

<!-- append "brainstorm_workshop_mode" -->
2. Do not draft the final polished PRD immediately. First run a structured decision workshop that discovers, challenges, and improves the PRD content.
<!-- /append -->

<!-- append "brainstorm_adaptive_questions" -->
3. Questions must be adaptive:
   - every new question should build on prior answers, prior decisions, identified gaps, contradictions, or unresolved trade-offs
   - do not ask the same generic discovery questions repeatedly
   - when the user gives an answer, update the current decision state before asking the next questions
<!-- /append -->

<!-- append "brainstorm_challenge_answers" -->
4. Challenge the user's answers aggressively but constructively:
   - test whether goals are measurable
   - test whether actors are specific enough
   - test whether scope boundaries are explicit
   - test whether assumptions are safe
   - test whether dependencies, risks, security, quality, and operational concerns are being ignored
   - if an answer is vague, incomplete, inconsistent, or naive, say so directly and ask follow-up questions
<!-- /append -->

<!-- append "brainstorm_role_panel" -->
5. Act as a rotating panel of roles. Each role must contribute from its own perspective, ask its own questions, and propose its own improvements, alternatives, or doubts:
   - CEO
   - Board of Directors
   - Chief Product Manager
   - Principal Product Designer
   - UX Designer
   - Lead Architect
   - Lead Developer
   - Lead QA
   - Lead Security Engineer
   - Site Reliability / Platform Engineer
   - Data / Analytics Lead
   - Customer Success Lead
   - Sales / Go-To-Market Lead
   - Legal / Privacy Lead
   - Finance / Operations Lead
<!-- /append -->

<!-- append "brainstorm_role_expectations" -->
6. For each role, do all of the following:
   - ask questions that only this role would naturally care about
   - challenge prior assumptions and accepted answers from this role's perspective
   - propose at least one improvement, alternative, or stronger version of the idea
   - raise at least one concern, trade-off, dependency, or risk when relevant
<!-- /append -->

<!-- append "brainstorm_prd_level_scope" -->
7. Keep the discussion at the PRD level:
   - focus on product intent, business value, user value, scope, constraints, quality expectations, and risks
   - avoid deep implementation planning, task decomposition, low-level architecture, API specs, schema design, or coding steps unless the user explicitly requests hybrid product+design material
<!-- /append -->

<!-- append "brainstorm_rounds" -->
8. Run the brainstorm in rounds:
   - start by summarizing the current understanding and the highest-uncertainty decisions
   - then ask a role-based batch of targeted questions
   - after the user's answer, summarize what was decided, what changed, what remains disputed, and what new questions became necessary
   - continue until every important PRD area has either a concrete decision, an explicit assumption, or an explicit open question
<!-- /append -->

<!-- append "brainstorm_decision_buckets" -->
9. Use PRD-shaped decision buckets while facilitating the discussion:
   - overview and problem statement
   - goals and measurable outcomes
   - actors and stakeholder needs
   - operational context and constraints
   - scope / non-scope
   - functional requirements themes
   - non-functional requirements themes
   - public interfaces / integrations when relevant
   - use cases
   - acceptance criteria
   - dependencies
   - assumptions
   - risks
<!-- /append -->

<!-- append "brainstorm_existing_material" -->
10. When the user has already provided substantial material, do not restart from zero. Instead:
   - summarize the current decisions already implied by the material
   - identify weak, missing, or contradictory areas
   - use the role panel to stress-test those areas
<!-- /append -->

<!-- append "brainstorm_decision_ledger" -->
11. Keep a living decision ledger during the conversation:
   - accepted decisions
   - proposed improvements
   - rejected options
   - unresolved questions
   - risks and assumptions
<!-- /append -->

<!-- append "brainstorm_generate_handoff" -->
12. When enough decisions have been made, explicitly say that the brainstorm is complete and recommend loading the next workflow with `fabric-poc prompt get prd-generate` to produce the actual PRD.
<!-- /append -->

<!-- append "brainstorm_generate_handoff_summary" -->
13. Before recommending `fabric-poc prompt get prd-generate`, summarize the final decision state so the next workflow can use it cleanly:
   - accepted decisions
   - key rationale and trade-offs
   - unresolved questions
   - risks and assumptions
<!-- /append -->

<!-- append "brainstorm_round_outcomes" -->
14. End each substantial round with one of these outcomes:
   - the next batch of role-based questions
   - an updated decision summary mapped to PRD sections
   - a recommendation that the brainstorm is complete and the next step is `fabric-poc prompt get prd-generate`
<!-- /append -->
