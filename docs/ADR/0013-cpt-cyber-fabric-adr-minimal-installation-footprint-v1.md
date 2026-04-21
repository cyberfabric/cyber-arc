---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0013: Install the System with a Minimal Project-Local Footprint

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Full Local Installation with Rich Project State](#option-1-full-local-installation-with-rich-project-state)
  - [Option 2: Minimal Project-Local Footprint with On-Demand Integration](#option-2-minimal-project-local-footprint-with-on-demand-integration)
  - [Option 3: Fully Remote Managed Installation](#option-3-fully-remote-managed-installation)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-minimal-installation-footprint`

## Context and Problem Statement

Cyber Fabric is intended to operate across local IDE workflows, CLI usage, and future centralized environments. If every installation writes substantial project-local state, generated assets, caches, and integration scaffolding into each repository, adoption becomes heavier, upgrades become riskier, and repository hygiene degrades over time. Teams also become more cautious about trying the system when installation feels invasive.

The platform therefore needs an installation model with a minimal project-local footprint. Only the smallest set of project-bound configuration and reviewable artifacts should live inside the repository, while heavier runtime logic, integrations, caches, and optional capabilities should remain external, shared, or activated on demand.

## Decision Drivers

* **Adoptability** — teams should be able to start using the system without major repository mutation
* **Repository hygiene** — installation should not litter projects with unnecessary generated state
* **Upgrade safety** — fewer local moving parts reduce update risk and merge friction
* **Portability** — the same project should move easily across IDE, CLI, and centralized environments
* **Reviewability** — project-local state should stay small enough to inspect, diff, and understand
* **Operational efficiency** — heavy logic and optional integrations should be loaded only when needed

## Considered Options

1. **Full Local Installation with Rich Project State** — install broad runtime state, generated integrations, caches, templates, and tooling directly into every project
2. **Minimal Project-Local Footprint with On-Demand Integration** — keep only essential project-bound state locally and load the rest externally or when needed
3. **Fully Remote Managed Installation** — avoid almost all local state and depend primarily on centralized infrastructure

## Decision Outcome

Chosen option: **Option 2 — Minimal Project-Local Footprint with On-Demand Integration**, because Cyber Fabric must feel lightweight enough for local adoption while still supporting powerful orchestration and extensibility. The repository should contain only essential project-specific configuration, explicitly reviewed artifacts, and a minimal integration surface. Heavy runtime logic, caches, generated agent wiring, and optional capabilities should be externalized, shared, or materialized only when they are actually needed.

### Consequences

* Good, because installation becomes less invasive and easier to adopt in existing repositories
* Good, because upgrades and synchronization involve fewer project-local files
* Good, because repository diffs remain focused on intentional product artifacts rather than runtime noise
* Good, because optional integrations and heavy capabilities can evolve without bloating every project checkout
* Good, because local and centralized modes can share one conceptual model without requiring the same footprint everywhere
* Bad, because more capability has to be discovered or materialized dynamically at runtime
* Bad, because tooling must clearly distinguish required local state from external or generated state
* Bad, because debugging may span both project-local and external layers instead of one obvious directory tree

### Confirmation

Confirmed when:

* a project can adopt Cyber Fabric without introducing a large amount of generated or opaque local state
* only essential project-bound configuration and reviewable artifacts are stored in the repository
* optional integrations, caches, and heavy execution logic can remain outside the project or be generated on demand
* upgrades do not require broad repository rewrites for normal capability evolution

## Pros and Cons of the Options

### Option 1: Full Local Installation with Rich Project State

Install broad runtime state, generated assets, and integration scaffolding directly into each project.

* Good, because everything is visible in one place
* Good, because some workflows may work without any external lookup
* Bad, because repository footprint grows quickly
* Bad, because updates become noisier and more fragile
* Bad, because teams may resist installation in established repositories

### Option 2: Minimal Project-Local Footprint with On-Demand Integration

Keep project-local state intentionally small and materialize the rest only when needed.

* Good, because it balances local usability with operational lightness
* Good, because the repository remains cleaner and easier to review
* Good, because installation and removal become less disruptive
* Bad, because tooling for discovery, synchronization, and lazy materialization must be reliable
* Bad, because operational boundaries between local and external state must be documented clearly

### Option 3: Fully Remote Managed Installation

Depend primarily on centralized infrastructure and keep almost nothing project-local.

* Good, because local repos remain very clean
* Good, because some upgrades can be centralized
* Bad, because local-first workflows become weaker
* Bad, because offline and IDE-native usage suffer
* Bad, because repository-specific reviewable configuration may become too detached from the project itself

## More Information

A minimal-footprint installation model generally implies:

* keep only essential project-specific configuration locally
* keep reviewable product artifacts in the repository when they are part of delivery output
* avoid persisting large caches, generated runtime state, or duplicated integration assets in the project by default
* generate or sync agent-specific wiring only when required
* prefer shared or external runtime components when they do not need to be versioned with the project

This decision aligns with Cyber Fabric's goal of being lightweight enough for local use while still supporting richer orchestration and collaboration models.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* the system should be installable without a large local footprint
* only essential project-bound state should live in the repository
* optional integrations and heavy runtime state should be externalized or materialized on demand
* project-local changes should remain reviewable and intentionally small
