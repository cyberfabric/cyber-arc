---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0008: Deliver All Extensions and Prompts Through Kits with Global, Workspace, and Core-Bundled Scopes

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Multiple Parallel Extension Mechanisms](#option-1-multiple-parallel-extension-mechanisms)
  - [Option 2: Kits as the Universal Extension Mechanism with Three Delivery Scopes](#option-2-kits-as-the-universal-extension-mechanism-with-three-delivery-scopes)
  - [Option 3: Kits Only at One Global Scope](#option-3-kits-only-at-one-global-scope)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism`

## Context and Problem Statement

Cyber Fabric needs a single, predictable extension model. ADR-0006 already establishes that skills are distributed as kit packages and registered into agent runtimes through a central tool, but the platform still needs to decide whether kits are the *only* mechanism through which Fabric can be extended, where kits are allowed to live, and how kits that physically ship with the Fabric core relate to standalone ones.

If the platform allows several parallel extension surfaces — kits plus ad hoc plugins plus loose scripts plus baked-in core capabilities — the integration model fragments and the central registration tool becomes one option among many. If kits are restricted to a single global scope, project- and workspace-specific extensions become awkward and have to be reinvented through other paths. If core-bundled extensions are treated as something fundamentally different from kits, the platform ends up with two parallel concepts of "extension" with diverging metadata, lifecycle, and tooling.

## Decision Drivers

* **Single extension surface** — there should be one mechanism through which Fabric is extended, not several
* **Scope flexibility** — kits must be installable globally, per workspace, or shipped with the core itself
* **Core uniformity** — capabilities bundled with the Fabric core should still look and behave like kits, not like a privileged second mechanism
* **Versioning clarity** — core-bundled kits must not invent independent semver that drifts from the Fabric tool that ships them
* **Tooling reuse** — installation, registration, validation, and discovery should work the same way regardless of where a kit lives
* **Predictable mental model** — users should always know that "to extend Fabric, ship a kit"

## Considered Options

1. **Multiple Parallel Extension Mechanisms** — allow kits, ad hoc plugins, raw script integrations, and baked-in core extensions to coexist as separate concepts
2. **Kits as the Universal Extension Mechanism with Three Delivery Scopes** — every prompt and every extension is delivered as a kit, and a kit may live globally, per workspace, or be physically bundled with the Fabric core; core-bundled kits inherit the Fabric tool's own version
3. **Kits Only at One Global Scope** — kits remain the only mechanism, but they exist only at a single global registry; per-workspace or core-bundled kits are not modeled

## Decision Outcome

Chosen option: **Option 2 — Kits as the Universal Extension Mechanism with Three Delivery Scopes**, because Cyber Fabric needs one coherent extension surface that still allows extensions to live where they actually belong. All prompts and all extensions in Cyber Fabric are delivered through kits, and a kit is THE entry point of the Fabric tool — there is no parallel extension mechanism. A kit may live in one of three scopes: **global** (user-level, available across all the user's projects), **workspace / project** (repo-local, scoped to one project or workspace), or **core-bundled** (physically shipped with the Fabric tool itself as part of its release). Core-bundled kits do not carry an independent semver: their version *is* the version of the Fabric tool that ships them, and they cannot be upgraded or downgraded independently of that release. Standalone kits — both global and workspace-scoped — version themselves independently.

### Consequences

* Good, because the platform has exactly one mental model and one tool surface for extending Fabric
* Good, because kits at different scopes can be discovered, validated, and registered through the same machinery instead of separate code paths
* Good, because workspace-scoped kits make project-specific prompts and extensions first-class without inventing a parallel system
* Good, because core-bundled kits remain inspectable like any other kit, while their version question is answered unambiguously by the Fabric release version
* Good, because removing the "core extension" / "user plugin" split removes a class of integration drift bugs
* Bad, because the kit format and registration contract must be expressive enough to cover all three scopes
* Bad, because scope-specific resolution rules (which kit wins when the same kit identity appears at multiple scopes) need an explicit policy
* Bad, because core-bundled kits losing independent versioning means they cannot be patched out-of-band from a Fabric release

### Confirmation

Confirmed when:

* every prompt and every extension shipped with or installed into Cyber Fabric is materialized as a kit, with no parallel non-kit extension mechanism
* the central registration tool can discover and register kits at the global, workspace, and core-bundled scopes through one mechanism
* core-bundled kits expose their version as the Fabric tool's release version and are not assigned an independent semver
* standalone kits, whether global or workspace-scoped, are versioned independently from the Fabric tool
* documentation and tooling describe the three scopes as variants of one model rather than as separate extension systems

## Pros and Cons of the Options

### Option 1: Multiple Parallel Extension Mechanisms

Allow kits, ad hoc plugins, raw script integrations, and core extensions to coexist as separate concepts.

* Good, because each subsystem can be optimized in isolation in the short term
* Good, because experiments may move quickly without going through kit packaging
* Bad, because users must learn several extension surfaces to reason about Fabric
* Bad, because central registration becomes one option among many rather than the authoritative path
* Bad, because every cross-cutting concern such as validation, discovery, or upgrade has to be reimplemented per surface

### Option 2: Kits as the Universal Extension Mechanism with Three Delivery Scopes

Every prompt and every extension is a kit, and kits may live globally, per workspace, or as part of the Fabric core itself, with core-bundled kits inheriting the Fabric tool's version.

* Good, because the extension story collapses into one consistent concept
* Good, because the same packaging, registration, and validation tooling covers every scope
* Good, because workspace-scoped kits give projects a clean way to ship project-specific extensions
* Good, because the version of a core-bundled kit is unambiguous — it is the Fabric tool's version
* Bad, because cross-scope precedence and conflict resolution must be made explicit
* Bad, because the kit format must accommodate metadata that is meaningful at all three scopes

### Option 3: Kits Only at One Global Scope

Keep kits as the universal mechanism but allow only a single global registry — no per-workspace and no core-bundled kits.

* Good, because the scope model is trivially simple
* Good, because there is only ever one place to look for installed kits
* Bad, because project-specific extensions have to be reinvented through a different mechanism, defeating the universality goal
* Bad, because everything bundled with Fabric core has to be modeled as something other than a kit, which reintroduces the parallel-mechanism problem
* Bad, because kit discovery loses the natural "follow the project, follow the workspace" pattern users expect

## More Information

The three kit scopes have the following intent:

* **Core-bundled kits** ship physically as part of the Fabric tool's release; their version equals the Fabric tool's version and they are upgraded together with Fabric itself
* **Global kits** are installed at the user level and apply across the user's projects, similar to globally installed development tools
* **Workspace kits** live inside a specific project or workspace and are scoped to that repository

Cross-scope precedence — which kit wins when the same kit identity is present at multiple scopes — conflict reporting, and the exact metadata that marks a kit as core-bundled are intentionally left to follow-on design work that builds on this decision.

**Core-bundled scope criteria.** A kit is appropriate for the core-bundled scope only when it satisfies all of the following: (1) it provides platform primitives, not opinionated workflows or methodologies; (2) without it, Fabric loses a foundational capability — Fabric cannot function meaningfully or some specified ADR is unfulfilled; (3) it is universally applicable to all Fabric users, not specific to a methodology or industry; (4) it is tightly versioned with Fabric — its content evolves in lock-step with Fabric releases and cannot reasonably be released independently; (5) only Fabric maintainers can author it correctly — the platform integration is too deep for community delivery to consistently meet quality bars. Opinionated workflow kits (planners, methodology toolkits, framework-specific kits) belong in marketplace, not in core. The current core-bundled set is just `core` (per ADR-0030); the GitHub provider implementation (per ADR-0023) lives within `core` under the `core:github.<name>` sub-namespace rather than as a separate core-bundled kit. Future additions to the core-bundled set must clear all five criteria.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-kits-only-extension-mechanism`, `cpt-cyber-fabric-fr-kits-three-scopes`, `cpt-cyber-fabric-fr-distribution-core-kit`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md)

This decision directly addresses the following traceability items:

* every prompt and every extension must be delivered through a kit
* a kit is the single entry point through which Fabric is extended
* kits must support global, workspace, and core-bundled scopes through one model
* core-bundled kits inherit the Fabric tool's version and have no independent semver
* standalone kits version themselves independently
