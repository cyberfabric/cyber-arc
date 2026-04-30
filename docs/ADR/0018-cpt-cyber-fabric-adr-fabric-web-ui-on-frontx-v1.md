---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0018: Fabric Web UI Built on frontx with Microfrontend-Based Kit Extensions, Served by the REST API

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No First-Party Web UI](#option-1-no-first-party-web-ui)
  - [Option 2: Web UI on a Popular Generic Framework with a Custom Extension Model and Direct Core Integration](#option-2-web-ui-on-a-popular-generic-framework-with-a-custom-extension-model-and-direct-core-integration)
  - [Option 3: Web UI on frontx with Microfrontend-Based Kit Extensions, Served by REST API](#option-3-web-ui-on-frontx-with-microfrontend-based-kit-extensions-served-by-rest-api)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-fabric-web-ui-on-frontx`

## Context and Problem Statement

Cyber Fabric is committed to a unified operational model across host-native surfaces (ADR-0001) over a shared Fabric core (ADR-0002), and host-native plugins / adapters (ADR-0003) are how Fabric integrates into agent hosts and IDEs. The platform now needs a **first-party Web UI** as another surface — one that visualizes Fabric's functions and lets kit authors plug in their own UIs — without committing to a generic web framework that would not address Cyber Fabric's actual needs (extensibility through microfrontends, enterprise readiness, future centralized cloud Fabric service).

If Fabric does not ship a first-party Web UI, the platform loses an important adoption surface and forces every kit author who wants UI to invent their own. If the Web UI is built on a popular generic framework (React, Vue, Svelte) without a specialized extension model, kits would need a custom plug-in layer built from scratch, and the platform would not benefit from existing enterprise-grade features. If the Web UI calls Fabric core directly (in-process or IPC), it cannot be reused for cloud-deployed Fabric service without rewriting the integration layer — and yet the cloud-readiness theme is a primary driver of the framework choice.

## Decision Drivers

* **Native microfrontend extensibility out of the box** — kit-shipped UI extensions plug in as microfrontends without a custom integration layer
* **Enterprise-grade features included** — auth flows, multi-tenancy hooks, audit and observability surfaces are bundled rather than rebuilt
* **Cloud-readiness** — the same Web UI must work locally and against a remote REST API for cloud-deployed Fabric service without code changes
* **Architectural alignment** — frontx is developed alongside cyber-fabric; choosing it avoids third-party drift between the two
* **Single web framework for everything web** — Fabric's own Web UI and kit web extensions share one runtime instead of two
* **REST API as canonical transport** — the Web UI is a client of the Fabric REST API (ADR-0020), not a direct caller of Fabric core; this matches the cloud-readiness driver and the unified-transport principle for non-CLI surfaces
* **Default port avoidance** — `fabric web run` should default to a free port chosen at runtime so multiple Fabric Web UI instances and other local services coexist without manual port management

## Considered Options

1. **No First-Party Web UI** — Fabric is CLI-only, with IDE adapters (ADR-0003) as the only graphical surface
2. **Web UI on a Popular Generic Framework with a Custom Extension Model and Direct Core Integration** — adopt React, Vue, or Svelte; build a microfrontend extension layer from scratch; Web UI calls Fabric core directly
3. **Web UI on frontx with Microfrontend-Based Kit Extensions, Served by REST API** — adopt frontx (https://github.com/cyberfabric/frontx, develop / alpha channel) for both the Fabric Web UI and kit-shipped web extensions; the Web UI is a client of the Fabric REST API (ADR-0020) so the same Web UI works locally and against a remote REST API

## Decision Outcome

Chosen option: **Option 3 — Web UI on frontx with Microfrontend-Based Kit Extensions, Served by REST API**, because Cyber Fabric needs a first-party Web UI that is **extensible through microfrontends out of the box**, **enterprise-ready**, **aligned with a future centralized cloud Fabric service**, and reachable through one canonical transport (REST API per ADR-0020) so the same Web UI works on local desktop and remote cloud without code changes.

The decision has these parts:

1. **Fabric ships a first-party Web UI**, launched by `fabric web run`, that visualizes Fabric's functions through the Fabric REST API (ADR-0020). The REST API itself is a thin layer over the shared Fabric core (ADR-0002), so the Web UI achieves functional parity with the CLI through the same shared core, but the **Web UI does not call the core directly** — it is a client of the REST API just like any other external tool, and it does not invoke the CLI as a subprocess.

2. **The Web UI is built on frontx** (https://github.com/cyberfabric/frontx, currently develop / alpha channel). Frontx is chosen because of native microfrontend extensibility, enterprise-grade features bundled (auth flows, multi-tenancy hooks, audit and observability), cloud-readiness for a future centralized Fabric service, architectural alignment with cyber-fabric, and the desire to use one framework for both Fabric's own UI and kit web extensions rather than two.

3. **Kit-shipped web extensions are microfrontends** that plug into the Web UI via frontx's native microfrontend mechanism. A kit declares its web extension or extensions in its manifest; `fabric web run` discovers all installed kits' web extensions and registers them as microfrontends. Web extensions reach Fabric capabilities (workspace info, branches, worktrees, scripts, etc.) and their kit's storage (ADR-0015) and assets (ADR-0016) **through the same REST API** that the Web UI uses — there is one transport, not two.

4. **Local versus remote REST API.** By default `fabric web run` connects the Web UI to a local Fabric REST API (ADR-0020) bound to localhost on a free port chosen at runtime; explicit `--port <n>` overrides the local Web UI port. For cloud-deployed Fabric service, the Web UI is configured to connect to a remote REST API endpoint instead — same Web UI code, different REST API target. The exact configuration mechanism for remote endpoints is left to follow-on design.

The exact SDK shape for microfrontends, the relationship between Web UI hosting and REST API hosting (one process or two), authentication and authorization rules for remote REST API connections, runtime-state synchronization between Web UI and CLI, and the migration path as frontx itself moves from develop / alpha to stable are intentionally left to follow-on design.

### Consequences

* Good, because Fabric gains a first-party Web UI without inventing a custom extension layer
* Good, because kit authors plug UI extensions in as microfrontends through one well-understood mechanism
* Good, because enterprise features needed for serious deployment are bundled rather than rebuilt
* Good, because the future centralized cloud Fabric service can use the same Web UI without re-platforming — only the REST API endpoint changes
* Good, because Fabric's own UI and kit web extensions share one runtime AND one transport (REST API), not two
* Good, because the default free-port behavior avoids collisions while explicit `--port` keeps deterministic deployments straightforward
* Good, because the Web UI being a client of the REST API forces the REST API contract to stay sufficient for full UI use, which raises its quality
* Bad, because frontx's develop / alpha status means churn in the framework affects the Web UI directly
* Bad, because kit authors need to learn frontx's microfrontend conventions to ship a web extension
* Bad, because hosting model, auth, and runtime-state synchronization decisions are still ahead of the platform
* Bad, because the Web UI now has a network round-trip (even on localhost) that direct-core integration would have avoided; for normal user-facing latency this is negligible, but it changes the performance model

### Confirmation

Confirmed when:

* `fabric web run` launches the Fabric Web UI built on frontx
* the Web UI is a client of the Fabric REST API (ADR-0020); it does not call Fabric core directly and does not invoke the CLI as a subprocess
* by default the Web UI connects to a local REST API bound to localhost on a free port chosen at runtime; explicit `--port <n>` overrides the local Web UI port
* the same Web UI code can connect to a remote REST API endpoint for cloud-deployed Fabric service without changes
* kit-shipped web extensions are registered as frontx microfrontends discovered from installed kits' manifests
* web extensions reach kit storage (ADR-0015), assets (ADR-0016), and Fabric core through the same REST API as the Web UI
* Fabric's own Web UI and kit web extensions share the same frontx runtime and the same REST API transport

## Pros and Cons of the Options

### Option 1: No First-Party Web UI

Fabric is CLI-only, with IDE adapters (ADR-0003) as the only graphical surface.

* Good, because the platform owns less front-end surface
* Bad, because users who prefer a Web UI have nowhere to go in Fabric
* Bad, because kit authors who want UI must invent their own outside Fabric
* Bad, because the platform loses an adoption surface that competitors offer

### Option 2: Web UI on a Popular Generic Framework with a Custom Extension Model and Direct Core Integration

Adopt React, Vue, or Svelte; build a microfrontend extension layer from scratch; Web UI calls Fabric core directly.

* Good, because the chosen generic framework is mainstream and has a large hiring pool
* Bad, because the microfrontend extension layer must be built and maintained from scratch
* Bad, because enterprise-grade features (auth, multi-tenancy, audit) are not bundled and must be assembled from third-party packages
* Bad, because direct core integration cannot be reused for cloud-deployed Fabric service without rewriting
* Bad, because Fabric's own UI and kit web extensions still need a shared microfrontend mechanism, which the generic framework does not provide

### Option 3: Web UI on frontx with Microfrontend-Based Kit Extensions, Served by REST API

Adopt frontx for both the Fabric Web UI and kit web extensions; Web UI is a REST API client.

* Good, because microfrontend extensibility comes out of the box
* Good, because enterprise-grade features are bundled
* Good, because the cloud Fabric service can use the same Web UI without re-platforming — only the REST API endpoint changes
* Good, because Fabric's own UI and kit web extensions share one runtime and one transport
* Bad, because frontx's develop / alpha status creates churn risk
* Bad, because kit authors must learn frontx-specific microfrontend conventions
* Bad, because there is a network round-trip (even on localhost) compared to direct core integration; negligible in practice

## More Information

The exact SDK shape for microfrontends (how an extension registers, communicates with Fabric core via REST API, exposes routes, listens to workspace state), the canonical port-selection rule (range, fallback strategy when explicit `--port` collides), the relationship between local Web UI hosting and local REST API hosting (one process or two), authentication and authorization rules for remote REST API connections, runtime-state synchronization between CLI and Web UI sessions, and version compatibility between Fabric core and frontx as frontx evolves are intentionally left to follow-on design.

The Web UI consumes the Fabric REST API alongside other surfaces (CLI in-process, VS Code plugin client per ADR-0021, external programmatic consumers); the REST API itself wraps Fabric core APIs. ADR-0011 (workspace info), ADR-0013 (branches), ADR-0014 (worktrees), ADR-0017 (scripts), ADR-0019 (dev tool plugins), ADR-0022 (commits), ADR-0024 (pull requests), and ADR-0015 / ADR-0016 (storage and assets) are all surfaced through the REST API that the Web UI consumes.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-surface-web-app`, `cpt-cyber-fabric-fr-surface-web-extensions`, `cpt-cyber-fabric-fr-pr-markdown-aware-review`, `cpt-cyber-fabric-interface-web-extension-contract`, `cpt-cyber-fabric-usecase-pm-review-from-web-app`, `cpt-cyber-fabric-usecase-pm-agentic-chat-workflow`, `cpt-cyber-fabric-usecase-pm-browse-and-install-kits`, `cpt-cyber-fabric-usecase-ux-mockup-and-chat`, `cpt-cyber-fabric-usecase-pe-ship-web-extension`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-kit-configuration-storage-v1.md), [ADR-0016](0016-cpt-cyber-fabric-adr-kit-assets-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must ship a first-party Web UI (`fabric web run`) as a host-native surface alongside the CLI
* the Web UI must be built on frontx because of native microfrontend extensibility, enterprise features, cloud-readiness, and architectural alignment
* kit-shipped web extensions are frontx microfrontends discovered from kit manifests
* the Web UI is a client of the REST API (ADR-0020); the REST API is the thin layer over Fabric core per ADR-0001 and ADR-0002
* the same Web UI code works against local and remote REST API endpoints
* `fabric web run` defaults to a free port chosen at runtime; explicit `--port` overrides the local Web UI port
* the Web UI and kit web extensions share one frontx runtime and one REST API transport
