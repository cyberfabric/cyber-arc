---
status: accepted
date: 2026-05-04
decision-makers: cyber fabric maintainers
---

# ADR-0021: VS Code Plugin as Fabric's First-Party Host Adapter for VS Code

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No First-Party VS Code Plugin](#option-1-no-first-party-vs-code-plugin)
  - [Option 2: CLI-Wrapper Extension](#option-2-cli-wrapper-extension)
  - [Option 3: Thin Native Plugin Connecting to REST API](#option-3-thin-native-plugin-connecting-to-rest-api)
  - [Option 4: Thin Native Plugin Embedding Fabric Core In-Process](#option-4-thin-native-plugin-embedding-fabric-core-in-process)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter`

## Context and Problem Statement

ADR-0003 commits Cyber Fabric to delivering host integrations through host-native plugins and adapters, with VS Code named as a primary target. ADR-0012 covers the workspace-interop slice of that VS Code integration. The platform now needs the umbrella decision: a first-party `Fabric` VS Code extension that brings Fabric's full capability set into VS Code through native VS Code patterns (Command Palette, Tree View, Side Panel, webview), distinct from the kit-shipped VS Code plugins that ADR-0019 covers.

If Fabric does not ship its own VS Code plugin, users who live in VS Code have to leave the editor for every workspace, branch, worktree, commit, script, or PR operation. If the plugin is built as a CLI-wrapper (spawning `fabric` subprocesses for each action), the UX becomes slow, brittle, and limited to whatever the CLI surface exposes. If the plugin connects to Fabric only through the REST API even for purely local desktop use, the plugin pays serialization overhead, has to manage REST endpoint configuration, and forces the local desktop scenario into a client/server shape it does not need. The VS Code extension host runs Node.js — the same runtime as Fabric Core (ADR-0004 TypeScript primary language) — so a thin VS Code plugin can directly embed Fabric Core in-process, the same way the CLI does.

## Decision Drivers

* **Native VS Code experience** — capabilities must surface through Tree Views, Command Palette, Side Panels, and webviews, not through a generic terminal pane
* **Local-first, daemonless** — desktop Fabric is single-user, single-machine, and minimal-footprint per ADR-0005; the VS Code plugin must work without spinning up a REST server or requiring a configured endpoint
* **Direct call efficiency** — Tree View refreshes, command-palette autocompletion, and inline UI affordances should run at in-process latency, not REST round-trip latency
* **Shared TypeScript runtime** — the VS Code extension host runs Node.js, the same runtime as Fabric Core; no transport bridge is required
* **Distinct from kit-shipped plugins** — this is Fabric's own first-party plugin, not a kit-shipped VS Code plugin per ADR-0019
* **Per-window workspace context** — one VS Code window naturally maps to one Fabric workspace; this should be the default
* **Surface parity through Fabric Core, not through transport** — surface parity comes from every surface routing into the same Fabric Core (ADR-0001 / ADR-0002), not from sharing a single transport with the Web UI; the Web UI runs in a browser and uses REST (ADR-0020) because it has no other choice; the VS Code plugin runs in Node and does not
* **Marketplace distribution** — the plugin should ship through the VS Code Marketplace as the official `Fabric` extension

## Considered Options

1. **No First-Party VS Code Plugin** — VS Code users invoke `fabric` from the integrated terminal; Fabric does not ship a native extension
2. **CLI-Wrapper Extension** — extension exists but spawns `fabric <command>` for each user action and parses output
3. **Thin Native Plugin Connecting to REST API** — extension is a thin native VS Code plugin that connects to the Fabric REST API (ADR-0020) for all operations
4. **Thin Native Plugin Embedding Fabric Core In-Process** — extension is a thin native VS Code plugin that embeds Fabric Core directly through TypeScript imports and calls Core APIs in the VS Code extension host process

## Decision Outcome

Chosen option: **Option 4 — Thin Native Plugin Embedding Fabric Core In-Process**, because Cyber Fabric needs a first-party VS Code extension that feels native, runs at in-process latency, and does not require a REST server for the local desktop scenario it actually targets. The VS Code extension host already runs Node.js (ADR-0004), so Fabric Core is directly importable; surface parity with CLI / Web UI / agentic-tool host plugins is achieved by routing every operation through the same Fabric Core (ADR-0001, ADR-0002), not by forcing every surface onto the same transport. CLI-wrapper extensions (Option 2) are slow and brittle. REST-only extensions (Option 3) pay round-trip cost and require endpoint configuration even when the user is on a single local machine. Absent extensions (Option 1) cede the entire VS Code population to other tools.

The decision has these parts:

1. **Official `Fabric` VS Code extension** published to the VS Code Marketplace as Fabric's first-party host adapter for VS Code (concrete instantiation of the host-adapter pattern from ADR-0003).

2. **In-process Fabric Core embedding** — the extension imports Fabric Core directly as a TypeScript dependency and calls Core APIs in the VS Code extension host process. It does not invoke the CLI as a subprocess, does not spawn a REST server, and does not require a REST endpoint to be configured for local desktop use. Future cloud / remote Fabric scenarios are out of scope for this ADR; if and when the plugin needs to talk to a remote Fabric, that integration is follow-on design and may use the REST API (ADR-0020) as a separate adapter mode.

3. **REST API stays exclusive to surfaces that need it** — the REST API (ADR-0020) is the canonical transport for the Web UI (ADR-0018) because the browser cannot import Node modules directly; it is also available to external clients. The VS Code plugin does not consume the REST API and does not require it to be running.

4. **Per-window workspace context** — one VS Code window corresponds to one Fabric workspace, derived by default from the open folder or `.code-workspace` per ADR-0012 (workspace interop). Users can switch the active workspace through the VS Code Command Palette, which updates the plugin's in-process Fabric Core context per ADR-0025.

5. **Capability surfaces inside VS Code:**
   * **Workspace info, branches, worktrees, commits** — surfaced through Tree Views in a Fabric Side Panel
   * **Scripts (ADR-0017)** — discoverable and runnable through the VS Code Command Palette as `Fabric: Run Script ...`
   * **Kit web extensions (ADR-0018)** — rendered as VS Code webview panels, mounted on demand
   * **Pull requests (ADR-0024)** — visualization, review, and the markdown-aware review affordances surfaced through Tree Views and webviews; line-comment / suggestion blocks integrate with VS Code's diff view where possible
   * **PR markdown rendering** — uses VS Code's built-in markdown renderer for spec / ADR / documentation review

6. **Shipped inside the `core` kit (per ADR-0030)** — the Fabric VS Code extension is delivered as a kit-shipped dev tool plugin per ADR-0019's host-native packaging convention, packaged inside the core-bundled `core` kit. This unifies the delivery model: kits and Fabric core both use ADR-0019's mechanism. Third-party kits may also ship their own VS Code plugins via ADR-0019; those are independent of this Fabric extension. The `core` kit's plugin is the canonical Fabric extension and ships with Fabric itself.

The exact UI layout, the precise set of contributed views and commands, the relationship to VS Code's own SCM and Source Control views, the activation events, and any future remote/cloud Fabric integration mode for this extension are intentionally left to follow-on design.

### Consequences

* Good, because VS Code users get all Fabric capabilities through native VS Code UI without leaving the editor
* Good, because Tree View refreshes and command-palette interactions run at in-process latency without REST round-trips
* Good, because the local desktop install does not need a REST server running for the VS Code plugin to work
* Good, because the extension stays thin (UI + Fabric Core direct import) and lifts most logic to Fabric Core
* Good, because surface parity with CLI / Web UI / agentic-tool host plugins is structural through Fabric Core, not through a forced shared transport
* Good, because per-window workspace context maps cleanly to how users actually use VS Code
* Bad, because the plugin must be maintained as a stability surface alongside Fabric Core
* Bad, because the plugin's Fabric Core dependency must be a published TypeScript module the VS Code extension can resolve at install time; this couples plugin releases to compatible Core versions
* Bad, because remote / cloud Fabric is not addressed by this ADR — a future remote mode for the VS Code plugin is out of scope and requires a follow-on decision
* Bad, because VS Code marketplace publication, signing, and extension lifecycle add operational concerns
* Bad, because some kit-shipped VS Code plugins (ADR-0019) and the Fabric first-party extension may want to integrate (e.g. a kit's plugin shipping a custom PR review experience); the integration contract is follow-on design

### Confirmation

Confirmed when:

* the official `Fabric` VS Code extension is published to the VS Code Marketplace
* the extension embeds Fabric Core in-process via direct TypeScript import; it does not invoke the CLI as a subprocess and does not require a REST API endpoint for local desktop use
* the local desktop install runs the VS Code plugin with no Fabric REST server running
* per-window workspace context is derived from the open folder or `.code-workspace` per ADR-0012, with manual override via Command Palette per ADR-0025
* workspace info, branches, worktrees, commits, scripts, PRs, and kit web extensions are all surfaced through native VS Code UI
* the extension is distinct from kit-shipped VS Code plugins per ADR-0019

## Pros and Cons of the Options

### Option 1: No First-Party VS Code Plugin

VS Code users invoke `fabric` from the integrated terminal.

* Good, because the platform owns less front-end surface
* Bad, because every operation requires switching to a terminal pane
* Bad, because Tree View, Side Panel, and webview affordances go unused
* Bad, because the large VS Code user base has no Fabric-native surface

### Option 2: CLI-Wrapper Extension

Extension spawns `fabric <command>` for each action and parses output.

* Good, because the extension can be small and ship quickly
* Bad, because every action pays subprocess startup latency
* Bad, because parsing CLI output is brittle and version-coupled
* Bad, because the extension cannot offer richer UX than the CLI surface
* Bad, because remote and cloud Fabric use through the same extension is awkward

### Option 3: Thin Native Plugin Connecting to REST API

Extension is a thin native VS Code plugin that uses the REST API for all operations.

* Good, because the same plugin code could in principle work locally and against a remote endpoint
* Bad, because every Tree View refresh and command pays REST serialization + round-trip cost on a single local machine
* Bad, because local desktop use needs a Fabric REST server running, which contradicts the daemonless / minimal-footprint goal of ADR-0005
* Bad, because the VS Code extension host runs Node — it can import Fabric Core directly, so going through HTTP is unnecessary indirection for the local case
* Bad, because surface parity does not require sharing transport with Web UI; parity is achieved by routing through Fabric Core, not by forcing the transport shape

### Option 4: Thin Native Plugin Embedding Fabric Core In-Process

Extension imports Fabric Core directly and calls Core APIs in the VS Code extension host process.

* Good, because the plugin is fast and feels native, with no REST round-trips for local UI affordances
* Good, because the local desktop install does not need any REST server running
* Good, because Fabric Core is a TypeScript module and the extension host runs Node — import is a natural integration
* Good, because surface parity is preserved structurally through Fabric Core (ADR-0002), independent of transport
* Bad, because the plugin's bundled Fabric Core version must stay compatible with the user's installed Fabric Core; release management must coordinate
* Bad, because remote / cloud Fabric is not addressed by this option and requires a follow-on adapter mode (which may use the REST API per ADR-0020)
* Bad, because the plugin's UX surface (views, commands, webviews) needs careful design to not feel scattered

## More Information

The plugin's contributed surfaces include (at minimum):

* a Fabric Side Panel containing Tree Views for workspace, branches, worktrees, commits, and PRs
* Command Palette entries (`Fabric: ...`) for scripts (ADR-0017), workspace switching, kit web extension activation
* webview panels for kit web extensions (ADR-0018) mounted on demand
* PR review surfaces using VS Code's diff view and markdown renderer where possible

The exact view layout, the contributed configuration schema, activation events, the Source Control view integration, the relationship between this first-party extension and any kit-shipped VS Code plugins (ADR-0019) that surface PR review or other Fabric-adjacent features, and the marketplace publishing process are intentionally left to follow-on design. Any future remote / cloud Fabric integration mode for this extension (which may use the REST API per ADR-0020 as a separate adapter mode) is out of scope for this ADR and requires its own decision.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-surface-vscode-plugin`, `cpt-cyber-fabric-usecase-pe-ship-web-extension`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0004](0004-cpt-cyber-fabric-adr-typescript-primary-language-v1.md), [ADR-0005](0005-cpt-cyber-fabric-adr-minimal-installation-footprint-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0012](0012-cpt-cyber-fabric-adr-vscode-workspace-interop-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md), [ADR-0024](0024-cpt-cyber-fabric-adr-pull-requests-as-first-class-concept-v1.md), [ADR-0025](0025-cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution-v1.md), [ADR-0030](0030-cpt-cyber-fabric-adr-core-bundled-kit-core-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must ship a first-party VS Code extension as the host adapter for VS Code per ADR-0003
* the extension must embed Fabric Core in-process via direct TypeScript import; it must not invoke the CLI as a subprocess and must not require a REST API endpoint for the local desktop scenario
* the local desktop install must run the VS Code plugin without requiring a Fabric REST server
* the extension is distinct from kit-shipped VS Code plugins (ADR-0019) — it is Fabric's own first-party plugin
* per-window workspace context follows ADR-0012 and ADR-0025
* workspace, branches, worktrees, commits, scripts, PRs, and kit web extensions are surfaced through native VS Code UI
* future remote / cloud Fabric integration for this extension is out of scope and requires a follow-on decision
