---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0014: Generate Agent Prompts Exclusively Through a Tool from Layered TOML Skill Definitions

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Hand-Author Agent Prompts as Monolithic Text Files](#option-1-hand-author-agent-prompts-as-monolithic-text-files)
  - [Option 2: Generate Agent Prompts Through a Tool from Extensible TOML Skill Definitions and Prompt Slices](#option-2-generate-agent-prompts-through-a-tool-from-extensible-toml-skill-definitions-and-prompt-slices)
  - [Option 3: Store Fully Expanded Prompt Outputs Directly in Project Config](#option-3-store-fully-expanded-prompt-outputs-directly-in-project-config)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-tool-generated-layered-prompts`

## Context and Problem Statement

Cyber Fabric needs a prompt system that is deterministic enough for tooling, extensible enough for skill evolution, and override-friendly enough for project and user customization. Hand-authored monolithic prompt files make composition, patching, and precise overrides difficult. They also blur the boundary between source configuration and generated runtime output.

The platform therefore needs one authoritative tool that generates agent prompts from structured skill definitions. Skills should be expressed as extensible TOML files, and prompt content should be represented as small ordered text slices rather than one opaque prompt blob. Each slice line should have its own stable identifier and ordering so users can remove, replace, add, or reorder prompt lines predictably.

## Decision Drivers

* **Deterministic generation** — prompt assembly should come from a repeatable tool-driven process
* **Extensibility** — skills should evolve through structured configuration rather than fragile text surgery
* **Override precision** — users should be able to remove, replace, add, or reorder prompt content surgically
* **Layering** — project-specific prompt behavior must take precedence without forking the default prompt base
* **Reviewability** — prompt sources and overrides should remain inspectable and diffable
* **Tooling leverage** — validation, merging, and generation should operate on structured data, not only raw text blobs

## Considered Options

1. **Hand-Author Agent Prompts as Monolithic Text Files** — prompts are written and overridden directly as large text documents
2. **Generate Agent Prompts Through a Tool from Extensible TOML Skill Definitions and Prompt Slices** — structured TOML skills and ordered line slices are the source of truth
3. **Store Fully Expanded Prompt Outputs Directly in Project Config** — treat generated prompt text as the main editable configuration artifact

## Decision Outcome

Chosen option: **Option 2 — Generate Agent Prompts Through a Tool from Extensible TOML Skill Definitions and Prompt Slices**, because Cyber Fabric needs prompt configuration to be both structured and overrideable. Skills are authored as extensible TOML files, while the agent-facing prompt is generated exclusively by the tool. Prompt content is modeled as small text slices, effectively line by line, with each line carrying a stable identifier and explicit order. Users may then override prompt content by removing, replacing, adding, or reordering slices in higher-priority layers.

The override precedence is:

1. **Project prompt layer** — highest priority
2. **Outside-project user layer** — next priority
3. **Default prompt layer** — fallback base

### Consequences

* Good, because prompt generation becomes deterministic and centrally governed
* Good, because skills gain a structured, extensible TOML representation instead of relying on large hand-maintained prompt files
* Good, because users can override prompts surgically at line granularity rather than copying and editing whole prompt documents
* Good, because users can change the relative position of prompt slices without rewriting the whole prompt body
* Good, because precedence rules are explicit and predictable
* Good, because the same prompt source model can support local project overrides and personal external customization
* Bad, because the generation tool becomes a critical dependency for prompt materialization
* Bad, because line-level slicing introduces more metadata that must remain stable across versions
* Bad, because debugging final prompt output requires visibility into merge layers, ordering rules, and generation steps

### Confirmation

Confirmed when:

* agent prompts are materialized only through the generation tool, not maintained as hand-authored runtime prompts
* skill definitions are stored in extensible TOML form
* prompt slices carry stable identifiers and explicit ordering at line granularity
* users can remove, replace, add, and reorder prompt slices through override layers
* precedence is enforced as project layer, then outside-project layer, then default layer

## Pros and Cons of the Options

### Option 1: Hand-Author Agent Prompts as Monolithic Text Files

Maintain prompts directly as large text documents and override them by editing copies.

* Good, because it is initially simple to read and edit
* Good, because no dedicated generation tool is required at first
* Bad, because precise overrides are difficult and brittle
* Bad, because merging and diffing prompt behavior becomes coarse-grained
* Bad, because prompt customization often leads to copy-and-fork maintenance

### Option 2: Generate Agent Prompts Through a Tool from Extensible TOML Skill Definitions and Prompt Slices

Treat structured skill TOML and ordered prompt slices as the source of truth, then generate final prompts through the tool.

* Good, because prompt assembly, overrides, and validation can be handled structurally
* Good, because users can customize behavior without replacing entire prompt files
* Good, because prompt precedence and ordering are explicit and governable
* Bad, because the tool and slice metadata must be designed carefully
* Bad, because final prompt debugging needs good inspection tooling

### Option 3: Store Fully Expanded Prompt Outputs Directly in Project Config

Write the expanded prompt text itself into project configuration and treat that as the editable source.

* Good, because the final prompt is visible locally
* Good, because runtime can read one direct artifact
* Bad, because expanded output is a poor source-of-truth format for structured overrides
* Bad, because project-local footprint increases with generated prompt state
* Bad, because user-specific and project-specific concerns become harder to separate cleanly

## More Information

This decision implies the following model:

* skills are represented as extensible TOML files
* prompt generation is performed exclusively by the tool
* prompt content is stored as small ordered text slices
* each line slice has at least a stable identifier and an order field
* higher-priority layers may remove, replace, append, or reorder slices
* final prompt assembly must preserve deterministic ordering after overrides are applied

This design keeps prompt authoring structured, makes overrides predictable, and avoids treating large generated prompt blobs as the primary editable artifact.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* agent prompts should be generated exclusively by the tool
* skills should be represented as extensible TOML files
* prompt content should be sliceable into small ordered units with stable line identifiers
* users should be able to remove, replace, add, and reorder prompt slices through layered overrides
* prompt precedence should be project layer, then outside-project layer, then default layer
