---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0011: Distribute Skills as Kit Packages with a Central Agent Registration Tool

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Ship Skills as Core Built-Ins](#option-1-ship-skills-as-core-built-ins)
  - [Option 2: Install Skills as Kit Packages and Register Them Through a Central Tool](#option-2-install-skills-as-kit-packages-and-register-them-through-a-central-tool)
  - [Option 3: Copy Skill Files Manually into Each Agent Environment](#option-3-copy-skill-files-manually-into-each-agent-environment)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-kit-packaged-pluggable-skills`

## Context and Problem Statement

Cyber Fabric is intended to host an ecosystem of small, composable skills rather than one fixed closed set of built-in capabilities. If skills are embedded directly into the core product or maintained separately for each agent runtime, the platform becomes harder to extend, harder to upgrade, and more vulnerable to integration drift between IDE agents, CLI integrations, and future centralized runtimes.

The platform therefore needs a distribution and integration model in which skills are installable as pluggable packages, while one central tool is responsible for registering those installed skills into agent environments. Without that central registration point, each agent integration would become its own partial plugin system with different conventions, capabilities, and failure modes.

## Decision Drivers

* **Pluggability** — the platform must be extensible without modifying the core system for every new skill family
* **Consistency across agents** — the same installed capability set should be registerable into different agent runtimes predictably
* **Operational simplicity** — installation, upgrade, and removal should use one repeatable model
* **Governance** — skill packaging and registration need validation, versioning, and compatibility control
* **Ecosystem growth** — external and internal teams should be able to add bounded capabilities without forking the platform

## Considered Options

1. **Ship Skills as Core Built-Ins** — keep most or all skills directly inside the core product and agent integrations
2. **Install Skills as Kit Packages and Register Them Through a Central Tool** — treat skill sets as installable kits and use one authoritative tool to register them into agents
3. **Copy Skill Files Manually into Each Agent Environment** — distribute skill assets ad hoc per runtime or repository

## Decision Outcome

Chosen option: **Option 2 — Install Skills as Kit Packages and Register Them Through a Central Tool**, because Cyber Fabric needs a truly pluggable architecture rather than a hard-coded skill catalog. Skills are distributed as kit packages, and a central registration tool is the control point that discovers installed kits, validates their metadata and interfaces, and materializes agent-specific registrations from one authoritative source of truth.

### Consequences

* Good, because new skill families can be added as packages instead of core product edits
* Good, because installation and upgrade flows become explicit and repeatable
* Good, because different agent runtimes can be generated or synchronized from the same installed kit set
* Good, because validation and compatibility checks can happen before skills are exposed to agents
* Good, because the product can grow an ecosystem of kits while preserving one integration contract
* Bad, because kit packaging standards and registration contracts must be maintained carefully
* Bad, because the central registration tool becomes a strategically important dependency
* Bad, because packaging mistakes can affect multiple downstream agent integrations until caught by validation

### Confirmation

Confirmed when:

* new skill capabilities are delivered primarily as installable kit packages rather than hard-coded agent-specific assets
* one central tool is responsible for discovering installed kits and registering their skills into supported agent environments
* agent integrations can be regenerated or refreshed from kit metadata without hand-editing each runtime separately
* installation, update, and registration failures produce explicit validation errors rather than silent agent drift

## Pros and Cons of the Options

### Option 1: Ship Skills as Core Built-Ins

Keep skills bundled directly with the core platform and expose them through agent-specific built-in integrations.

* Good, because the initial product surface can be simpler to reason about
* Good, because one repository can control the full default experience tightly
* Bad, because every new skill or extension requires core changes and release coordination
* Bad, because the platform becomes less pluggable and less ecosystem-friendly
* Bad, because agent-specific integrations tend to diverge when capabilities are not packaged independently

### Option 2: Install Skills as Kit Packages and Register Them Through a Central Tool

Treat skill families as installable kits, and use one authoritative tool to map installed kits into agent integrations.

* Good, because pluggability becomes a first-class architectural property
* Good, because packaging, versioning, compatibility, and registration can be governed consistently
* Good, because the same kit can feed multiple agents without duplicating authoring effort
* Bad, because the packaging and registration model requires disciplined metadata and tooling
* Bad, because the central tool must stay compatible with multiple agent targets

### Option 3: Copy Skill Files Manually into Each Agent Environment

Move or duplicate skill assets manually into every runtime or repository that needs them.

* Good, because it works for quick experimentation with little tooling
* Bad, because it does not scale operationally
* Bad, because version drift and configuration drift become likely
* Bad, because there is no authoritative registration or compatibility checkpoint
* Bad, because removal and upgrade workflows become error-prone

## More Information

The central registration tool is not just an installer. It is the integration control plane for the skill ecosystem. At minimum, it should:

* discover installed kit packages
* resolve their declared skill interfaces and compatibility metadata
* validate whether they can be exposed to a target agent runtime
* register or generate the corresponding agent-facing skill entries
* refresh registrations when kit sets change

This keeps the system pluggable while ensuring that the agent-facing surface remains generated from one authoritative packaging model instead of many unrelated manual integration paths.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* skills must be installable as extension packages rather than only core built-ins
* the platform should use kits as the extensibility unit for skill delivery
* one central tool must register installed skills into agent integrations
* installed kit metadata should drive agent-facing skill registration
* kit-packaged skills need a minimum packaging and registration contract
