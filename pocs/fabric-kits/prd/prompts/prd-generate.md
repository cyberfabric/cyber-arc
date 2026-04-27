---
id: prd-generate
type: rules
name: prd generate
description: Generate a PRD draft aligned with Cypilot-style PRD rules and checklist expectations
---

<!-- append "generate_intro" -->
Use PRD generation mode.
<!-- /append -->

<!-- append "generate_load_template" -->
1. First load the PRD template with `fabric prompt get prd-template` and use that template structure for the generated document.
<!-- /append -->

<!-- append "generate_produce_draft" -->
2. Produce a substantial PRD draft that follows the loaded PRD template.
<!-- /append -->

<!-- append "generate_requirements_level" -->
3. Write at the requirements level:
   - describe what the product must do and why it matters
   - avoid implementation details, architecture decisions, API specs, schema definitions, infrastructure specs, and task lists
<!-- /append -->

<!-- append "generate_concrete_reviewable" -->
4. Make the document concrete and reviewable:
   - purpose should stay concise
   - background should explain the current state and pain points
   - goals should be measurable
   - actors should be specific roles, not vague groups
   - requirements should use observable language such as MUST, MUST NOT, or SHOULD
<!-- /append -->

<!-- append "generate_functional_requirements" -->
5. For each functional requirement, include:
   - rationale or business value
   - actor linkage when known
<!-- /append -->

<!-- append "generate_non_functional_requirements" -->
6. Include non-functional requirements only when they are relevant and measurable.
<!-- /append -->

<!-- append "generate_supporting_sections" -->
7. Include use cases, dependencies, assumptions, and risks when they materially improve clarity.
<!-- /append -->

<!-- append "generate_missing_information" -->
8. If necessary information is missing, do not invent hidden facts. Either:
   - state a reasonable assumption explicitly, or
   - mark the gap as an open question for the user
<!-- /append -->

<!-- append "generate_result_quality" -->
9. The result should be usable as a serious PRD draft, not just notes.
<!-- /append -->
