---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0001: Adopt Small Contract-Based Skills Instead of Monolithic Agents

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Large Monolithic Agents](#option-1-large-monolithic-agents)
  - [Option 2: Small Contract-Based Skills](#option-2-small-contract-based-skills)
  - [Option 3: One General Agent with Internal Tool Modes](#option-3-one-general-agent-with-internal-tool-modes)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-contract-based-skills`

## Context and Problem Statement

Cyber Fabric is intended to orchestrate agent skills in the same spirit as GNU utilities: each capability should do one bounded thing well, publish a clear contract, and participate in larger workflows through composition rather than hidden prompt behavior. A monolithic super-agent would make local convenience easier in the short term, but it would collapse planning, execution, validation, and recovery into one opaque decision surface.

For a production-grade system, that opacity is a liability. The orchestrator must reason about compatibility, validate intermediate results, and recover from partial failures without depending on the internal heuristics of a single giant agent.

## Decision Drivers

* **Predictability** — routing must depend on declared contracts, not emergent prompt behavior
* **Composability** — large tasks must decompose into reusable skill pipelines
* **Governance** — bounded skills are easier to review, version, and replace
* **Failure isolation** — faults should be contained to one capability boundary when possible
* **Operational realism** — production orchestration needs explicit boundaries for validation and recovery

## Considered Options

1. **Large Monolithic Agents** — a few broad agents handle planning, transformation, validation, and repair internally
2. **Small Contract-Based Skills** — many narrowly scoped skills declare inputs, outputs, and supported operations
3. **One General Agent with Internal Tool Modes** — a single skill entry point exposes multiple unrelated internal behaviors

## Decision Outcome

Chosen option: **Option 2 — Small Contract-Based Skills**, because Cyber Fabric is an orchestration platform, not a personality shell around one giant model prompt. Small skills make capability boundaries explicit, allow deterministic compatibility checks, and let the orchestrator coordinate pipelines with less hidden coupling.

### Consequences

* Good, because the orchestrator can route work by declared contracts and artifact families rather than prompt folklore
* Good, because skills can be independently versioned, validated, and replaced without redesigning the whole platform
* Good, because recovery becomes local: the orchestrator can retry, repair, or swap one skill in a pipeline
* Good, because the platform can expose a credible skill ecosystem rather than a small number of opaque agent personas
* Bad, because more interfaces must be designed and maintained up front
* Bad, because poor skill granularity decisions can still create fragmentation if governance is weak
* Bad, because multi-step user experiences require stronger orchestration to feel coherent

### Confirmation

Confirmed when:

* new skills are accepted only with bounded responsibilities and declared contracts
* orchestrator routing depends on operation compatibility and artifact contracts instead of prompt-only selection
* large workflows are expressed as pipelines of skills rather than hidden internal substeps of one agent
* replacement of one skill does not require redesign of unrelated capabilities

## Pros and Cons of the Options

### Option 1: Large Monolithic Agents

Use a few broad agents that internally decide how to plan, transform, review, and repair.

* Good, because it reduces the apparent number of moving parts
* Good, because initial demos may feel smoother
* Bad, because interfaces become implicit and hard to validate
* Bad, because failures and regressions are harder to isolate
* Bad, because reuse across workflows depends on prompt copying instead of stable composition

### Option 2: Small Contract-Based Skills

Model each skill as a bounded capability with explicit operations, declared inputs, and declared outputs.

* Good, because it matches the platform's utility-style philosophy
* Good, because explicit skill boundaries support compatibility checking and pipeline reuse
* Bad, because interface design and registry discipline become mandatory
* Bad, because the orchestrator must do more coordination work

### Option 3: One General Agent with Internal Tool Modes

Expose a single agent surface while hiding many unrelated capability modes inside it.

* Good, because it provides a simple external UX surface
* Bad, because it centralizes unrelated concerns into one unstable contract
* Bad, because internal modes remain hard to version and reason about independently
* Bad, because it reproduces monolithic-agent risks behind a different label

## More Information

This decision aligns with Cyber Fabric's vision of a deterministic collaborative delivery system that spans planning, validation, and review without collapsing those concerns into one opaque actor. It also establishes the architectural boundary needed for later ADRs on artifact contracts, loops, validation, and traceability.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* each skill must own one bounded responsibility
* orchestration must route by declared interfaces rather than prompt guesses
* planner, validator coordinator, executor, and recovery manager responsibilities depend on explicit skill boundaries
* governance must define when a capability is too broad or too fragmented
