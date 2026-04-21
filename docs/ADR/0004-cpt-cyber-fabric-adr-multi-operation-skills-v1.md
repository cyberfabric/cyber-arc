---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0004: Allow Multiple Operations Per Skill Within a Bounded Capability Family

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Exactly One Operation Per Skill](#option-1-exactly-one-operation-per-skill)
  - [Option 2: Multiple Operations Within One Capability Family](#option-2-multiple-operations-within-one-capability-family)
  - [Option 3: Broad Multi-Purpose Skills with Arbitrary Operations](#option-3-broad-multi-purpose-skills-with-arbitrary-operations)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-multi-operation-skills`

## Context and Problem Statement

The platform must decide whether a skill is equivalent to a single action or to a bounded capability that may expose multiple closely related operations. Strict one-action skills create very pure interfaces but can fragment related functionality into an unmanageable number of tiny registry entries. Unbounded multi-purpose skills create the opposite failure mode: unrelated capabilities hidden behind one name.

Cyber Fabric needs a middle position that keeps skills cohesive without forcing artificial fragmentation.

## Decision Drivers

* **Cohesion** — related actions should remain grouped when they operate on the same artifact family
* **Discoverability** — the registry should remain understandable to operators and tooling
* **Reuse** — generate, review, repair, and summarize operations often belong to the same capability family
* **Compatibility** — per-operation contracts still need explicit declaration
* **Governance** — unrelated actions must not be merged for convenience

## Considered Options

1. **Exactly One Operation Per Skill** — every action becomes a distinct skill package
2. **Multiple Operations Within One Capability Family** — one skill may expose several related modes over one bounded domain
3. **Broad Multi-Purpose Skills with Arbitrary Operations** — one skill accumulates unrelated actions if it is operationally convenient

## Decision Outcome

Chosen option: **Option 2 — Multiple Operations Within One Capability Family**, because Cyber Fabric should model a skill as a bounded capability, not as a single verb. Operations such as `generate`, `review`, `repair`, and `summarize` may coexist when they work over the same artifact family and responsibility boundary.

### Consequences

* Good, because the skill registry stays compact without losing conceptual cohesion
* Good, because related operations can share metadata, routing hints, and validation assumptions
* Good, because loops such as generate → review → repair stay within one capability family where appropriate
* Bad, because governance must prevent unrelated operations from being bundled into convenience mega-skills
* Bad, because per-operation contracts need enough detail to avoid ambiguous routing
* Bad, because capabilities may drift broader over time if review discipline is weak

### Confirmation

Confirmed when:

* skill definitions declare supported operations explicitly rather than implying one default behavior
* capability families remain bounded to one artifact or responsibility domain
* unrelated actions such as document generation and service deployment are rejected from the same skill contract
* orchestrator routing can select a specific operation without ambiguity

## Pros and Cons of the Options

### Option 1: Exactly One Operation Per Skill

Create a separate skill package for every single verb.

* Good, because each contract is extremely narrow
* Good, because routing is simple at the individual operation level
* Bad, because registries become noisy and fragmented
* Bad, because related operations lose shared context and governance
* Bad, because capability families become harder to understand as a whole

### Option 2: Multiple Operations Within One Capability Family

Allow a bounded skill to expose several operations over the same artifact family or responsibility boundary.

* Good, because cohesion is preserved while operational variety remains explicit
* Good, because one capability can support lifecycle operations without becoming monolithic
* Bad, because capability boundaries require deliberate review and enforcement
* Bad, because operation metadata must be well-specified

### Option 3: Broad Multi-Purpose Skills with Arbitrary Operations

Allow one skill to accumulate whatever operations seem useful.

* Good, because it reduces the number of top-level entries superficially
* Bad, because it reintroduces monolithic-agent behavior under a skill label
* Bad, because compatibility and governance become unpredictable
* Bad, because users cannot infer capability scope from the skill identity

## More Information

Examples of acceptable multi-operation skill families include requirements, design composition, artifact repair, and traceability management. Examples of unacceptable combinations include requirements generation plus deployment, email delivery, or unrelated infrastructure actions.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* skills may support several related operations
* operations must stay within one coherent responsibility area
* each operation still declares its own contracts
* governance criteria should define acceptable operation grouping
