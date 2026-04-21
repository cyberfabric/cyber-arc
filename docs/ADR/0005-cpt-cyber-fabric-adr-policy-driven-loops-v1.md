---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0005: Support Policy-Driven Loops for Iterative Quality Improvement

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Linear Pipelines Only](#option-1-linear-pipelines-only)
  - [Option 2: Policy-Driven Loops with Explicit Stop Conditions](#option-2-policy-driven-loops-with-explicit-stop-conditions)
  - [Option 3: Unbounded Self-Improvement Loops](#option-3-unbounded-self-improvement-loops)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-policy-driven-loops`

## Context and Problem Statement

Real document and coordination workflows do not end after one pass. Generated artifacts often need review, repair, revalidation, and sometimes escalation. A platform limited to linear execution would force users to manually recreate improvement cycles, while unconstrained autonomous loops would create unpredictable cost, latency, and failure behavior.

Cyber Fabric needs loops as a first-class orchestration construct, but with explicit policy boundaries.

## Decision Drivers

* **Quality improvement** — iterative review and repair are essential for serious outputs
* **Control** — loops must stop predictably under clear conditions
* **Cost management** — repeated iterations must have bounded resource use
* **Escalation safety** — critical findings must trigger human review when needed
* **Operational transparency** — users should understand why the system continues or stops

## Considered Options

1. **Linear Pipelines Only** — every workflow is a strict one-pass chain
2. **Policy-Driven Loops with Explicit Stop Conditions** — workflows may cycle under declared policies
3. **Unbounded Self-Improvement Loops** — let the system keep iterating until it decides it is done

## Decision Outcome

Chosen option: **Option 2 — Policy-Driven Loops with Explicit Stop Conditions**, because iterative quality improvement is necessary, but uncontrolled recursion is unacceptable in a production orchestration platform. Loop policies must define acceptance thresholds, maximum iterations, stop conditions, escalation rules, and critical failure handling.

### Consequences

* Good, because workflows such as generate → review → repair → review become native rather than improvised
* Good, because the orchestrator can explain and enforce why a loop continues, stops, or escalates
* Good, because iteration budgets and acceptance thresholds prevent runaway execution
* Good, because human handoff becomes an explicit outcome, not an error condition
* Bad, because loop policy design adds orchestration complexity
* Bad, because poor thresholds can cause either premature stopping or unnecessary churn
* Bad, because users may need visibility into more workflow metadata than in simple linear systems

### Confirmation

Confirmed when:

* workflow definitions can represent cycles as well as linear chains
* loop policies include max iterations, acceptance conditions, and escalation criteria
* critical findings can terminate automation and hand work to a human reviewer
* execution records make loop decisions visible to operators and users

## Pros and Cons of the Options

### Option 1: Linear Pipelines Only

Allow only one-pass chains with no native iteration semantics.

* Good, because execution planning is simpler
* Good, because latency is more predictable
* Bad, because quality-improvement workflows become awkward and manual
* Bad, because retry, repair, and revalidation logic gets pushed outside the platform model
* Bad, because common review loops are treated as exceptions rather than norms

### Option 2: Policy-Driven Loops with Explicit Stop Conditions

Allow loops but only under explicit orchestration policy.

* Good, because it supports real delivery workflows while keeping operational control
* Good, because it makes escalation and acceptance part of the model
* Bad, because policy design and telemetry become more involved
* Bad, because poorly chosen policies can still waste effort

### Option 3: Unbounded Self-Improvement Loops

Let the system continue iterative refinement without hard operational limits.

* Good, because it maximizes autonomy in theory
* Bad, because cost, time, and failure behavior become unpredictable
* Bad, because hidden loop decisions are difficult to audit
* Bad, because production operators cannot rely on stable behavior under load or failure

## More Information

Example loop patterns include:

* generate → review → repair → review → accept
* annotate → link → validate → repair → validate
* compose → validate-schema → validate-consistency → repair → revalidate

The orchestrator is responsible for loop control, not the individual skills acting alone.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: none yet

This decision directly addresses the following traceability items:

* pipelines must support cycles as well as linear execution
* loops require explicit stop and escalation rules
* the orchestrator owns loop control and policy enforcement
* common generate-review-repair workflows need default loop policies
