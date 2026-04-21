---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0009: Require Deterministic Validators for Critical and Traceability-Sensitive Checks

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: LLM Validation Only](#option-1-llm-validation-only)
  - [Option 2: Deterministic Validators for Critical Checks](#option-2-deterministic-validators-for-critical-checks)
  - [Option 3: Deterministic Validation Everywhere](#option-3-deterministic-validation-everywhere)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-deterministic-validation`

## Context and Problem Statement

Large language models are useful for proposing structure, inferring links, and judging quality, but they are not sufficient as the final authority for all validation decisions. Traceability and contract integrity require repeatable checks for syntax, uniqueness, broken references, duplicate references, orphan items, and coverage rules. A platform that relies only on model judgment for those checks would be hard to trust operationally.

Cyber Fabric therefore needs deterministic validators for the checks where repeatability and exactness matter most.

## Decision Drivers

* **Trustworthiness** — validation outcomes for critical rules must be reproducible
* **Auditability** — teams need exact reasons for failure and measurable coverage metrics
* **Automation safety** — repair loops should target concrete deterministic failures when possible
* **Traceability integrity** — ID and reference rules are especially sensitive to non-deterministic validation drift
* **Practicality** — not every quality question can or should become a deterministic rule

## Considered Options

1. **LLM Validation Only** — rely entirely on model review and reasoning for validation
2. **Deterministic Validators for Critical Checks** — use scripts for exact checks and models for higher-level review where needed
3. **Deterministic Validation Everywhere** — require every meaningful quality judgment to be encoded as scripts or rules

## Decision Outcome

Chosen option: **Option 2 — Deterministic Validators for Critical Checks**, because Cyber Fabric needs strong guarantees for structural and traceability-sensitive integrity without pretending that all semantic quality questions are reducible to scripts. Deterministic validation is mandatory where exactness is possible and operationally valuable; model-based review remains appropriate for higher-order quality and reasoning checks.

### Consequences

* Good, because critical failures such as malformed IDs and broken references are caught repeatably
* Good, because validation results can include reliable metrics such as coverage percentages and orphan counts
* Good, because repair loops can focus on specific machine-detected defects before invoking broader review
* Good, because the platform preserves room for semantic and cross-artifact reasoning beyond scripts
* Bad, because deterministic validators require engineering investment and ongoing maintenance
* Bad, because teams may overestimate deterministic coverage and neglect semantic review if governance is weak
* Bad, because some borderline checks will need a policy decision on whether they belong in scripts or review logic

### Confirmation

Confirmed when:

* critical traceability checks are executed by deterministic scripts or equivalent rule engines
* validator outputs include exact findings for ID syntax, uniqueness, broken refs, duplicate refs, orphan items, and coverage rules
* LLM-based review is positioned as complementary to, not a replacement for, deterministic checks
* workflow policies can gate progression on deterministic validator outcomes where required

## Pros and Cons of the Options

### Option 1: LLM Validation Only

Use models alone to judge all artifact validity and traceability quality.

* Good, because it minimizes custom tooling effort initially
* Good, because models can evaluate nuanced quality issues
* Bad, because exact failures become less reproducible and auditable
* Bad, because critical integrity checks can drift across runs or models
* Bad, because automation safety suffers when validators are non-deterministic

### Option 2: Deterministic Validators for Critical Checks

Use scripts for exact rules and retain model-based review for semantic or cross-cutting judgment.

* Good, because it aligns validation strength with the nature of the rule being enforced
* Good, because it supports trustworthy gating for traceability and structure
* Bad, because it requires explicit validator engineering and maintenance
* Bad, because teams must classify which checks belong in which layer

### Option 3: Deterministic Validation Everywhere

Encode all meaningful validation into scripts or formal rules only.

* Good, because repeatability is maximized in theory
* Bad, because many semantic quality questions do not fit deterministic encoding well
* Bad, because the cost of exhaustive rule engineering would be disproportionate
* Bad, because the platform would lose valuable model-assisted review depth

## More Information

The baseline deterministic validation scope should include at least:

* ID syntax and uniqueness
* broken and duplicate references
* orphan nodes
* required coverage rules
* coverage metrics
* declared format or schema checks where applicable

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* traceability-sensitive checks require deterministic validation
* coverage metrics must be reproducible and measurable
* script-based validators own exact integrity checks
* the platform needs an initial deterministic validator baseline for IDs and links
