---
status: accepted
date: 2026-04-21
decision-makers: cyber fabric maintainers
---

# ADR-0001: Use a Unified Fabric Operational Model Across Host-Native Surfaces

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Let Each Host Surface Define Its Own Fabric Behavior](#option-1-let-each-host-surface-define-its-own-fabric-behavior)
  - [Option 2: Use One Unified Fabric Operational Model Across Host-Native Surfaces](#option-2-use-one-unified-fabric-operational-model-across-host-native-surfaces)
  - [Option 3: Make a Dedicated First-Party Client the Mandatory Primary Surface](#option-3-make-a-dedicated-first-party-client-the-mandatory-primary-surface)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-unified-operational-model`

## Context and Problem Statement

Cyber Fabric needs more than a collection of disconnected scripts and integrations. The platform is intended to work across agent hosts such as Claude Code, Codex, OpenCode, and Pi, as well as IDE and future web or server surfaces. It also needs to support multi-agent execution, review and repair loops, prompt generation, deterministic plugins, setup-oriented modes, and strong artifact-aware orchestration.

If each host surface defines its own meaning of planning, orchestration, prompt materialization, and setup, the platform fragments into several loosely related runtimes. If Cyber Fabric instead requires a dedicated first-party TUI as the only serious operational entry point, adoption friction rises and host-native workflows become secondary. The platform therefore needs one unified Fabric operational model that works across host-native surfaces without requiring one mandatory dedicated client.

## Decision Drivers

* **Unified user experience** — supported hosts should feel like views over one Fabric model rather than separate products
* **No mandatory dedicated TUI** — users should not be forced into one first-party client to access real Fabric capabilities
* **Agent-first provider model** — users should choose agent providers and execution routes, not only raw models
* **Pipeline execution** — the operational model must support planner and orchestrator execution of multi-agent pipelines
* **Review and repair loops** — iterative execution patterns should remain first-class across hosts
* **Shared plugin governance** — deterministic extensions need one coherent semantic model even when they integrate through different hosts
* **Setup clarity** — `init` and `install` style behavior should remain explicit and coherent across integrations
* **Inspectability** — execution decisions, prompt generation, and backend routing should remain explainable

## Considered Options

1. **Let Each Host Surface Define Its Own Fabric Behavior** — every integration owns its own operational semantics
2. **Use One Unified Fabric Operational Model Across Host-Native Surfaces** — supported hosts expose Fabric natively but rely on one shared semantic model
3. **Make a Dedicated First-Party Client the Mandatory Primary Surface** — one Fabric-owned client becomes the required central runtime entry point

## Decision Outcome

Chosen option: **Option 2 — Use One Unified Fabric Operational Model Across Host-Native Surfaces**, because Cyber Fabric needs one coherent operational center without forcing users into one mandatory first-party TUI. Supported hosts should expose Fabric through host-native plugins, extensions, or adapters, while a shared Fabric core preserves authoritative semantics for planning, orchestration, prompt materialization, validation, setup flows, and execution policy.

The platform is still agent-first rather than model-first. Users should be able to choose execution providers in terms of supported agents and execution backends, while the system internally handles planning, orchestration, provider routing, prompt generation, and multi-agent review or repair loops. A dedicated first-party TUI may exist as a thin utility for debugging, automation, or fallback access, but it is not the architectural center of the platform.

### Consequences

* Good, because users get one consistent mental model across supported hosts without being forced into one Fabric-owned client
* Good, because planner, orchestrator, prompt tooling, validation, and plugin execution can share one operational model
* Good, because agent-provider selection can be modeled consistently across direct execution and multi-agent pipelines
* Good, because review and repair loops remain a first-class platform capability instead of host-specific glue
* Good, because Fabric can integrate into existing agent and IDE ecosystems without losing coherence
* Bad, because supported hosts still differ in capability and UX constraints, so consistency requires deliberate adapter design
* Bad, because the shared Fabric model becomes strategic infrastructure that must be designed carefully
* Bad, because poor boundaries could still blur core semantics with host-specific behavior

### Confirmation

Confirmed when:

* Cyber Fabric can be used seriously through supported host-native integrations without requiring a dedicated first-party TUI
* users choose supported agent providers or execution backends through a consistent Fabric model rather than fragmented host-specific logic
* planner and orchestrator execution can be driven through the same Fabric semantics across hosts
* multi-agent review and repair loops can run inside the shared operational model
* prompt materialization and deterministic plugin execution integrate through the same Fabric semantics even when surfaced through different hosts
* host integrations behave like views over one operational core rather than separate runtimes

## Pros and Cons of the Options

### Option 1: Let Each Host Surface Define Its Own Fabric Behavior

Split the platform into multiple host-specific implementations with no shared operational source of truth.

* Good, because each host can iterate independently at first
* Good, because some integrations may prototype quickly in isolation
* Bad, because users face inconsistent behavior and duplicated concepts
* Bad, because runtime contracts drift across chat, setup, orchestration, and plugin paths
* Bad, because multi-agent loops become harder to model coherently across hosts

### Option 2: Use One Unified Fabric Operational Model Across Host-Native Surfaces

Keep one Fabric semantic model while exposing it through host-native plugins, extensions, or adapters.

* Good, because the platform gains one coherent operational identity without demanding one mandatory client
* Good, because host-native surfaces can share planning, orchestration, provider routing, and plugin semantics
* Good, because future IDE and web experiences can reuse the same model rather than inventing separate runtimes
* Bad, because adapter contracts and host-capability mapping must be designed carefully
* Bad, because failures in shared semantics can affect multiple integrations at once

### Option 3: Make a Dedicated First-Party Client the Mandatory Primary Surface

Build one Fabric-owned client and require it as the main serious entry point.

* Good, because one client can be easier to standardize initially
* Good, because Fabric controls the full primary UX
* Bad, because users must leave tools they already use
* Bad, because host-native adoption becomes weaker and slower
* Bad, because Cyber Fabric starts to look like another parallel tool instead of a connective platform

## More Information

This decision implies the following operational model:

* supported hosts should expose Cyber Fabric through native plugins, extensions, or adapters where practical
* the platform should let users select supported agent providers and execution routes through one Fabric model
* planner and orchestrator runtime capabilities should execute through the same shared operational semantics across hosts
* prompt generation and layered prompt overrides should be materialized through shared Fabric behavior rather than per-host reinvention
* deterministic plugins should integrate through governed Fabric semantics instead of inventing unrelated primary runtimes
* setup-oriented modes such as `init` and `install` should remain explicit and portable across integrations
* thin operational utilities may exist for debugging, automation, or fallback access, but no dedicated first-party TUI is required as the main architectural center

This keeps Cyber Fabric coherent as a platform instead of turning it into a loose set of partially overlapping host integrations.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-skills-cross-tool-registration`, `cpt-cyber-fabric-fr-surface-parity`, `cpt-cyber-fabric-nfr-surface-parity`, `cpt-cyber-fabric-contract-agentic-tool-host-plugin`
- **Related decisions**: [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0007](0007-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md)

This decision directly addresses the following traceability items:

* the platform should expose one unified Fabric operational model rather than fragmented unrelated runtimes
* the platform should be agent-first and support provider selection across supported host surfaces
* the operational model should support planner and orchestrator execution and multi-agent review or repair loops
* prompt generation, setup flows, and deterministic plugins should integrate through the same Fabric semantics without requiring one mandatory dedicated TUI
