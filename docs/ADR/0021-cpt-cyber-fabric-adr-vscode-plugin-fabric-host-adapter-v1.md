---
status: accepted
date: 2026-04-29
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
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter`

## Context and Problem Statement

ADR-0003 commits Cyber Fabric to delivering host integrations through host-native plugins and adapters, with VS Code named as a primary target. ADR-0012 covers the workspace-interop slice of that VS Code integration. The platform now needs the umbrella decision: a first-party `Fabric` VS Code extension that brings Fabric's full capability set into VS Code through native VS Code patterns (Command Palette, Tree View, Side Panel, webview), distinct from the kit-shipped VS Code plugins that ADR-0019 covers.

If Fabric does not ship its own VS Code plugin, users who live in VS Code have to leave the editor for every workspace, branch, worktree, commit, script, or PR operation. If the plugin is built as a CLI-wrapper (spawning `fabric` subprocesses for each action), the UX becomes slow, brittle, and limited to whatever the CLI surface exposes. If the plugin calls Fabric core directly in-process, it cannot be reused for the future cloud Fabric service.

## Decision Drivers

* **Native VS Code experience** — capabilities must surface through Tree Views, Command Palette, Side Panels, and webviews, not through a generic terminal pane
* **Unified transport** — the plugin should use the same canonical transport (REST API per ADR-0020) as the Web UI, so cloud Fabric and local Fabric work identically with no plugin code changes
* **Distinct from kit-shipped plugins** — this is Fabric's own first-party plugin, not a kit-shipped VS Code plugin per ADR-0019
* **Per-window workspace context** — one VS Code window naturally maps to one Fabric workspace; this should be the default
* **Surface parity** — the plugin must reach all Fabric capabilities (workspace, branches, worktrees, commits, scripts, PRs, kit web extensions) through one cohesive UI
* **Marketplace distribution** — the plugin should ship through the VS Code Marketplace as the official `Fabric` extension

## Considered Options

1. **No First-Party VS Code Plugin** — VS Code users invoke `fabric` from the integrated terminal; Fabric does not ship a native extension
2. **CLI-Wrapper Extension** — extension exists but spawns `fabric <command>` for each user action and parses output
3. **Thin Native Plugin Connecting to REST API** — extension is a thin native VS Code plugin that connects to the Fabric REST API (ADR-0020) for all operations

## Decision Outcome

Chosen option: **Option 3 — Thin Native Plugin Connecting to REST API**, because Cyber Fabric needs a first-party VS Code extension that feels native, reuses the same canonical transport as the Web UI, and works identically against local and cloud Fabric without plugin code changes. CLI-wrapper extensions are slow and brittle; absent extensions cede the entire VS Code population to other tools.

The decision has these parts:

1. **Official `Fabric` VS Code extension** published to the VS Code Marketplace as Fabric's first-party host adapter for VS Code (concrete instantiation of the host-adapter pattern from ADR-0003).

2. **REST API client** — the extension connects to Fabric REST API (ADR-0020) for all operations. It does not call Fabric core directly, does not invoke the CLI as a subprocess, and does not duplicate operation logic. Local desktop use connects to a localhost REST API; cloud Fabric use connects to a configured remote REST API endpoint — both with the same plugin code.

3. **Per-window workspace context** — one VS Code window corresponds to one Fabric workspace, derived by default from the open folder or `.code-workspace` per ADR-0012 (workspace interop). Users can switch the active workspace through the VS Code Command Palette, which updates the plugin's REST API context per ADR-0025.

4. **Capability surfaces inside VS Code:**
   * **Workspace info, branches, worktrees, commits** — surfaced through Tree Views in a Fabric Side Panel
   * **Scripts (ADR-0017)** — discoverable and runnable through the VS Code Command Palette as `Fabric: Run Script ...`
   * **Kit web extensions (ADR-0018)** — rendered as VS Code webview panels, mounted on demand
   * **Pull requests (ADR-0024)** — visualization, review, and the markdown-aware review affordances surfaced through Tree Views and webviews; line-comment / suggestion blocks integrate with VS Code's diff view where possible
   * **PR markdown rendering** — uses VS Code's built-in markdown renderer for spec / ADR / documentation review

5. **Shipped inside the `core` kit (per ADR-0030)** — the Fabric VS Code extension is delivered as a kit-shipped dev tool plugin per ADR-0019's host-native packaging convention, packaged inside the core-bundled `core` kit. This unifies the delivery model: kits and Fabric core both use ADR-0019's mechanism. Third-party kits may also ship their own VS Code plugins via ADR-0019; those are independent of this Fabric extension. The `core` kit's plugin is the canonical Fabric extension and ships with Fabric itself.

The exact UI layout, the precise set of contributed views and commands, the mechanism for configuring the REST API endpoint (local versus remote), the relationship to VS Code's own SCM and Source Control views, and the activation events are intentionally left to follow-on design.

### Consequences

* Good, because VS Code users get all Fabric capabilities through native VS Code UI without leaving the editor
* Good, because the plugin reuses the REST API canonical transport, so cloud Fabric works without code changes
* Good, because the extension stays thin (UI + REST client) and lifts most logic to Fabric core
* Good, because surface parity with CLI and Web UI is structural — same REST endpoints, same data
* Good, because per-window workspace context maps cleanly to how users actually use VS Code
* Bad, because the plugin must be maintained as a stability surface alongside Fabric core and REST API
* Bad, because VS Code marketplace publication, signing, and extension lifecycle add operational concerns
* Bad, because some kit-shipped VS Code plugins (ADR-0019) and the Fabric first-party extension may want to integrate (e.g. a kit's plugin shipping a custom PR review experience); the integration contract is follow-on design

### Confirmation

Confirmed when:

* the official `Fabric` VS Code extension is published to the VS Code Marketplace
* the extension is a client of the Fabric REST API (ADR-0020); it does not call Fabric core directly and does not invoke the CLI as a subprocess
* per-window workspace context is derived from the open folder or `.code-workspace` per ADR-0012, with manual override via Command Palette per ADR-0025
* workspace info, branches, worktrees, commits, scripts, PRs, and kit web extensions are all surfaced through native VS Code UI
* the same plugin code works against local and remote REST API endpoints
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

* Good, because the plugin is fast and feels native
* Good, because the same plugin code works locally and in cloud Fabric scenarios
* Good, because it composes with the REST API contract and gets typed bindings via OpenAPI
* Bad, because the plugin must be maintained alongside Fabric core and REST API
* Bad, because the plugin's UX surface (views, commands, webviews) needs careful design to not feel scattered

## More Information

The plugin's contributed surfaces include (at minimum):

* a Fabric Side Panel containing Tree Views for workspace, branches, worktrees, commits, and PRs
* Command Palette entries (`Fabric: ...`) for scripts (ADR-0017), workspace switching, kit web extension activation
* webview panels for kit web extensions (ADR-0018) mounted on demand
* PR review surfaces using VS Code's diff view and markdown renderer where possible

The exact view layout, the contributed configuration schema (REST API endpoint configuration, auth credentials when remote), activation events, the Source Control view integration, the relationship between this first-party extension and any kit-shipped VS Code plugins (ADR-0019) that surface PR review or other Fabric-adjacent features, and the marketplace publishing process are intentionally left to follow-on design.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-surface-vscode-plugin`, `cpt-cyber-fabric-usecase-pe-ship-web-extension`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0012](0012-cpt-cyber-fabric-adr-vscode-workspace-interop-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md), [ADR-0024](0024-cpt-cyber-fabric-adr-pull-requests-as-first-class-concept-v1.md), [ADR-0025](0025-cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must ship a first-party VS Code extension as the host adapter for VS Code per ADR-0003
* the extension must be a client of the Fabric REST API (ADR-0020); it must not call Fabric core directly or invoke the CLI as a subprocess
* the extension is distinct from kit-shipped VS Code plugins (ADR-0019) — it is Fabric's own first-party plugin
* per-window workspace context follows ADR-0012 and ADR-0025
* workspace, branches, worktrees, commits, scripts, PRs, and kit web extensions are surfaced through native VS Code UI
* the same extension code works against local and remote REST API endpoints
