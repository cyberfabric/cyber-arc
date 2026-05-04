---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0020: REST API as a Fabric Surface and Canonical Transport for Non-CLI Surfaces

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No REST API](#option-1-no-rest-api)
  - [Option 2: REST API as Internal Web UI Mechanism Only](#option-2-rest-api-as-internal-web-ui-mechanism-only)
  - [Option 3: REST API as a First-Class Surface and Canonical Transport for Non-CLI Surfaces](#option-3-rest-api-as-a-first-class-surface-and-canonical-transport-for-non-cli-surfaces)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-rest-api-as-fabric-surface`

## Context and Problem Statement

Cyber Fabric exposes a CLI (per ADR-0001 and ADR-0002) and a Web UI (per ADR-0018). External tools, integrations, and the future centralized cloud Fabric service need a third programmatic surface — a REST API — to call into Fabric core without spawning CLI subprocesses. Without one, every external integration has to either invoke the CLI as a subprocess (slow, brittle parsing of human-formatted output) or be re-implemented per consumer.

Beyond external use, the platform needs to decide how non-CLI surfaces (Web UI, VS Code plugin, future hosts) talk to Fabric core. If each non-CLI surface uses its own private mechanism (in-process call, IPC, subprocess), the platform fragments into several integration paths. If all non-CLI surfaces share **one canonical transport** — the REST API — then the same code path serves local desktop use, remote cloud Fabric, and external programmatic consumers, and any single integration tool can consume Fabric capabilities just like an internal surface does.

## Decision Drivers

* **Programmatic access** — external tools and integrations must be able to call Fabric without parsing CLI output
* **Canonical transport for non-CLI surfaces** — Web UI (ADR-0018), VS Code plugin (ADR-0021), and future host integrations all consume the same REST API rather than inventing private transports
* **Cloud-readiness** — the same API contract must work locally and remotely, so deploying Fabric in the cloud requires only relocating the REST server, not rewriting consumers
* **Stable consumer contract** — the REST API serves typed clients via auto-generated OpenAPI specification
* **Default localhost binding** — local desktop use requires zero auth and zero collision risk on shared developer machines
* **Versioned surface** — URL-versioned (`/v1/...`) so the API can evolve without breaking existing clients
* **Workspace addressing** — multi-workspace operation (ADR-0025) requires consistent workspace addressing across all surfaces

## Considered Options

1. **No REST API** — Fabric exposes only CLI and Web UI; Web UI calls Fabric core directly; external tools invoke the CLI as subprocess
2. **REST API as Internal Web UI Mechanism Only** — REST API exists but is private to Fabric's Web UI; external consumers still subprocess the CLI
3. **REST API as a First-Class Surface and Canonical Transport for Non-CLI Surfaces** — REST API is a third sibling-surface to CLI and Web UI, AND the canonical transport that all non-CLI surfaces use to reach Fabric core

## Decision Outcome

Chosen option: **Option 3 — REST API as a First-Class Surface and Canonical Transport for Non-CLI Surfaces**, because Cyber Fabric needs both a stable programmatic surface for external consumers AND a unified transport for its own non-CLI surfaces. Treating the REST API as both — first-class to external consumers and canonical to internal non-CLI surfaces — collapses two integration concerns into one well-defined contract.

The decision has these parts:

1. **REST API is a third sibling-surface** alongside the CLI and the Web UI. Functional parity with the CLI is a consequence of all three being thin presentations over the same Fabric core (per ADR-0001 and ADR-0002).

2. **REST API is the canonical transport for non-CLI surfaces.** The Web UI (ADR-0018) is a client of the REST API. The VS Code plugin (ADR-0021) is a client of the REST API. Future host integrations follow the same pattern. None of them call Fabric core directly; none of them invoke the CLI as a subprocess.

3. **Default binding is localhost on a free port chosen at runtime.** Users may override with `--port <n>`. Picking a free port avoids collisions with other local services and lets multiple Fabric REST API instances coexist on the same machine.

4. **URL versioning.** All endpoints live under a version prefix (initially `/v1/`). A new major version introduces a new prefix; clients pin to a version.

5. **OpenAPI specification.** An OpenAPI spec is auto-generated from core API contracts and served at `/v1/openapi.json`. External consumers use the spec to build typed clients.

6. **Workspace addressing per ADR-0025.** Workspace-scoped resources live under `/v1/workspaces/<name>/<resource>`; workspace-agnostic endpoints (workspace listing and creation, health, OpenAPI spec) are at the API root.

7. **Default no auth on localhost; remote requires auth.** When bound to localhost the REST API requires no authentication by default — local processes are trusted as the same user. Remote enablement (binding to a non-localhost address) requires explicit configuration and an auth model; exact mechanism is left to follow-on design (see also ADR-0018's enterprise theme).

### Consequences

* Good, because external tools and integrations get one stable, typed API to call Fabric programmatically
* Good, because all non-CLI surfaces (Web UI, VS Code plugin, future hosts) share one canonical transport
* Good, because cloud deployment is straightforward — relocate the REST server, point clients at the new endpoint, no consumer code changes
* Good, because OpenAPI spec auto-generation gives clients typed bindings without manual SDK maintenance
* Good, because URL versioning lets the API evolve without breaking existing clients
* Good, because default localhost binding keeps the local-first developer experience trivial (zero config, zero auth)
* Bad, because the REST API becomes a critical surface that must remain stable as Fabric core evolves
* Bad, because remote enablement and auth are real concerns that need follow-on design before serious deployment
* Bad, because the same operation is now served through multiple paths (CLI, REST, Web UI), which means consistency tests across surfaces become important

### Confirmation

Confirmed when:

* Fabric ships a REST API server bound to localhost on a free port chosen at runtime by default; explicit `--port <n>` overrides
* the API is URL-versioned (`/v1/...`) and serves an auto-generated OpenAPI specification at `/v1/openapi.json`
* the Web UI (ADR-0018) is a client of the REST API and does not call Fabric core directly
* the VS Code plugin (ADR-0021) is a client of the REST API and does not invoke the CLI as a subprocess
* workspace-scoped resources live under `/v1/workspaces/<name>/<resource>`; workspace-agnostic endpoints are at the API root per ADR-0025
* localhost-bound API requires no authentication by default; remote binding requires explicit configuration and auth

## Pros and Cons of the Options

### Option 1: No REST API

Fabric exposes only CLI and Web UI; Web UI calls Fabric core directly; external tools invoke the CLI as subprocess.

* Good, because the platform owns less surface initially
* Bad, because external tools must parse CLI output, which is brittle and slow
* Bad, because the Web UI's direct-core integration cannot be reused for cloud deployment without rewriting
* Bad, because the VS Code plugin and future host integrations need their own private transports
* Bad, because there is no typed, versioned API contract for external consumers

### Option 2: REST API as Internal Web UI Mechanism Only

REST API exists but is private to Fabric's Web UI; external consumers still subprocess the CLI.

* Good, because the Web UI gets a clean transport
* Bad, because external consumers still pay the CLI-subprocess tax
* Bad, because labeling the REST API as private but exposing a localhost endpoint is a fiction — external tools will use it anyway, and the contract will drift
* Bad, because cloud deployment is awkward — the "private" REST API has to become public somehow

### Option 3: REST API as a First-Class Surface and Canonical Transport for Non-CLI Surfaces

REST API is a third sibling-surface to CLI and Web UI, AND the canonical transport that all non-CLI surfaces use.

* Good, because external and internal consumers share one stable API
* Good, because cloud deployment is a relocation, not a rewrite
* Good, because typed clients are straightforward via OpenAPI
* Good, because new host integrations (VS Code, JetBrains, Zed, etc.) follow one canonical pattern
* Bad, because the REST API is a stability surface to maintain as core evolves
* Bad, because remote enablement and auth need follow-on design before serious deployment

## More Information

The default URL version is `/v1/`. The OpenAPI spec at `/v1/openapi.json` is auto-generated from Fabric core API contracts; the generation pipeline and the precise mapping rules between core types and OpenAPI schemas are intentionally left to follow-on design.

Workspace addressing follows ADR-0025: workspace-scoped resources are at `/v1/workspaces/<name>/<resource>`; workspace-agnostic endpoints (`/v1/workspaces` for list and create, `/v1/health`, `/v1/openapi.json`) are at the API root.

The exact remote-enablement model — auth flow (token, OAuth, mTLS), bind address policy, rate limiting, observability hooks, WebSocket and Server-Sent-Events for streaming and realtime, and the relationship to the future centralized cloud Fabric service — is intentionally left to follow-on design. What this ADR fixes is that the REST API exists, is the canonical transport for non-CLI surfaces, defaults to a free localhost port, is URL-versioned with OpenAPI, and addresses workspaces per ADR-0025.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-surface-rest-api`, `cpt-cyber-fabric-interface-rest-api-surface`, `cpt-cyber-fabric-usecase-invoke-from-external-client`, `cpt-cyber-fabric-fr-auth-secret-protection`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0021](0021-cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter-v1.md), [ADR-0025](0025-cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must expose a REST API as a third sibling-surface to CLI and Web UI
* the REST API must be the canonical transport for all non-CLI surfaces (Web UI, VS Code plugin, future hosts)
* default binding is localhost on a free port chosen at runtime; explicit `--port <n>` overrides
* the API is URL-versioned (`/v1/...`) and serves an auto-generated OpenAPI specification
* workspace addressing follows ADR-0025
* localhost-bound API requires no authentication; remote enablement and auth are explicit follow-on design
