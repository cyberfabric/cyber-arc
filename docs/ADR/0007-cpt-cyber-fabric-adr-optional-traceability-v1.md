---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0007: Model Traceability as an Optional Cross-Cutting Capability

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Mandatory Traceability for All Workflows](#option-1-mandatory-traceability-for-all-workflows)
  - [Option 2: Optional Cross-Cutting Traceability Layer](#option-2-optional-cross-cutting-traceability-layer)
  - [Option 3: No First-Class Traceability Model](#option-3-no-first-class-traceability-model)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-optional-traceability`

## Context and Problem Statement

Cyber Fabric's broader vision strongly values end-to-end traceability, but not every workflow justifies the cost and visual overhead of pervasive identifiers and link management. If traceability is mandatory everywhere, lightweight workflows become cumbersome and documents are polluted with IDs even when no downstream control or audit benefit exists. If traceability is absent as a platform concept, however, more rigorous delivery workflows lose a critical governance capability.

Cyber Fabric needs traceability to be first-class, but selectively applied.

## Decision Drivers

* **Pragmatism** — lightweight workflows should not pay unnecessary governance cost
* **Governance** — high-control workflows need structured trace links and coverage checks
* **Usability** — documents should avoid identifier noise when traceability provides little value
* **Adoptability** — teams should be able to start simple and add traceability as maturity grows
* **Consistency** — when traceability is enabled, it must follow one platform model

## Considered Options

1. **Mandatory Traceability for All Workflows** — every artifact and workflow requires IDs and links
2. **Optional Cross-Cutting Traceability Layer** — traceability can be applied when needed by the workflow or governance policy
3. **No First-Class Traceability Model** — let each skill handle references informally if desired

## Decision Outcome

Chosen option: **Option 2 — Optional Cross-Cutting Traceability Layer**, because Cyber Fabric must support both lightweight composition and rigorous governed delivery. Traceability is therefore modeled as a platform capability that can be introduced when needed, rather than a mandatory burden on every artifact from the outset.

### Consequences

* Good, because teams can adopt the platform without immediate identifier-heavy workflows
* Good, because governance-heavy pipelines can still rely on explicit trace links and coverage rules
* Good, because the platform can preserve clean human-readable artifacts where traceability is unnecessary
* Good, because traceability remains standardized when enabled rather than improvised skill by skill
* Bad, because workflows need a clear way to declare whether traceability is required, optional, or out of scope
* Bad, because optional adoption creates mixed environments that the orchestrator must understand
* Bad, because users may defer traceability too long unless policy makes the expectation explicit

### Confirmation

Confirmed when:

* workflows and skill interfaces can declare traceability expectations explicitly
* artifacts without traceability remain valid when the workflow policy allows it
* traceability-enabled workflows can apply identifiers, links, and validation consistently across participating artifacts
* documentation guidance explains when traceability is beneficial and when it is intentionally omitted

## Pros and Cons of the Options

### Option 1: Mandatory Traceability for All Workflows

Require IDs and trace links on every meaningful artifact and step.

* Good, because governance is uniform
* Good, because traceability data is always available
* Bad, because it imposes cost and document noise everywhere
* Bad, because it slows lightweight or exploratory workflows unnecessarily
* Bad, because teams may resist adoption if the platform feels over-governed

### Option 2: Optional Cross-Cutting Traceability Layer

Provide traceability as a platform capability that can be turned on by workflow need or policy.

* Good, because it balances governance with usability
* Good, because traceability can scale with process maturity and risk level
* Bad, because orchestration must reason about mixed traceability participation
* Bad, because policy communication becomes more important

### Option 3: No First-Class Traceability Model

Avoid a dedicated platform model and leave references to ad hoc document conventions.

* Good, because initial implementation looks simpler
* Bad, because trace links become inconsistent and non-portable
* Bad, because deterministic coverage and broken-reference validation become much harder
* Bad, because every skill must reinvent traceability rules differently

## More Information

This decision does not reduce the strategic value of traceability in Cyber Fabric. It makes traceability deployable in proportion to workflow risk and governance needs while preserving one platform-level model for when it is used.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* traceability must be available without being mandatory in every flow
* workflows must declare their traceability expectations
* traceability is modeled outside individual domain skills as a cross-cutting governance layer
* teams need guidance on when traceability should be recommended or required
