---
status: accepted
date: 2026-04-21
decision-makers: cyber fabric maintainers
---

# ADR-0016: Adopt TypeScript as the Primary Implementation Language for Cyber Fabric

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Use Python as the Primary Implementation Language](#option-1-use-python-as-the-primary-implementation-language)
  - [Option 2: Use TypeScript as the Primary Implementation Language](#option-2-use-typescript-as-the-primary-implementation-language)
  - [Option 3: Start Polyglot from the Beginning](#option-3-start-polyglot-from-the-beginning)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-typescript-primary-language`

## Context and Problem Statement

Cyber Fabric is not only a document and workflow toolchain. It is intended to become an interactive agent platform that spans host-native integrations such as Claude Code, Codex, OpenCode, Pi, and VS Code, as well as future web or server surfaces. In that model, users select an agent provider rather than thinking only in terms of raw model invocation, and the system must support multi-agent pipelines, review loops, and repair loops across a shared execution runtime.

The platform therefore needs a primary implementation language that can unify shared Fabric-core behavior, host adapters, interactive user surfaces, orchestration logic, provider integrations, prompt generation tooling, and shared runtime contracts. Choosing different primary languages for these concerns too early would increase architecture friction, duplicate type definitions, and weaken the cohesion of the core and extension surface.

## Decision Drivers

* **Surface unification** — the same language should support host adapters, web UI, thin clients, and orchestration runtime
* **Agent-provider integrations** — the platform must integrate cleanly with interactive external agents and tool-style runtimes
* **Shared contracts** — planner, orchestrator, provider adapters, prompt tooling, and UI surfaces should share typed runtime models
* **Async orchestration** — multi-agent execution, review loops, repair loops, and streaming interaction require strong event-driven support
* **Product velocity** — the primary language should accelerate rapid evolution of product-facing interactive features
* **Plugin alignment** — the Fabric core, host adapters, and deterministic extension surface should converge on one main implementation language
* **Footprint discipline** — the language choice must still support the minimal-footprint direction of the system

## Considered Options

1. **Use Python as the Primary Implementation Language** — optimize for scripting, local tooling, and deterministic text processing
2. **Use TypeScript as the Primary Implementation Language** — optimize for shared runtime across UI, CLI, orchestration, and provider integrations
3. **Start Polyglot from the Beginning** — deliberately split the system across multiple primary languages from the start

## Decision Outcome

Chosen option: **Option 2 — Use TypeScript as the Primary Implementation Language**, because Cyber Fabric is evolving into an interactive agent platform whose core value depends on a unified runtime across host adapters, shared orchestration semantics, web or server surfaces, and provider integration layers. TypeScript provides one language for Fabric-core behavior, thin operational clients, web UI, agent adapter implementations, shared contracts, and event-driven multi-agent orchestration.

TypeScript is the primary implementation language for the main Cyber Fabric runtime, including the shared Fabric core, planner and orchestrator runtime logic, provider adapters, host integrations, thin operational utilities, web-facing surfaces, prompt-materialization tooling, and the main deterministic extension surface. Other languages remain allowed only as explicitly bounded external tools or specialized helpers when that is justified by clear capability or operational needs.

### Consequences

* Good, because UI, CLI, and orchestration layers can share one implementation language and common packages
* Good, because planner, orchestrator, prompt tooling, and provider adapters can share typed contracts directly
* Good, because event-driven interaction and streaming agent integrations fit the product direction well
* Good, because the shared Fabric core and its extension surface can converge on one main language instead of fragmenting early
* Good, because host adapters, thin clients, and web surfaces can evolve from the same runtime model
* Bad, because Node and package-management complexity must be controlled carefully to preserve a minimal footprint
* Bad, because some deterministic utilities may still feel more natural in other languages and must be integrated through explicit boundaries
* Bad, because the platform must invest in disciplined packaging, dependency policy, and release engineering

### Confirmation

Confirmed when:

* the main Cyber Fabric runtime is implemented in TypeScript
* planner and orchestrator runtime components share TypeScript contracts and libraries
* host adapters, thin operational utilities, and web-facing UI reuse shared TypeScript domain packages
* provider adapters and prompt-materialization tooling are implemented primarily in TypeScript
* deterministic extension integration targets the shared TypeScript Fabric core by default
* non-TypeScript helpers, when used, remain explicitly bounded rather than defining the main system architecture

## Pros and Cons of the Options

### Option 1: Use Python as the Primary Implementation Language

Use Python as the main language for the platform runtime and integration surface.

* Good, because local tooling, scripting, and text transformation are straightforward
* Good, because deterministic utility code can be quick to write
* Bad, because host adapters, web UI, and product-facing interactive surfaces become less unified
* Bad, because provider adapters and event-rich runtime logic are less aligned with the broader product direction
* Bad, because the shared Fabric core and UI layers would likely split across language boundaries over time

### Option 2: Use TypeScript as the Primary Implementation Language

Use TypeScript across the main runtime, host adapters, user-facing surfaces, orchestration layer, and shared Fabric core.

* Good, because the same language can power web UI, thin clients, adapters, and orchestration
* Good, because shared contracts reduce drift across planner, orchestrator, prompt tooling, and provider integrations
* Good, because the language aligns with an agent-platform product shape rather than only a local toolchain shape
* Bad, because dependency and packaging discipline become critical
* Bad, because some deterministic low-level helpers may still need carefully bounded escape hatches

### Option 3: Start Polyglot from the Beginning

Adopt multiple primary languages from the start and split the system by subsystem.

* Good, because each subsystem can use a locally optimal language
* Bad, because shared contracts and runtime behavior fragment early
* Bad, because packaging, contributor experience, and deployment complexity increase immediately
* Bad, because a young architecture loses cohesion before its platform boundaries stabilize
* Bad, because the shared Fabric core and extension model become harder to govern consistently

## More Information

This decision implies the following implementation bias:

* core contracts should be defined in TypeScript
* the shared Fabric core should be TypeScript-first
* planner and orchestrator runtime logic should be implemented in TypeScript
* provider adapters should prefer TypeScript implementations
* prompt generation and layered prompt materialization should prefer TypeScript implementations
* non-TypeScript tooling should be treated as explicitly bounded extensions rather than the architectural default

This keeps the system aligned with its interactive product direction while still allowing carefully controlled exceptions where needed.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: [ADR-0012](0012-cpt-cyber-fabric-adr-orchestrator-skill-pipeline-composer-v1.md), [ADR-0013](0013-cpt-cyber-fabric-adr-minimal-installation-footprint-v1.md), [ADR-0014](0014-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-deterministic-tooling-in-skills-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-central-fabric-core-v1.md)

This decision directly addresses the following traceability items:

* the system should use one primary language for its main runtime and interactive surfaces
* the language choice should support host adapters, web UI, and orchestration together
* the shared Fabric core and extension surface should converge on the same main implementation language
* the language choice should preserve explicit boundaries for any non-primary helper tooling
