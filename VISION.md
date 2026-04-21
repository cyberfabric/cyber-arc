# Cyber Fabric Vision

## Overview

Cyber Fabric is a product delivery system that gives the whole product organization a single view of the product from intent to implementation and tests. It connects product management, design, architecture, engineering, QA, and expert teams in one workspace-oriented surface instead of scattering discussion, validation, and review across disconnected tools.

Cyber Fabric is the next evolution of Cyber Pilot. Where Cyber Pilot established deterministic generation and validation patterns, Fabric extends that foundation into a shared system where product definition, implementation, validation, and review can happen together.

Fabric should let teams trace work end to end and back again: from intent, requirements, and design to plans, code, tests, validation results, and review discussions. That traceability is not only technical. Fabric should also provide the collaboration system around those artifacts so teams can review, discuss, validate, and coordinate in the same place.

Fabric should combine three strengths in one system: Git-style review, comments, and change tracking; Cyber Pilot-style templates, checklists, deterministic generation, and validation; and collaboration patterns familiar from shared knowledge systems, including assisted coordination around comments and follow-ups. The result should be a deterministic collaborative system for product delivery, not just another IDE assistant or documentation tool.

The user experience should stay consistent across local and centralized modes. A developer should be able to launch Fabric locally in the IDE and use the same Fabric skill, workflows, and mental model that they would see in a web/server deployment. Whether the entry point is a local agent, CLI, or Fabric web chat, the capabilities and outcomes should feel like one product.

Underneath that experience, Fabric should support multi-repo workspaces, agent and model integrations, workflow orchestration, strong kit integration, stable identifiers, and a minimal project footprint. Work done through Fabric should flow cleanly into diffs, review threads, and pull requests so workspace activity becomes reviewable delivery output.

## Why the name Fabric

The name **Fabric** carries two meanings.

On one side, it represents a **fabric** or **weave**: many threads joined into one connected system instead of isolated strands of work.

On the other side, it represents the **shared connective layer** that links product intent, technical implementation, tests, and the teams responsible for each of them into one shared delivery system.

## Overview Diagram

![Cyber Fabric Overview](img/OVERVIEW.drawio.svg)

## Product Direction

- **Single product view**
  Fabric gives product, design, architecture, engineering, QA, and expert teams one shared surface to understand the product from intent to code and tests.
- **End-to-end traceability**
  Fabric lets teams trace forward and backward across requirements, design, plans, code, tests, validation results, and reviews.
- **Deterministic collaboration**
  Fabric combines structured generation and validation with shared comments, review flows, reminders, and assisted coordination in one system.
- **Same Fabric skill everywhere**
  The same Fabric skill and workflows should work in IDE agents, CLI flows, and Fabric web/server chat with no fundamental experience gap.
- **Workspace-first multi-repo delivery**
  Fabric manages one or many repositories as a single delivery context and supports product work that spans documentation, code, and validation repositories.
- **Reviewable change management**
  Fabric turns workspace activity into reviewable diffs, inline comments, and pull-request-ready changes with Git-aware workflows.
- **Minimal footprint, strong integrations**
  Fabric keeps project-local state small and patchable while integrating well with models, agent runtimes, kits, and future centralized collaboration infrastructure.
