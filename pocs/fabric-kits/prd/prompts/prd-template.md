---
id: prd-template
type: template
name: prd template
description: PRD markdown template with placeholders derived from the Cypilot SDLC PRD template without cpt-specific identifiers
---

<!-- append "title" -->
# PRD — {Module/Feature Name}
<!-- /append -->

<!-- append "table_of_contents" -->
## Table of Contents
<!-- /append -->

<!-- append "overview" -->
## 1. Overview
<!-- /append -->

<!-- append "purpose" -->
### 1.1 Purpose

{1-2 paragraphs: What is this system/module and what problem does it solve? What are the key features?}
<!-- /append -->

<!-- append "background_problem_statement" -->
### 1.2 Background / Problem Statement

{2-3 paragraphs: Context, current pain points, why this capability is needed now.}
<!-- /append -->

<!-- append "goals" -->
### 1.3 Goals (Business Outcomes)

- {Goal 1: measurable business outcome}
- {Goal 2: measurable business outcome}
<!-- /append -->

<!-- append "glossary" -->
### 1.4 Glossary

| Term | Definition |
|------|------------|
| {Term} | {Definition} |
<!-- /append -->

<!-- append "actors" -->
## 2. Actors

> **Note**: Stakeholder needs are managed at project/task level by steering committee. Document **actors** (users, systems) that interact with this module.
<!-- /append -->

<!-- append "human_actors" -->
### 2.1 Human Actors

#### {Actor Name}

**Role**: {Description of what this actor does and their relationship to the system.}
**Needs**: {What this actor needs from the system.}
<!-- /append -->

<!-- append "system_actors" -->
### 2.2 System Actors

#### {System Actor Name}

**Role**: {Description of what this system actor does (external service, scheduler, etc.)}
<!-- /append -->

<!-- append "operational_concept_environment" -->
## 3. Operational Concept & Environment

> **Note**: Project-wide runtime, OS, architecture, lifecycle policy, and integration patterns defined in root PRD. Document only module-specific deviations here. **Delete this section if no special constraints.**
<!-- /append -->

<!-- append "module_specific_environment_constraints" -->
### 3.1 Module-Specific Environment Constraints

{Only if this module has constraints beyond project defaults:}

- {Constraint 1, e.g., "Requires GPU acceleration for X"}
- {Constraint 2, e.g., "Incompatible with async runtime due to Y"}
- {Constraint 3, e.g., "Requires external dependency: Z library v2.0+"}
<!-- /append -->

<!-- append "scope" -->
## 4. Scope
<!-- /append -->

<!-- append "in_scope" -->
### 4.1 In Scope

- {Capability or feature that IS included}
- {Another capability}
<!-- /append -->

<!-- append "out_of_scope" -->
### 4.2 Out of Scope

- {Capability explicitly NOT included in this PRD}
- {Future consideration not addressed now}
<!-- /append -->

<!-- append "functional_requirements" -->
## 5. Functional Requirements

> **Testing strategy**: All requirements verified via automated tests (unit, integration, e2e) targeting 90%+ code coverage unless otherwise specified. Document verification method only for non-test approaches (analysis, inspection, demonstration).

Functional requirements define WHAT the system must do. Group by feature area or priority tier.
<!-- /append -->

<!-- append "feature_area_priority_tier" -->
### 5.1 {Feature Area / Priority Tier}

#### {Requirement Name}

- [ ] `p1`

The system **MUST** {do something specific and verifiable}.

**Rationale**: {Why this requirement exists — business value or stakeholder need.}

**Actors**: {Relevant actors}

**Verification Method** (optional): {Only if non-standard: analysis | inspection | demonstration | specialized test approach}

**Acceptance Evidence** (optional): {Only if non-obvious: specific test suite path, analysis report, review checklist}
<!-- /append -->

<!-- append "non_functional_requirements" -->
## 6. Non-Functional Requirements
<!-- /append -->

<!-- append "nfr_inclusions" -->
### 6.1 NFR Inclusions

{Only include this section if there are NFRs that deviate from or extend project defaults.}

#### {NFR Name}

- [ ] `p1`

The system **MUST** {measurable NFR with specific thresholds, e.g., "respond within 50ms at p95" (stricter than project default)}.

**Threshold**: {Quantitative target with units and conditions}

**Rationale**: {Why this module needs different/additional NFR}

**Verification Method** (optional): {Only if non-standard approach needed}
<!-- /append -->

<!-- append "nfr_exclusions" -->
### 6.2 NFR Exclusions

{Document any project-default NFRs that do NOT apply to this module}

- {Default NFR name}: {Reason for exclusion}
<!-- /append -->

<!-- append "public_library_interfaces" -->
## 7. Public Library Interfaces

Define the public API surface, versioning/compatibility guarantees, and integration contracts provided by this library.
<!-- /append -->

<!-- append "public_api_surface" -->
### 7.1 Public API Surface

#### {Interface Name}

- [ ] `p1`

**Type**: {Rust module/trait/struct | REST API | CLI | Protocol | Data format}

**Stability**: {stable | unstable | experimental}

**Description**: {What this interface provides}

**Breaking Change Policy**: {e.g., Major version bump required}
<!-- /append -->

<!-- append "external_integration_contracts" -->
### 7.2 External Integration Contracts

Contracts this library expects from external systems or provides to downstream clients.

#### {Contract Name}

- [ ] `p2`

**Direction**: {provided by library | required from client}

**Protocol/Format**: {e.g., HTTP/REST, gRPC, JSON Schema}

**Compatibility**: {Backward/forward compatibility guarantees}
<!-- /append -->

<!-- append "use_cases" -->
## 8. Use Cases

Optional: Include when interaction flows add clarity beyond requirement statements.
<!-- /append -->

<!-- append "use_case_template" -->
#### {Use Case Name}

- [ ] `p2`

**Actor**: {Actor name}

**Preconditions**:
- {Required state before execution}

**Main Flow**:
1. {Actor action or system response}
2. {Next step}

**Postconditions**:
- {State after successful completion}

**Alternative Flows**:
- **{Condition}**: {What happens instead}
<!-- /append -->

<!-- append "acceptance_criteria" -->
## 9. Acceptance Criteria

Business-level acceptance criteria for the PRD as a whole.

- [ ] {Testable criterion that validates a key business outcome}
- [ ] {Another testable criterion}
<!-- /append -->

<!-- append "dependencies" -->
## 10. Dependencies

| Dependency | Description | Criticality |
|------------|-------------|-------------|
| {Service/System} | {What it provides} | {p1/p2/p3} |
<!-- /append -->

<!-- append "assumptions" -->
## 11. Assumptions

- {Assumption about environment, users, or dependent systems}
<!-- /append -->

<!-- append "risks" -->
## 12. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| {Risk description} | {Potential impact} | {Mitigation strategy} |
<!-- /append -->
