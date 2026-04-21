---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0006: Separate Syntactic and Semantic Validation Layers

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: One Unified Validation Pass](#option-1-one-unified-validation-pass)
  - [Option 2: Separate Syntactic and Semantic Validation Layers](#option-2-separate-syntactic-and-semantic-validation-layers)
  - [Option 3: Semantic Review Only](#option-3-semantic-review-only)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-layered-validation`

## Context and Problem Statement

Artifacts can fail in more than one way. Some failures are structural: missing sections, malformed references, invalid schema, wrong format. Others are semantic: incomplete reasoning, weak coverage, inconsistent claims, missing trace links, or poor quality. Treating these concerns as one undifferentiated validation step makes failure analysis less actionable and pushes deterministic checks into subjective review paths.

Cyber Fabric needs a layered validation model that distinguishes structural correctness from substantive quality.

## Decision Drivers

* **Actionability** — users need to know whether a failure is structural or substantive
* **Determinism** — machine-checkable failures should be separated from heuristic quality judgments
* **Pipeline efficiency** — cheap structural failures should block expensive semantic review early
* **Governance** — quality criteria should evolve without weakening contract enforcement
* **Recovery design** — different failure types require different repair strategies

## Considered Options

1. **One Unified Validation Pass** — treat all validation as one combined step
2. **Separate Syntactic and Semantic Validation Layers** — run structural checks distinctly from quality checks
3. **Semantic Review Only** — rely mainly on review-style evaluation and skip strong structural validation

## Decision Outcome

Chosen option: **Option 2 — Separate Syntactic and Semantic Validation Layers**, because Cyber Fabric must distinguish "this artifact is malformed" from "this artifact is well-formed but insufficient." Syntactic validation enforces schema, template, and format constraints; semantic validation evaluates completeness, consistency, coverage, traceability quality, and broader fitness.

### Consequences

* Good, because structural failures can be caught early and repaired deterministically
* Good, because semantic review can focus on higher-value quality questions
* Good, because validation reports become more actionable for users and orchestrators
* Good, because different validators can evolve independently
* Bad, because orchestration becomes more layered and requires better reporting
* Bad, because users may initially perceive more validation stages as more complexity
* Bad, because some borderline cases will still require judgment on which layer should own them

### Confirmation

Confirmed when:

* every first-class artifact can be checked separately for structural and semantic validity
* orchestration policies can stop early on structural failure before invoking expensive semantic analysis
* repair flows distinguish syntax fixes from substantive improvement tasks
* reports explicitly categorize findings by validation layer

## Pros and Cons of the Options

### Option 1: One Unified Validation Pass

Collapse all validation concerns into one pass or one tool output.

* Good, because the external surface looks simpler
* Bad, because deterministic and judgment-based findings become mixed together
* Bad, because recovery routing becomes less precise
* Bad, because pipeline optimization is harder

### Option 2: Separate Syntactic and Semantic Validation Layers

Model structural correctness and substantive quality as distinct layers.

* Good, because the platform can combine deterministic gates with deeper review logic
* Good, because users get clearer feedback about what failed and why
* Bad, because validators and policies require more explicit coordination
* Bad, because reporting format must preserve layer boundaries clearly

### Option 3: Semantic Review Only

Use broad review and scoring to judge artifacts without strong structural gates.

* Good, because it reduces up-front schema discipline
* Bad, because malformed artifacts may slip into downstream steps
* Bad, because many easy-to-fix failures consume expensive review cycles
* Bad, because tooling cannot reliably enforce contract integrity

## More Information

This ADR does not claim that syntactic validation is sufficient. It establishes that syntactic checks are necessary but incomplete, and that semantic checks must cover consistency, completeness, alignment, and traceability quality across one or more artifacts.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* artifacts require format, schema, or template validation
* artifacts also require quality and alignment review
* the orchestrator coordinates multiple validation layers
* layered validation findings need a standard report structure
