---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0003: Define Typed, Versioned Artifacts with Per-Artifact Format Contracts

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Standardize on JSON for All Artifacts](#option-1-standardize-on-json-for-all-artifacts)
  - [Option 2: Define Typed, Versioned Artifacts with Per-Artifact Formats](#option-2-define-typed-versioned-artifacts-with-per-artifact-formats)
  - [Option 3: Use Human-Readable Markdown for Everything](#option-3-use-human-readable-markdown-for-everything)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-typed-versioned-artifacts`

## Context and Problem Statement

Once Cyber Fabric adopts an artifact-centric execution model, it must define how artifacts remain stable enough for composition and flexible enough for mixed human and machine use. A global format decision such as "JSON everywhere" is too blunt, while ad hoc formatting per skill would create compatibility failures and validation drift.

The platform needs a contract model in which each artifact declares its identity, version, format, and governing schema or template, while format choice remains specific to the artifact family.

## Decision Drivers

* **Compatibility** — orchestrator routing must know whether one skill can consume another skill's output
* **Evolvability** — artifact shapes must change without silently breaking downstream consumers
* **Format fitness** — some outputs are machine-oriented while others are review-oriented
* **Validation** — syntax and quality checks require a declared governing contract
* **Repair stability** — repair operations should not arbitrarily change representation style

## Considered Options

1. **Standardize on JSON for All Artifacts** — every artifact uses one machine-oriented format
2. **Define Typed, Versioned Artifacts with Per-Artifact Formats** — each artifact family declares its own format and contract
3. **Use Human-Readable Markdown for Everything** — maximize readability and rely on conventions for structure

## Decision Outcome

Chosen option: **Option 2 — Define Typed, Versioned Artifacts with Per-Artifact Formats**, because Cyber Fabric needs both machine-friendly and human-friendly artifacts. Every artifact contract must declare at least `artifact_type`, `version`, `format`, and `schema_or_template`, while the platform chooses JSON, Markdown, or config-oriented formats according to the artifact's role.

### Consequences

* Good, because compatibility checking can reason over explicit artifact contracts instead of guessing from filenames or prompts
* Good, because versioning makes breaking changes explicit and manageable
* Good, because JSON can remain the default for machine-oriented intermediates while Markdown serves review and handoff artifacts
* Good, because repair flows can preserve the input artifact's format instead of forcing conversion
* Bad, because interface metadata becomes more detailed and must be maintained carefully
* Bad, because version migration strategy becomes a design concern for long-lived artifact families
* Bad, because teams must avoid overproducing near-duplicate artifact types

### Confirmation

Confirmed when:

* every first-class artifact family has a declared contract including type, version, format, and schema or template reference
* orchestrator compatibility checks reject unsupported artifact versions or incompatible formats
* repair operations preserve the original artifact format unless an explicit transform is requested
* format guidance remains artifact-specific rather than globally imposed

## Pros and Cons of the Options

### Option 1: Standardize on JSON for All Artifacts

Use one structured machine format for every skill output.

* Good, because validation tooling is straightforward
* Good, because machine parsing is consistent
* Bad, because human review artifacts become awkward and low-signal
* Bad, because rich narrative documents are harder to author and maintain
* Bad, because it overfits the platform to machine consumers only

### Option 2: Define Typed, Versioned Artifacts with Per-Artifact Formats

Declare a stable contract per artifact family and choose the best format for that family.

* Good, because it balances machine operability with human readability
* Good, because format and version become explicit compatibility dimensions
* Bad, because contract design needs stronger governance
* Bad, because migrations across versions require active management

### Option 3: Use Human-Readable Markdown for Everything

Use Markdown as the universal working format for all outputs.

* Good, because it is easy for humans to inspect and edit
* Good, because it aligns with review-centric workflows
* Bad, because strict machine validation and compatibility checks become harder
* Bad, because structured intermediate state becomes fragile and parser-dependent
* Bad, because deeply nested machine data becomes unnatural

## More Information

Preferred format selection rules for Cyber Fabric are:

* JSON for structured machine-oriented intermediate artifacts
* Markdown for human-readable documents, reports, and handoff summaries
* YAML or TOML mainly for manifests and configuration, not primary working outputs
* repair operations preserve the format of the input artifact by default

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* artifacts must declare type and version
* format is chosen per artifact rather than globally
* orchestrator compatibility checking depends on explicit artifact contracts
* first-class artifacts need a published minimum contract
