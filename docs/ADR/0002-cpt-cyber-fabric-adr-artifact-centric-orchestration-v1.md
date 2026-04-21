---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0002: Use Artifact-Centric Orchestration as the Primary Execution Model

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Free-Form Conversational State](#option-1-free-form-conversational-state)
  - [Option 2: Artifact-Centric Orchestration](#option-2-artifact-centric-orchestration)
  - [Option 3: Tool-Execution Logs as the Main System State](#option-3-tool-execution-logs-as-the-main-system-state)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-artifact-centric-orchestration`

## Context and Problem Statement

Cyber Fabric needs a stable way to move work across planning, generation, validation, repair, review, and human handoff. If the platform treats free-form model text as the main state, downstream automation becomes brittle, validation becomes ambiguous, and multi-step execution becomes difficult to resume or audit.

The platform therefore needs a primary execution model in which work products are explicit artifacts with known meaning, stable shape, and downstream reuse value.

## Decision Drivers

* **Durability** — multi-step work must survive retries, handoffs, and partial failure
* **Validation** — outputs must be checkable by deterministic and semantic validators
* **Reuse** — downstream skills need stable handoff surfaces
* **Auditability** — users and reviewers need to inspect what changed and why
* **Human collaboration** — documents, reports, and summaries must remain readable when required

## Considered Options

1. **Free-Form Conversational State** — keep intermediate results mainly as chat text
2. **Artifact-Centric Orchestration** — treat explicit typed artifacts as the primary working state
3. **Tool-Execution Logs as the Main System State** — treat command histories and tool events as the main source of truth

## Decision Outcome

Chosen option: **Option 2 — Artifact-Centric Orchestration**, because Cyber Fabric is intended to bridge intent, design, implementation, validation, and review through inspectable handoffs. Artifacts provide the stable contract needed for composition, traceability, validation, and human review.

### Consequences

* Good, because each pipeline step produces a reusable and inspectable result instead of disappearing into chat history
* Good, because validation can target declared artifact structure and quality expectations
* Good, because human and machine consumers can share the same working outputs when formats are chosen appropriately
* Good, because change management becomes diffable and reviewable
* Bad, because artifact management introduces versioning and storage discipline
* Bad, because some lightweight exploratory interactions become more formal than a purely conversational flow
* Bad, because artifact contracts must be designed carefully to avoid accidental rigidity

### Confirmation

Confirmed when:

* orchestrated workflows exchange typed artifacts as their primary outputs
* intermediate outputs can be resumed, reviewed, or revalidated without reconstructing chat history
* downstream skills declare which artifact families and versions they accept
* review workflows and human handoff flows operate on persisted artifacts rather than transient model text alone

## Pros and Cons of the Options

### Option 1: Free-Form Conversational State

Let models exchange work mainly through raw text responses and conversation memory.

* Good, because it is fast to prototype
* Good, because it minimizes up-front structure
* Bad, because downstream automation is fragile
* Bad, because validation and compatibility checking become heuristic
* Bad, because audit and reuse degrade as flows become longer

### Option 2: Artifact-Centric Orchestration

Represent each meaningful work product as an explicit artifact with a declared contract.

* Good, because it creates durable handoff surfaces across skills and humans
* Good, because it makes validation and recovery tractable
* Bad, because artifact lifecycle management becomes a first-class concern
* Bad, because authors must care about format, versioning, and boundaries

### Option 3: Tool-Execution Logs as the Main System State

Use execution traces, commands, and event logs as the principal source of state.

* Good, because operational traces are useful for debugging
* Good, because it captures what happened at runtime
* Bad, because logs explain execution history, not business meaning
* Bad, because logs are poor substitutes for reusable domain artifacts
* Bad, because human review still needs summarized or structured outputs

## More Information

This decision turns artifacts into the common currency between skill pipelines, review flows, and human collaboration. It also establishes the precondition for typed formats, layered validation, optional traceability, and stable cross-repository coordination.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* skills must emit artifacts, not only free-form prose
* outputs must remain usable by downstream skills
* pipelines use artifacts as the durable state boundary
* Cyber Fabric should define its initial core artifact families
