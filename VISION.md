# Cyber Arc Vision

## Overview

Cyber Arc is the next evolution of Cyber Pilot: a workspace-first system for building products across one or many repositories with AI agents, stable traceability, and minimal project footprint.

Cyber Arc should let a developer launch `arc` without parameters, create a new Arc project or open an existing one, and for a new project choose a folder such as `~/arc/cool-project`. Each Arc project should host a workspace of one or many Git repositories for code and documentation, and Arc should let the team add or remove repositories as the product evolves.

The same Arc skill should be available to IDE agents, Claude Code, Codex, Devin, and to Arc's own web/server chat surface. That skill should generate and validate documentation in the right repositories, generate code from that documentation in code repositories, enforce templates and checklists, preserve stable identifiers across documents and code comments, and support reverse engineering from code or free-form documentation. Cyber Arc itself, through its CLI and Server surfaces, should be able to invoke and coordinate agent tools as part of the workspace workflow.

In server mode, Arc should provide a centralized web application with a chat with the Arc agent, documentation and code visualization, AI-assisted proxy integrations, diff views, inline comments, and Git/PR-oriented change management. It should be deployable locally, in the cloud, or on a dedicated server so developers and product managers can work together in the same Arc project.

Arc is intentionally minimal in project footprint: anything that can live outside the target project should live outside it. Project-local customization should be explicit, small, and patchable. Arc should be forked from Cyber Pilot and reuse its codebase, prompts, and operating model where possible, while evolving toward a centralized multi-repo and multi-user platform. Arc will also absorb what is currently known as Cyber Wiki and support the broader Cyber Fabric stack, including FrontX and Core.

## Why the name Arc

The name **Arc** carries two meanings.

On one side, it stands for **Architect** and **Architecture**: the discipline of shaping systems deliberately, keeping requirements, design, plans, and implementation aligned instead of letting them drift apart.

On the other side, it represents an **arc** or a **bridge**: a structure that connects separate layers, repositories, artifacts, and roles across the SDLC. Arc is meant to span the gaps between product thinking, documentation, code, validation, and change management, turning them into one connected delivery surface.

## Overview Diagram

![Cyber Arc Overview](img/OVERVIEW.drawio.svg)

## Product Direction

- **Workspace-first**
  Arc manages one or many repositories as a single working context for documentation, code, and delivery, with repository membership evolving over time.
- **Agent-native**
  Arc exposes one Arc skill surface across IDE agents and the web app chat so the same workflows work in both places, while Cyber Arc itself invokes and coordinates agent tools through its CLI and Server surfaces.
- **Traceability-first**
  Cyber Arc Core controls stable identifiers directly and uses them to connect requirements, design, plans, code, and review surfaces, including identifiers embedded in code comments.
- **Minimal footprint**
  Arc keeps project-local files to the minimum necessary and prefers shared, externalized, upgradeable configuration.
- **Customizable but updatable**
  Prompts, techniques, templates, and kits can be customized without losing a clean path to future updates.
- **Reviewable collaboration**
  Arc makes documentation and code reviewable through shared visualization, diffs, inline comments, and Git/PR-aware change management.
- **From local to centralized**
  Arc works as a local CLI/workspace tool first, then scales into cloud or dedicated-server environments for developers and product managers collaborating on the same product surface.
