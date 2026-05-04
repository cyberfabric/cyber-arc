---
status: accepted
date: 2026-04-21
decision-makers: cyber fabric maintainers
---

# ADR-0003: Integrate Cyber Fabric Through Host-Native Plugins and Adapters

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Build a Dedicated First-Party Client and Ask Users to Switch to It](#option-1-build-a-dedicated-first-party-client-and-ask-users-to-switch-to-it)
  - [Option 2: Deliver Cyber Fabric Through Host-Native Plugins and Adapters](#option-2-deliver-cyber-fabric-through-host-native-plugins-and-adapters)
  - [Option 3: Use Loose Per-Host Scripts and Macros Without a Standard Adapter Contract](#option-3-use-loose-per-host-scripts-and-macros-without-a-standard-adapter-contract)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-host-native-plugins-and-adapters`

## Context and Problem Statement

Cyber Fabric is meant to participate in the environments where users already work: agent hosts such as Claude Code, Codex, OpenCode, and Pi, as well as IDE surfaces such as VS Code and future web or server clients. If Fabric requires a dedicated first-party client as the only serious entry point, adoption friction rises and the platform becomes easier to ignore or bypass. If every host integration is built ad hoc, however, Fabric behavior fragments across hosts and the platform loses architectural coherence.

The platform therefore needs a deliberate host-integration strategy. Cyber Fabric should be delivered through host-native plugins, extensions, or adapters for supported hosts, while those adapters remain thin and route into shared Fabric semantics rather than reimplementing platform logic independently.

## Decision Drivers

* **Adoption** — Fabric should meet users in the tools and interfaces they already use
* **Host-native experience** — each supported host should feel natural rather than wrapped awkwardly
* **Architectural coherence** — host integrations must not fork the platform's real behavior
* **Portability** — the same Fabric workflow should move across hosts with minimal semantic drift
* **Extensibility** — new hosts should be addable through a defined adapter model rather than one-off glue
* **Minimal client burden** — host adapters should stay thin enough to evolve without becoming separate products
* **Capability awareness** — integrations should expose what each host can and cannot do explicitly

## Considered Options

1. **Build a Dedicated First-Party Client and Ask Users to Switch to It** — make Fabric's own client the main way to use the platform and treat host integrations as secondary or unnecessary
2. **Deliver Cyber Fabric Through Host-Native Plugins and Adapters** — integrate Fabric into supported hosts through native extension points and standard adapter contracts
3. **Use Loose Per-Host Scripts and Macros Without a Standard Adapter Contract** — let each host integration evolve independently with minimal shared structure

## Decision Outcome

Chosen option: **Option 2 — Deliver Cyber Fabric Through Host-Native Plugins and Adapters**, because Cyber Fabric should feel present inside the environments where work already happens without surrendering its architectural consistency. Supported hosts should expose Fabric through host-native plugins, extensions, or adapters. Those adapters should translate local host capabilities, permissions, session context, and interaction patterns into the shared Fabric operational model rather than owning orchestration semantics themselves.

A dedicated first-party TUI is therefore not required as the primary user surface. Fabric may still expose thin operational clients for debugging, automation, CI, or fallback access, but the core adoption path should work through supported host-native integrations.

### Consequences

* Good, because Fabric can meet users inside existing agent hosts and IDE workflows instead of demanding a separate client migration
* Good, because host-specific UX can remain natural while still participating in one shared platform model
* Good, because the adapter pattern creates a clearer path for supporting additional hosts over time
* Good, because the platform can separate host-specific concerns from core orchestration and artifact semantics
* Good, because the absence of a mandatory dedicated TUI helps preserve the minimal-footprint adoption story
* Bad, because host integration breadth creates ongoing compatibility and maintenance work
* Bad, because host capabilities vary, so not every Fabric interaction can look identical everywhere
* Bad, because weak adapter contracts would reintroduce the very fragmentation this decision is trying to avoid

### Confirmation

Confirmed when:

* supported hosts expose Cyber Fabric through native plugin, extension, or adapter mechanisms
* users can invoke core Fabric flows inside those hosts without depending on a dedicated first-party TUI
* host integrations describe their supported capabilities, limitations, and permission mappings explicitly
* new hosts can be added by implementing the adapter contract rather than cloning core logic
* workflow semantics, artifacts, and orchestration behavior remain consistent across supported hosts

## Pros and Cons of the Options

### Option 1: Build a Dedicated First-Party Client and Ask Users to Switch to It

Make Fabric's own client the main operational entry point and treat external hosts as secondary.

* Good, because one client can be easier to standardize initially
* Good, because Fabric controls every aspect of the primary UX
* Bad, because adoption friction rises when users must leave existing tools
* Bad, because host ecosystems and native extension points become underused
* Bad, because the platform risks becoming another parallel tool instead of a connective delivery system

### Option 2: Deliver Cyber Fabric Through Host-Native Plugins and Adapters

Integrate Fabric into supported hosts through native plugin mechanisms backed by a shared adapter model.

* Good, because Fabric appears where users already work
* Good, because supported hosts can preserve native UX while sharing platform semantics
* Good, because adapter-based integrations can evolve incrementally as new hosts appear
* Bad, because cross-host testing, compatibility, and maintenance effort increase
* Bad, because adapters need disciplined contracts or they will drift into separate runtimes

### Option 3: Use Loose Per-Host Scripts and Macros Without a Standard Adapter Contract

Let each host integration evolve independently with minimal shared structure.

* Good, because experimentation can begin quickly in isolated hosts
* Good, because individual integrations may optimize for local convenience
* Bad, because semantics, permissions, and orchestration behavior will drift across hosts
* Bad, because maintenance becomes repetitive and fragmented
* Bad, because the platform loses a clean way to reason about host capability differences

## More Information

This decision implies the following adapter model:

* a supported host should integrate Cyber Fabric through native plugin, extension, or adapter points whenever practical
* adapters should gather host session context, permissions, and local capabilities and present them to the shared Fabric runtime in a standard way
* adapters should render Fabric actions and results in host-appropriate UX rather than redefining platform semantics
* adapter contracts should describe host features such as subagents, background execution, tool calling, diff support, and review surfaces explicitly
* Fabric may still expose thin operational clients for automation, diagnostics, or fallback access, but those clients are not the primary architectural center

This keeps Cyber Fabric host-native for users without turning every integration into its own independent orchestration system.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-skills-cross-tool-registration`, `cpt-cyber-fabric-fr-surface-cli`, `cpt-cyber-fabric-fr-surface-vscode-plugin`, `cpt-cyber-fabric-contract-agentic-tool-host-plugin`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0005](0005-cpt-cyber-fabric-adr-minimal-installation-footprint-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric should integrate into existing agent hosts and IDEs rather than forcing one mandatory dedicated client
* supported hosts should connect to Fabric through explicit plugin or adapter contracts
* host-specific integrations should remain thin and defer real orchestration semantics to shared Fabric behavior
* the platform should preserve a coherent user and workflow model across multiple host environments
