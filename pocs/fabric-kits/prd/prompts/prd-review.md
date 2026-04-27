---
id: prd-review
type: rules
name: prd review
description: Review an existing PRD against Cypilot-style PRD structure, rules, and checklist expectations
---

<!-- append "review" -->
Use PRD review mode.

1. Review the provided PRD against both:
   - the loaded PRD template rules for structural expectations
   - the Cypilot-style PRD quality expectations reflected here
2. Check structure first:
   - required sections present when applicable
   - optional sections either meaningfully filled or intentionally omitted
   - no placeholder content such as TODO, TBD, or FIXME
   - clear markdown structure and navigability
3. Check semantic quality:
   - purpose is concise and problem-oriented
   - background explains current pain points
   - goals are measurable
   - actors are specific and have clear needs or roles
   - functional requirements are observable and testable
   - non-goals and out-of-scope boundaries are explicit
   - NFRs are measurable when present
   - use cases cover meaningful user journeys when needed
   - assumptions, dependencies, and risks are stated when relevant
4. Check deliberate omissions:
   - no technical implementation details in the PRD
   - no architectural decisions
   - no implementation task list
   - no spec-level design, schema definitions, or API details unless the user intentionally wants a hybrid document
5. Never skip a concern silently. If a criterion does not apply, say why it is not applicable.
6. Report findings with severity using `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.
7. For each finding, include:
   - the affected section
   - the problem
   - why it matters
   - a concrete repair recommendation
8. Finish with a short overall assessment of readiness.
<!-- /append -->
