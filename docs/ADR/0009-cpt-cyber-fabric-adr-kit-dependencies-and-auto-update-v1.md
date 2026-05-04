---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0009: Define Kit Dependencies and Auto-Update Policy

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Declared Inter-Kit Dependencies](#option-1-no-declared-inter-kit-dependencies)
  - [Option 2: Declared Semver Dependencies and Per-Kit Auto-Update Policy](#option-2-declared-semver-dependencies-and-per-kit-auto-update-policy)
  - [Option 3: One Blanket Platform-Wide Update Policy](#option-3-one-blanket-platform-wide-update-policy)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-kit-dependencies-and-auto-update`

## Context and Problem Statement

Once kits are the universal extension mechanism (ADR-0008) and are packaged and registered through one central tool (ADR-0006), Cyber Fabric still has to decide how kits relate to each other and how they evolve over time. Kits frequently build on top of other kits — for example a domain kit may rely on a base prompt-generation kit or on shared helper kits — and the platform needs a deterministic way to express those relationships. Separately, kits change versions, and operators need a way to control how aggressively a kit picks up new versions without re-deciding the policy for every kit on every release.

If kit-to-kit dependencies are not modeled at all, every install becomes a manual coordination problem and version skew can silently break a kit's prompts or extensions. If a single platform-wide update cadence is forced on all kits, operators lose the ability to mix conservative and aggressive update strategies — for example, pinning a critical kit while still letting low-risk kits float. If only one kind of dependency expression is supported (only strict pins, or only ranges), authors are forced into either brittle lock-step or unbounded compatibility promises.

## Decision Drivers

* **Composability** — kits must be able to depend on other kits in a way the platform can resolve deterministically
* **Authoring expressiveness** — kit authors must be able to choose between strict pinning and minimum / range constraints depending on stability needs
* **Operational control** — operators must be able to decide independently whether a kit auto-pulls major, minor, or patch upgrades
* **Predictability** — the same dependency expression and update declaration must produce the same resolution behavior across environments
* **Per-kit granularity** — update policy belongs on the individual kit, not as a single global setting that flattens different risk profiles
* **Tooling reuse** — dependency resolution and update policy must be readable by the same central registration and installation machinery from ADR-0006

## Considered Options

1. **No Declared Inter-Kit Dependencies** — treat each kit as standalone; users manually install whatever a kit needs
2. **Declared Semver Dependencies and Per-Kit Auto-Update Policy** — a kit declares its dependencies on other kits using two semver expression kinds (strict pinned `==X.Y.Z` and minimum / range `>=X.Y.Z`), and declares its own auto-update policy as three independent flags `latest:[major=Y|N, minor=Y|N, patch=Y|N]`
3. **One Blanket Platform-Wide Update Policy** — kits declare dependencies, but update behavior is set globally for all kits at once

## Decision Outcome

Chosen option: **Option 2 — Declared Semver Dependencies and Per-Kit Auto-Update Policy**, because Cyber Fabric needs deterministic, expressive composition between kits and per-kit control over how aggressively each kit pulls in new versions. A kit declares its dependencies on other kits using exactly two kinds of semver expression: **strict pinned** (`==X.Y.Z`), which requires that exact version, and **minimum / range** (`>=X.Y.Z`), which accepts that version or any later compatible release. A kit also declares its auto-update policy as `latest:[major=Y|N, minor=Y|N, patch=Y|N]`, where each of the three flags independently controls whether major, minor, or patch upgrades of that kit are pulled automatically. The flags are orthogonal: a kit can, for example, opt into automatic patches while pinning major and minor manually.

### Consequences

* Good, because composing kits becomes a structured operation that the central tool can resolve and validate
* Good, because authors can express both "exact version required" and "this baseline or newer" without inventing custom syntax
* Good, because operators can mix conservative and aggressive update strategies across the kit set
* Good, because update behavior is described per kit and travels with the kit rather than living as ambient global state
* Good, because the three orthogonal update flags map cleanly to semver levels and are easy to reason about
* Bad, because dependency resolution must produce clear errors when constraints are unsatisfiable across a kit graph
* Bad, because mixing strict pins and ranges across many kits can still produce conflicts that need explicit reporting
* Bad, because the auto-update policy must be re-evaluated by tooling at install or refresh time, which adds work to the registration pipeline

### Confirmation

Confirmed when:

* a kit can declare dependencies on other kits using strict (`==X.Y.Z`) and minimum / range (`>=X.Y.Z`) semver expressions
* the central registration and installation tool resolves those dependencies deterministically and reports unsatisfiable constraints explicitly
* a kit can declare an auto-update policy of the form `latest:[major=Y|N, minor=Y|N, patch=Y|N]` with three independent flags
* the three update flags are honored independently, so a kit can opt into one level of automatic upgrade without opting into another
* the policy is read by the same tooling that handles kit packaging and registration rather than by a separate update subsystem

## Pros and Cons of the Options

### Option 1: No Declared Inter-Kit Dependencies

Treat each kit as standalone and require users to install whatever a kit implicitly needs.

* Good, because the kit format stays minimal initially
* Good, because there is no resolver to design and maintain
* Bad, because composition becomes a manual coordination problem
* Bad, because version skew between kits goes undetected until something breaks at runtime
* Bad, because the platform loses a chance to validate kit graphs before exposing them to agents

### Option 2: Declared Semver Dependencies and Per-Kit Auto-Update Policy

Allow kits to declare dependencies with strict pins or minimum / range constraints, and let each kit declare its own auto-update policy across major, minor, and patch levels independently.

* Good, because composition is structured and resolvable
* Good, because authoring expressiveness covers both lock-step and forward-compatible patterns
* Good, because update aggressiveness is a per-kit decision that matches per-kit risk
* Bad, because resolver design and conflict reporting must be done carefully
* Bad, because operators must understand the difference between the dependency expression and the update policy

### Option 3: One Blanket Platform-Wide Update Policy

Let kits declare dependencies but force all kits to follow one global update cadence.

* Good, because the operator has only one knob to set
* Good, because the global behavior is easy to describe in documentation
* Bad, because conservative kits cannot coexist with aggressive kits under one shared policy
* Bad, because the policy ends up at the wrong abstraction level — risk varies per kit, not per platform
* Bad, because operators lose the ability to pin a critical kit while letting low-risk kits float

## More Information

The two dependency expression kinds have the following intent:

* `==X.Y.Z` — strict pinned: the kit requires exactly that version of the dependency; no other version satisfies the constraint
* `>=X.Y.Z` — minimum / range: the kit accepts that version or any later compatible release of the dependency

The auto-update policy has the form `latest:[major=Y|N, minor=Y|N, patch=Y|N]`, where each flag is an independent yes/no:

* `major=Y` — automatically pull major version bumps
* `minor=Y` — automatically pull minor version bumps
* `patch=Y` — automatically pull patch version bumps

The three flags are orthogonal: a kit can declare `latest:[major=N, minor=N, patch=Y]` to receive only patch upgrades automatically while requiring manual review for minor and major changes, or `latest:[major=N, minor=Y, patch=Y]` for forward-compatible non-major updates, and so on.

Resolver behavior across a full kit graph — for example how strict pins interact with overlapping range constraints, or how core-bundled kits' fixed-by-Fabric version interacts with standalone kits' declared constraints — is intentionally left to follow-on design work that builds on this decision.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-kits-dependencies-and-auto-update`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md)

This decision directly addresses the following traceability items:

* kits may declare dependencies on other kits
* dependency expressions support both strict pinning (`==semver`) and minimum / range (`>=semver`)
* kits may declare a per-kit auto-update policy
* the auto-update policy uses three orthogonal flags for major, minor, and patch upgrades
* dependency and update behavior is read by the same tooling that handles kit packaging and registration
