---
status: accepted
date: 2026-04-21
decision-makers: cyber fabric maintainers
---

# ADR-0019: Centralize Orchestration in a Shared Fabric Core

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Let Each Host Plugin Implement Its Own Orchestration Semantics](#option-1-let-each-host-plugin-implement-its-own-orchestration-semantics)
  - [Option 2: Centralize Orchestration in a Shared Fabric Core](#option-2-centralize-orchestration-in-a-shared-fabric-core)
  - [Option 3: Use a Fully Remote Service as the Only Real Fabric Runtime](#option-3-use-a-fully-remote-service-as-the-only-real-fabric-runtime)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-central-fabric-core`

## Context and Problem Statement

Cyber Fabric needs authoritative semantics for planning, orchestration, prompt materialization, validation, review and repair loops, artifact awareness, and execution policy. If those semantics are implemented independently inside each host plugin or extension, the platform will fragment into several similar but incompatible products. If all real behavior is pushed into a fully remote service, local-first workflows, deterministic local tooling, and host-native execution become weaker.

The platform therefore needs a shared Fabric core that acts as the real operational brain behind supported hosts. That core may be packaged as a library, local daemon, service, or a combination of those forms, but it must remain the authoritative source of orchestration behavior and execution state across hosts.

## Decision Drivers

* **Single source of truth** — core orchestration semantics should not be duplicated across hosts
* **Cross-host consistency** — pipeline behavior, prompt materialization, validation, and policy should remain stable across integrations
* **Local-first power** — local and host-native execution should remain possible without depending on a permanently remote-only architecture
* **Explainability** — execution state, policy decisions, and routing choices should be inspectable in one place
* **Extensibility** — new hosts should attach to shared runtime semantics rather than inventing them again
* **Operational flexibility** — the core should be able to exist as a library, local service, or server-side component as deployment needs evolve
* **Governance** — validation, permissions, and orchestration policies need one authoritative implementation surface

## Considered Options

1. **Let Each Host Plugin Implement Its Own Orchestration Semantics** — every integration owns planning, orchestration, and execution policy locally
2. **Centralize Orchestration in a Shared Fabric Core** — use one authoritative core runtime for planning, orchestration, prompt generation, validation, and execution policy
3. **Use a Fully Remote Service as the Only Real Fabric Runtime** — centralize all real logic remotely and reduce local integrations to thin online clients only

## Decision Outcome

Chosen option: **Option 2 — Centralize Orchestration in a Shared Fabric Core**, because Cyber Fabric needs one authoritative operational brain even if it does not require one dedicated first-party TUI. The shared Fabric core should own planning, pipeline execution semantics, host capability interpretation, prompt materialization, validation coordination, review and repair loop policies, artifact awareness, and execution state. Host plugins and adapters should call into this core rather than reimplement it.

The shared core does not need to take only one packaging form. Depending on deployment context, it may be embedded as a library, run as a local daemon, be exposed through a service boundary, or combine those approaches. What matters is that Cyber Fabric has one central semantic layer even when users access it through many hosts.

### Consequences

* Good, because the platform gets one authoritative orchestration model across hosts
* Good, because planner, orchestrator, prompt tooling, validation, and policy can evolve together without per-host duplication
* Good, because execution decisions and runtime state become easier to inspect, audit, and explain
* Good, because host plugins can stay thinner and more maintainable
* Good, because the platform can support local, embedded, or remote deployment forms without rewriting its core semantics
* Bad, because the shared core becomes strategic infrastructure that must be designed carefully
* Bad, because poorly defined boundaries could still let host-specific logic leak inward
* Bad, because deployment and lifecycle management become more important once a central runtime exists

### Confirmation

Confirmed when:

* supported hosts delegate planning, orchestration, prompt materialization, validation coordination, or execution policy to a shared Fabric core
* the system can explain pipeline construction, execution routing, and policy decisions through one authoritative model
* orchestration behavior does not diverge materially across hosts because of duplicated plugin logic
* the shared core can operate in local, embedded, and future server-backed forms without changing its semantic contract
* host adapters remain thin enough that new Fabric behavior is added mostly in the shared core rather than reimplemented per host

## Pros and Cons of the Options

### Option 1: Let Each Host Plugin Implement Its Own Orchestration Semantics

Allow each host integration to own its own planning, orchestration, prompt logic, and execution policies.

* Good, because local prototyping can happen independently in each host
* Good, because some integrations may move quickly at first
* Bad, because orchestration semantics drift across hosts
* Bad, because fixes and features must be repeated in multiple implementations
* Bad, because the platform loses a clear execution source of truth

### Option 2: Centralize Orchestration in a Shared Fabric Core

Use one authoritative Fabric core behind all supported host integrations.

* Good, because planning, orchestration, validation, and prompt semantics stay coherent across hosts
* Good, because adapters can remain thinner and more replaceable
* Good, because the core can be packaged flexibly without losing architectural identity
* Bad, because the core becomes a high-leverage component that must remain reliable and understandable
* Bad, because operational packaging and lifecycle concerns become part of the architecture

### Option 3: Use a Fully Remote Service as the Only Real Fabric Runtime

Push all real Fabric behavior into a remote service and make local integrations mostly online shells.

* Good, because some upgrades and policy changes can be centralized completely
* Good, because remote coordination can be simplified in some environments
* Bad, because local-first workflows and deterministic local tooling become weaker
* Bad, because host-native and offline-capable usage suffer
* Bad, because the platform becomes too dependent on central infrastructure for normal operation

## More Information

The shared Fabric core should own at least the following responsibilities:

* pipeline planning and compatibility reasoning
* orchestration state, routing policy, and execution lifecycle
* host capability interpretation and backend selection policy
* prompt materialization and layered prompt override evaluation
* validation coordination, retry policy, and review or repair loop control
* artifact identity, version, and contract awareness where those influence execution
* inspectable execution history and reasoning about why specific choices were made

This implies a clean separation of concerns:

* host adapters provide UX integration, local context capture, permission bridging, and host-specific rendering
* the shared Fabric core provides the authoritative semantics of what Cyber Fabric actually does

This keeps Cyber Fabric coherent as a platform even when no single dedicated TUI is treated as the architectural center.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: [ADR-0012](0012-cpt-cyber-fabric-adr-orchestrator-skill-pipeline-composer-v1.md), [ADR-0014](0014-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-deterministic-tooling-in-skills-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric should have one authoritative orchestration brain even when it integrates into many hosts
* planning, prompt materialization, validation, and execution policy should not be reimplemented independently per host
* host adapters should remain thin and defer real operational semantics to shared Fabric behavior
* the platform should support local-first and future centralized deployment forms without changing its core model
