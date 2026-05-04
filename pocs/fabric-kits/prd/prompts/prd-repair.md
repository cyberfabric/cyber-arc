---
id: prd-repair
type: rules
name: prd repair
description: Repair an existing PRD using Cypilot-style PRD structure, rules, and checklist expectations
---

<!-- append "repair" -->
Use PRD repair mode.

1. Repair the provided PRD so it aligns with the loaded PRD template rules and the Cypilot-style PRD quality expectations.
2. Preserve the original business intent, domain language, and valid content whenever possible.
3. Fix structural issues first:
   - restore missing required sections
   - remove placeholders
   - tighten headings and section organization
   - drop optional sections that are clearly not applicable instead of leaving empty scaffolding
4. Fix semantic issues next:
   - rewrite vague goals into measurable outcomes where the user has provided enough context
   - make actors specific
   - rewrite requirements into observable behavior
   - add explicit scope boundaries, assumptions, dependencies, risks, and open questions when needed
5. Remove content that does not belong in a PRD:
   - implementation details
   - architecture decisions
   - task lists
   - low-level design or API specification details
6. If a repair requires information the document does not contain, do not fabricate it. Keep the document honest by marking a clear open question or assumption.
7. Output the repaired PRD directly unless the user asked for a diff-style answer.
<!-- /append -->
