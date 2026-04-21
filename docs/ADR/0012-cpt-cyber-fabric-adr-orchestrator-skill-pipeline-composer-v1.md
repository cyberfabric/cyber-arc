---
status: accepted
date: 2026-04-20
decision-makers: cyber fabric maintainers
---

# ADR-0012: Separate Pipeline Planning from Pipeline Execution

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Let Each Skill Decide Its Own Next Steps](#option-1-let-each-skill-decide-its-own-next-steps)
  - [Option 2: Planner Creates Pipelines and Orchestrator Executes Them](#option-2-planner-creates-pipelines-and-orchestrator-executes-them)
  - [Option 3: Use Static Hand-Written Pipelines Only](#option-3-use-static-hand-written-pipelines-only)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-orchestrator-skill-pipeline-composer`

## Context and Problem Statement

Cyber Fabric is built around many bounded skills rather than a monolithic super-agent. That only works at system level if something can connect those skills into meaningful automated flows. If each skill decides its own downstream steps, orchestration becomes implicit and unstable. If pipelines are only written manually ahead of time, the platform loses much of the benefit of declared skill interfaces.

The platform therefore needs two distinct responsibilities. A planner skill should inspect the declared inputs and outputs of available skills, determine compatibility between them, and assemble those skills into executable automated pipelines. A shared Fabric orchestrator should then run those pipelines through the most suitable execution path available in the current host environment: using host-native subagents when the host supports them, or invoking supported external agent tools through Fabric adapters when subagents are unavailable. The orchestrator is also responsible for selecting appropriate models for the work being performed.

## Decision Drivers

* **Automation** — the platform should be able to assemble and run larger workflows from smaller skills automatically
* **Contract-based composition** — pipeline planning must depend on declared interfaces rather than prompt convention
* **Separation of concerns** — planning and execution should not be collapsed into one ambiguous responsibility
* **Reuse** — the same skill should be reusable in multiple pipelines without special-case glue logic
* **Adaptability** — the system should be able to select different chains and execution backends when capabilities or targets change
* **Governance** — pipeline planning and execution must remain inspectable and policy-controlled
* **Execution portability** — the same execution model should work across hosts with and without native subagent support
* **Model fitness** — pipeline steps should be matched with suitable models rather than using one default model blindly

## Considered Options

1. **Let Each Skill Decide Its Own Next Steps** — skills embed routing and downstream invocation logic internally
2. **Planner Creates Pipelines and Orchestrator Executes Them** — the planner inspects skill IO contracts and builds compatible chains, while the orchestrator runs them
3. **Use Static Hand-Written Pipelines Only** — all pipelines are predefined manually and selected by name or workflow policy

## Decision Outcome

Chosen option: **Option 2 — Planner Creates Pipelines and Orchestrator Executes Them**, because Cyber Fabric needs explicit separation between composition logic and execution logic. The planner skill is responsible for reading skill interface contracts, matching outputs to downstream inputs, checking compatibility constraints, and building automated pipelines that remain explainable, policy-bounded, and replaceable. The Fabric orchestrator is responsible for running those pipelines and proposing or selecting execution variants for their steps: prefer host-native subagents when available, otherwise invoke compatible external agent tools through supported adapters, and choose appropriate models for each step's capability, latency, and quality requirements.

### Consequences

* Good, because skills remain bounded while still participating in larger end-to-end workflows
* Good, because pipeline planning becomes a first-class architectural capability rather than hidden prompt behavior
* Good, because one skill can be reused in multiple chains if its IO contract matches the required flow
* Good, because the platform can adapt pipeline construction when available skills, versions, or policies change
* Good, because compatibility checking can happen before execution instead of failing late in the pipeline
* Good, because the same execution model can target native subagents or external agent tools without changing skill definitions
* Good, because model choice becomes an explicit orchestration concern rather than an implicit host default
* Bad, because the planner depends on high-quality interface metadata to produce good pipelines
* Bad, because the orchestrator still needs careful policies for execution backend selection and model selection
* Bad, because external-agent execution introduces additional compatibility and observability concerns compared with native subagents

### Confirmation

Confirmed when:

* the planner skill can inspect declared inputs, outputs, versions, and format constraints of available skills
* pipeline generation uses compatibility checks rather than prompt-only routing heuristics
* users and systems can inspect why a skill was selected as the next step in a chain
* planned workflows can be rebuilt or adjusted when the skill catalog changes without hand-editing every pipeline
* the Fabric orchestrator can run a planned pipeline through host-native subagents when supported
* the Fabric orchestrator can offer or use supported external agent tools through adapters when subagents are unavailable
* execution logs show which execution backend and model were selected for each pipeline step

## Pros and Cons of the Options

### Option 1: Let Each Skill Decide Its Own Next Steps

Allow every skill to choose what should run after it.

* Good, because some local flows may be easy to prototype
* Bad, because orchestration becomes fragmented across many skills
* Bad, because downstream routing logic gets duplicated and drifts over time
* Bad, because pipeline behavior becomes harder to inspect and govern
* Bad, because bounded skills begin to absorb orchestration concerns

### Option 2: Planner Creates Pipelines and Orchestrator Executes Them

Use a planner skill to inspect skill contracts and create compatible automated flows, then use the shared Fabric orchestrator to run those flows through host-native subagents, supported external agent tools, and suitable models as needed.

* Good, because planning and execution have distinct architectural owners
* Good, because composition is driven by explicit IO contracts and compatibility rules
* Good, because the same skill registry can support many pipeline shapes and execution backends
* Good, because the orchestrator can adapt to host capabilities instead of assuming one runtime model
* Bad, because the planner depends on high-quality interface metadata
* Bad, because execution-backend selection and model ranking policies must be designed carefully

### Option 3: Use Static Hand-Written Pipelines Only

Define pipelines manually and avoid dynamic or semi-dynamic composition.

* Good, because approved flows are easy to reason about
* Good, because execution can be tightly controlled for narrow use cases
* Bad, because extensibility suffers as the skill catalog grows
* Bad, because every new composition requires manual authoring and maintenance
* Bad, because interface contracts provide less architectural leverage than they should

## More Information

The planner and orchestrator should act as cooperating control capabilities rather than magical do-everything agents. At minimum:

* the planner should discover the available skill interfaces
* the planner should understand each skill's accepted inputs and produced outputs
* the planner should evaluate compatibility across artifact type, version, format, and operation mode
* the planner should assemble candidate chains into policy-compliant pipelines
* the orchestrator should decide whether a step should run in a host-native subagent, or through a supported external agent tool via a Fabric adapter when subagents are unavailable
* the orchestrator should select suitable models for individual steps based on capability, cost, latency, and quality needs
* the system should explain pipeline choices, execution-backend choices, model choices, and incompatibility reasons
* the orchestrator should coordinate execution, validation, retry, and recovery around the planned flow

This keeps orchestration explicit: domain skills transform artifacts, the planner skill composes those transformations into coherent automated delivery flows, and the shared Fabric orchestrator runs those flows through the most suitable execution path available in the current host environment.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **Related decisions**: [ADR-0017](0017-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-central-fabric-core-v1.md)

This decision directly addresses the following traceability items:

* the planner skill must be able to connect bounded skills into a single automated pipeline
* pipeline composition must depend on declared skill inputs and outputs
* compatibility checking should happen before pipeline execution where possible
* the orchestrator should prefer host-native subagents when supported and otherwise use compatible external agent tools through adapters
* model selection should be an explicit orchestration responsibility during execution
* composed flows should remain inspectable, explainable, and policy-bounded
