---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0010: Extend Agent Skills Frontmatter with a Compatible External Interface Contract

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Replace Existing Frontmatter with a New Spec](#option-1-replace-existing-frontmatter-with-a-new-spec)
  - [Option 2: Preserve Existing Frontmatter and Add a Rich Interface Extension](#option-2-preserve-existing-frontmatter-and-add-a-rich-interface-extension)
  - [Option 3: Encode All Interface Data in Free-Form Skill Markdown](#option-3-encode-all-interface-data-in-free-form-skill-markdown)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-compatible-skill-interface-extension`

## Context and Problem Statement

Cyber Fabric inherits an Agent Skills style that already uses YAML frontmatter with fields such as `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`. The platform now needs richer machine-readable skill interfaces describing versions, artifact families, operations, inputs, outputs, formats, validation support, loop hints, routing hints, and traceability support levels.

Replacing the existing frontmatter outright would break compatibility with the current skill ecosystem. Relying on free-form prose in skill markdown would preserve compatibility but fail to provide a stable machine contract.

## Decision Drivers

* **Compatibility** — existing Agent Skills metadata must continue to work
* **Machine readability** — orchestrators need structured interface contracts for routing and validation
* **Evolvability** — skill interfaces will grow over time and must do so without destabilizing the base skill spec
* **Separation of concerns** — descriptive frontmatter and operational interface data should not become tangled beyond maintainability
* **Incremental adoption** — older skills should remain usable while richer interfaces are introduced

## Considered Options

1. **Replace Existing Frontmatter with a New Spec** — redesign the skill format and require migration
2. **Preserve Existing Frontmatter and Add a Rich Interface Extension** — keep compatibility and add structured interface metadata via extension fields and or a referenced file
3. **Encode All Interface Data in Free-Form Skill Markdown** — preserve compatibility and rely on prose interpretation

## Decision Outcome

Chosen option: **Option 2 — Preserve Existing Frontmatter and Add a Rich Interface Extension**, because Cyber Fabric needs stronger machine contracts without breaking the existing Agent Skills ecosystem. The base frontmatter remains minimal and compatible, while richer operational data is added through structured metadata and or a separate interface file explicitly referenced from the skill.

### Consequences

* Good, because current skills remain loadable without forced migration
* Good, because orchestrators gain a stable source of interface data for operations, inputs, outputs, and validation support
* Good, because richer contracts can evolve independently from the minimal descriptive frontmatter
* Good, because interface files can become versioned independently if needed
* Bad, because interface data now spans more than one logical layer and needs clear ownership rules
* Bad, because poorly defined extension boundaries could create duplication between frontmatter and interface files
* Bad, because tooling must handle both legacy-only and extended skills during the transition period

### Confirmation

Confirmed when:

* existing Agent Skills frontmatter remains valid and usable without breaking changes
* a skill can declare or reference structured interface data for operations, inputs, outputs, formats, validation support, loop hints, routing hints, and traceability support level
* orchestrator tooling prefers the structured interface contract when present
* migration guidance exists for legacy skills that want richer machine-readable contracts

## Pros and Cons of the Options

### Option 1: Replace Existing Frontmatter with a New Spec

Introduce a new mandatory skill specification and deprecate the current format.

* Good, because one unified spec can be cleaner on paper
* Bad, because it breaks compatibility and slows adoption
* Bad, because every existing skill must migrate before benefitting from new orchestration features
* Bad, because ecosystem continuity is lost

### Option 2: Preserve Existing Frontmatter and Add a Rich Interface Extension

Keep the compatible base spec and extend it with machine-readable operational contracts.

* Good, because it balances backward compatibility with stronger orchestration needs
* Good, because richer interface evolution can happen incrementally
* Bad, because tooling and documentation must clearly define precedence and ownership
* Bad, because mixed legacy and extended modes increase temporary complexity

### Option 3: Encode All Interface Data in Free-Form Skill Markdown

Rely on prose sections within skill documents rather than structured interface contracts.

* Good, because it avoids immediate spec design work
* Good, because humans can still read the guidance
* Bad, because routing and compatibility checking become heuristic again
* Bad, because validation of skill interfaces becomes weak and inconsistent
* Bad, because interoperability depends on prompt interpretation rather than contracts

## More Information

The rich interface contract should be able to describe at least:

* skill id and version
* artifact family
* supported operations
* per-operation inputs and outputs
* format declarations
* validation capabilities
* loop hints and routing hints
* traceability support level

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* richer interfaces must not break the existing Agent Skills frontmatter
* orchestrators need structured skill interface data
* descriptive frontmatter and operational contracts are distinct but linked layers
* the platform needs an initial schema or template for extended skill interfaces
