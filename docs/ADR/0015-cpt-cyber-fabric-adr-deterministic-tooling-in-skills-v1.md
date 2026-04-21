---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0015: Allow Skills to Carry Deterministic Tooling via Shared Fabric Extensions or Explicit Install Modes

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Keep Skills Purely Prompt-Based and Forbid Deterministic Tooling](#option-1-keep-skills-purely-prompt-based-and-forbid-deterministic-tooling)
  - [Option 2: Allow Deterministic Tooling Through Shared Fabric Extensions or Explicit User-Managed Setup](#option-2-allow-deterministic-tooling-through-shared-fabric-extensions-or-explicit-user-managed-setup)
  - [Option 3: Let Every Skill Ship Arbitrary Embedded Tooling Freely](#option-3-let-every-skill-ship-arbitrary-embedded-tooling-freely)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-deterministic-tooling-in-skills`

## Context and Problem Statement

Cyber Fabric skills are primarily contract-based LLM capabilities, but some skills need deterministic tooling for validation, parsing, transformation, or environment setup. If deterministic tooling is completely forbidden, some skill families lose the exactness needed for production-grade workflows. If every skill is allowed to embed arbitrary tooling without structure, the ecosystem becomes harder to maintain, install, audit, and upgrade.

The platform therefore needs a controlled model for deterministic tooling inside skills. When the tooling is reusable and aligned with the platform's shared operational semantics, it should be implemented through the shared Fabric extension model: as an extension to the Fabric core or as a governed integration through supported host adapters in the platform's main implementation language. When that is not appropriate, the skill may declare that dependency setup is the user's responsibility. In addition, a skill may expose a special `init` or `install` mode in which the LLM can help install or prepare the required dependencies.

## Decision Drivers

* **Determinism** — some skill outcomes require exact tooling rather than prompt-only behavior
* **Shared governance** — reusable tooling should integrate with one governed Fabric extension model when practical
* **Extensibility** — skills must be able to add deterministic behavior without turning the platform into an unstructured tool zoo
* **Operational clarity** — users need to know whether a dependency is bundled, plugin-based, or user-managed
* **Installability** — dependency setup must be explicit and support controlled setup flows
* **Safety and reviewability** — install-time actions must be visible and intentional

## Considered Options

1. **Keep Skills Purely Prompt-Based and Forbid Deterministic Tooling** — skills may not carry deterministic execution logic
2. **Allow Deterministic Tooling Through Shared Fabric Extensions or Explicit User-Managed Setup** — deterministic capabilities are allowed, but must either integrate with the shared Fabric extension model or be declared as user-managed, optionally with `init` or `install` modes
3. **Let Every Skill Ship Arbitrary Embedded Tooling Freely** — each skill manages any tooling and dependency model it wants

## Decision Outcome

Chosen option: **Option 2 — Allow Deterministic Tooling Through Shared Fabric Extensions or Explicit User-Managed Setup**, because Cyber Fabric needs deterministic precision in some skills without losing ecosystem coherence. If deterministic tooling is broadly reusable or should participate in the common operational model, it should be implemented through the shared Fabric extension model: as an extension to the Fabric core or as a governed capability exposed through supported host adapters, in the platform's main implementation language. If that is not appropriate, the skill must declare the dependency responsibility explicitly and may expose `init` or `install` modes so the LLM can help the user set up the required environment.

### Consequences

* Good, because skills can gain deterministic power where it materially improves reliability
* Good, because reusable tooling can converge into a shared Fabric extension model instead of being duplicated across many skills and hosts
* Good, because user-managed dependencies remain possible when plugin integration is not justified
* Good, because `init` and `install` modes create an explicit setup path instead of hiding environment assumptions
* Good, because the system can distinguish runtime skill use from environment preparation concerns
* Bad, because extension boundaries and Fabric-core versus host-adapter scope need active governance
* Bad, because user-managed dependency paths introduce variability across environments
* Bad, because install modes can become operationally risky if they are not clearly surfaced and controlled

### Confirmation

Confirmed when:

* skills that need deterministic tooling declare that need explicitly
* reusable deterministic functionality can be implemented as shared Fabric extensions or governed host-adapter integrations
* skills that cannot or should not integrate through shared Fabric extensions clearly document user-managed setup responsibilities
* skills may expose `init` or `install` modes for dependency setup and those modes are treated as explicit setup actions
* users can distinguish between normal skill execution and setup-oriented execution paths

## Pros and Cons of the Options

### Option 1: Keep Skills Purely Prompt-Based and Forbid Deterministic Tooling

Allow only prompt-driven behavior and disallow deterministic tooling inside the skill model.

* Good, because the model surface is simple
* Good, because installation concerns are reduced initially
* Bad, because exact parsing, validation, and transformation capabilities become weaker
* Bad, because the platform loses an important way to make skill outputs more reliable
* Bad, because users may reintroduce ad hoc tooling outside the platform anyway

### Option 2: Allow Deterministic Tooling Through Shared Fabric Extensions or Explicit User-Managed Setup

Allow deterministic tooling, but govern it through shared Fabric extensions where appropriate or explicit user-managed dependency setup otherwise.

* Good, because deterministic power is available without abandoning platform structure
* Good, because reusable tooling can accumulate in one Fabric-governed extension model
* Good, because skills can still declare setup flows when plugin integration is not appropriate
* Bad, because plugin acceptance rules and install semantics need strong policy
* Bad, because some users will still face environment setup complexity

### Option 3: Let Every Skill Ship Arbitrary Embedded Tooling Freely

Allow each skill to define its own tooling model, dependencies, and setup path independently.

* Good, because skill authors get maximum freedom
* Bad, because tooling behavior becomes inconsistent across the ecosystem
* Bad, because installation and upgrade paths become fragmented
* Bad, because reviewability and trust degrade when every skill invents its own operational surface
* Bad, because deterministic capability reuse becomes weaker

## More Information

This decision implies the following operating model:

* a skill may include deterministic tooling when it materially improves capability reliability
* if the tooling belongs on the shared operational surface, it should be implemented through the Fabric extension model in the platform's implementation language
* if plugin integration is not appropriate, the skill should declare that required dependencies are user-managed
* a skill may expose special `init` or `install` modes to help prepare dependencies or local environment state
* setup-oriented modes should be distinguishable from normal skill execution modes
* dependency expectations should be explicit in the skill contract rather than hidden in prompt prose

This keeps deterministic tooling available without collapsing the skill ecosystem into ungoverned per-skill runtime fragmentation.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: [ADR-0017](0017-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-central-fabric-core-v1.md)

This decision directly addresses the following traceability items:

* skills may contain deterministic tooling when it materially improves reliability
* reusable deterministic tooling should prefer integration as shared Fabric extensions rather than per-host duplication
* skills may explicitly leave dependency management to the user when shared Fabric integration is not appropriate
* skills may expose `init` or `install` modes for setup-oriented dependency preparation
* setup behavior should remain explicit and distinguishable from normal skill execution
