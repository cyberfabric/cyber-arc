---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0008: Centralize Traceability in a Dedicated Skill Family

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Duplicate Traceability Logic Across All Skills](#option-1-duplicate-traceability-logic-across-all-skills)
  - [Option 2: Dedicated Traceability Skill Family](#option-2-dedicated-traceability-skill-family)
  - [Option 3: Put All Traceability Logic in the Orchestrator Only](#option-3-put-all-traceability-logic-in-the-orchestrator-only)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-dedicated-traceability-skill-family`

## Context and Problem Statement

Once traceability is treated as a cross-cutting capability, the platform must decide where traceability operations live. Embedding traceability logic into every skill would create inconsistent identifier behavior, uneven repair semantics, and duplicated validation rules. Putting all traceability behavior inside the orchestrator would overload the orchestrator with domain-specific transformation logic that should remain skill-like and replaceable.

Cyber Fabric needs one authoritative capability family for traceability concerns.

## Decision Drivers

* **Consistency** — identifiers, links, and validation rules must behave the same across workflows
* **Reuse** — multiple pipelines need annotate, link, validate, repair, and summarize behaviors
* **Replaceability** — traceability logic should evolve independently of domain skills and orchestrator control flow
* **Governance** — one capability family should own trace-specific policies and repairs
* **Boundary clarity** — the orchestrator should coordinate, not absorb all traceability implementation details

## Considered Options

1. **Duplicate Traceability Logic Across All Skills** — each skill handles IDs and links in its own way
2. **Dedicated Traceability Skill Family** — one bounded capability family owns traceability operations
3. **Put All Traceability Logic in the Orchestrator Only** — the orchestrator directly performs all traceability work

## Decision Outcome

Chosen option: **Option 2 — Dedicated Traceability Skill Family**, because traceability is important enough to deserve a specialized capability family, yet cross-cutting enough that duplicating it across skills would create drift and inconsistency. The traceability family is responsible for operations such as `annotate`, `link`, `validate`, `repair`, and `summarize`.

### Consequences

* Good, because ID creation, link generation, validation, and repair follow one consistent capability model
* Good, because domain skills can remain trace-agnostic, trace-preserving, or trace-aware without reimplementing traceability logic
* Good, because the orchestrator can route traceability work to a specialized family rather than owning all internals itself
* Good, because future deterministic validators and reporting tools have a stable integration point
* Bad, because the traceability skill family becomes a strategically important dependency for governed workflows
* Bad, because interfaces between domain skills and traceability skills must be carefully defined
* Bad, because some users may initially expect traceability behavior to be embedded in every skill instead

### Confirmation

Confirmed when:

* traceability operations are exposed through one coherent skill family
* domain skills do not implement inconsistent custom ID and link logic by default
* the orchestrator invokes traceability capabilities through declared contracts rather than bespoke ad hoc behaviors
* traceability validation and repair rules are maintained centrally

## Pros and Cons of the Options

### Option 1: Duplicate Traceability Logic Across All Skills

Teach each skill to create, preserve, validate, and repair its own traceability structures.

* Good, because individual skills can optimize locally for their own artifacts
* Bad, because rules drift over time and cross-artifact consistency degrades
* Bad, because validation and repair semantics become fragmented
* Bad, because changes to traceability policy require touching many skills

### Option 2: Dedicated Traceability Skill Family

Create one bounded capability family that owns traceability operations across the platform.

* Good, because cross-cutting traceability concerns get one authoritative home
* Good, because domain skills can stay focused on their own artifact families
* Bad, because cross-family contracts must be designed explicitly
* Bad, because traceability capability quality becomes a central platform dependency

### Option 3: Put All Traceability Logic in the Orchestrator Only

Make the orchestrator directly perform all traceability annotation and validation.

* Good, because control flow and trace decisions sit in one component
* Bad, because the orchestrator becomes too implementation-heavy
* Bad, because replaceability and bounded capability design are weakened
* Bad, because traceability logic becomes harder to evolve independently

## More Information

The dedicated traceability family does not eliminate trace-aware behavior elsewhere. It provides the authoritative operations and rules, while other skills declare whether they are trace-agnostic, trace-preserving, or trace-aware.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* traceability must be centralized as a capability family
* annotate, link, validate, repair, and summarize must be supported coherently
* traceability logic belongs to a dedicated skill family, not scattered implementations
* the traceability family needs clear per-operation contracts
