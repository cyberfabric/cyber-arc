---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0019: Dev Tool Plugins as Kit Resources with Delivery-Only Lifecycle

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Platform-Level Dev Tool Plugin Support](#option-1-no-platform-level-dev-tool-plugin-support)
  - [Option 2: Delivery-Only](#option-2-delivery-only)
  - [Option 3: Runtime Owner](#option-3-runtime-owner)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources`

## Context and Problem Statement

Kit authors frequently want to ship integrations for the developer tools their users already use: VS Code extensions, JetBrains plugins, Cursor extensions, Claude Code plugins, agentic-tool plugins, and so on. Today, distributing such integrations alongside a kit requires every author to invent their own delivery scheme, and the kit user has to install or update the integration through each host's separate mechanism, with no relationship to the kit's own version or lifecycle.

The platform therefore needs a **dev tool plugins as kit resources** concept: a kit declares the dev tool plugins it ships, Fabric installs and registers them through the relevant host adapter (ADR-0003), and `fabric` keeps the kit-version-to-plugin mapping in sync without trying to own the plugin's runtime — the host runtime owns load, unload, update, and restart.

## Decision Drivers

* **Co-distribution with kit** — dev tool plugins should travel with their kit, with kit-version-controlled lifecycle
* **Host-native packaging** — plugins must be packaged in each host's standard format (`.vsix`, `claude-plugin/`, JetBrains plugin, etc.) so that hosts load them through their existing mechanisms
* **Host adapter as integration point** — installation and registration go through host adapters per ADR-0003; no new parallel integration surface
* **Runtime stays with the host** — Fabric does not implement plugin sandboxing, lifecycle, or runtime; those are the host's strengths
* **Update flow follows the kit** — bumping the kit version triggers re-registration; no separate plugin update flow
* **Extensibility to new hosts** — adding support for another developer tool means writing one host adapter, not redesigning the kit-resource concept

## Considered Options

1. **No Platform-Level Dev Tool Plugin Support** — kits document "install this plugin manually"
2. **Delivery-Only** — kits package plugins in host-native format; Fabric installs and registers them via host adapters; runtime stays with the host
3. **Runtime Owner** — Fabric also actively manages plugin runtime: load, unload, sandbox, permissions

## Decision Outcome

Chosen option: **Option 2 — Delivery-Only**, because Cyber Fabric should be the delivery vehicle that travels with kits, while leaving plugin runtime — load, unload, update, restart, sandboxing, permissions — to each host's existing, mature mechanism. Becoming a runtime owner (Option 3) would require building a parallel plugin runtime per host with no clear benefit, and "no platform support" (Option 1) loses kit-version-controlled lifecycle entirely.

A kit declares the dev tool plugins it ships in its manifest. Each declaration includes at minimum:

* The host the plugin targets (`vscode`, `jetbrains`, `cursor`, `claude-code`, `cline`, etc.; the canonical set is follow-on design)
* The path within the kit to the host-native plugin package (`.vsix`, `claude-plugin/<name>/`, JetBrains plugin `.jar`, etc.)
* A stable plugin id within the kit

Fabric installs and registers each declared plugin through the corresponding host adapter (ADR-0003). The host adapter knows how to call the host's installation mechanism — for example, calling `code --install-extension <path>` for VS Code, copying `claude-plugin/<name>/` into the appropriate Claude Code plugin directory, etc.

Runtime — load, unload, restart, permission prompts, plugin updates within a session — is owned entirely by the host. Fabric does not implement plugin sandboxing or lifecycle management. The kit-version-to-plugin mapping is what Fabric tracks: bumping the kit version triggers re-registration through the host adapter, and the host then picks up the new plugin through its own update path.

The CLI surface for operators is at minimum:

* `fabric plugin list [--kit <id>] [--host <h>] [--json]` — list plugins shipped by installed kits
* `fabric plugin info <kit>:<id> [--json]` — return the structured record for one plugin (kit, id, host, install state, version)
* `fabric plugin install <kit>:<id>` — install / register through the matching host adapter
* `fabric plugin uninstall <kit>:<id>` — uninstall / deregister through the matching host adapter

The Web UI (ADR-0018) surfaces the same operations per ADR-0001 and ADR-0002.

### Consequences

* Good, because dev tool plugins travel with their kit and inherit the kit's version lifecycle
* Good, because Fabric does not duplicate host-specific runtime mechanics — load, unload, sandbox, restart stay with the host
* Good, because adding support for a new host (Cursor, Zed, etc.) is a host-adapter-shaped task, not a redesign
* Good, because operators get a uniform install / inspect / uninstall surface across all kit-shipped plugins
* Good, because the same surface is reachable from the Web UI per ADR-0001 and ADR-0002
* Bad, because Fabric cannot intervene in plugin runtime issues — it can only re-register on kit version change
* Bad, because each host adapter must implement install / register / uninstall correctly; bugs there affect kit users
* Bad, because plugin packaging differences across hosts mean the manifest format must be expressive enough to describe each host

### Confirmation

Confirmed when:

* a kit can declare dev tool plugins in its manifest, each with host, package path, and stable id
* `fabric plugin install <kit>:<id>` registers the plugin through the matching host adapter (ADR-0003)
* `fabric plugin uninstall <kit>:<id>` deregisters through the same adapter
* `fabric plugin list` enumerates plugins across kits with kit and host filters
* runtime concerns (load, unload, sandbox, permissions, in-session updates) are not implemented by Fabric — they are owned by the host
* bumping a kit version re-registers its plugins through the host adapter; the host then handles update through its own mechanism
* the same surface is available from the Web UI (ADR-0018) per ADR-0001 and ADR-0002

## Pros and Cons of the Options

### Option 1: No Platform-Level Dev Tool Plugin Support

Kits document "install this plugin manually"; Fabric does nothing.

* Good, because the platform owns less surface
* Bad, because plugin lifecycle is detached from kit lifecycle
* Bad, because users do per-host installation manually for every kit they install
* Bad, because operators have no uniform inspection surface for kit-shipped plugins

### Option 2: Delivery-Only

Kits package plugins in host-native format; Fabric installs and registers them via host adapters; runtime stays with the host.

* Good, because dev tool plugins travel with their kit
* Good, because Fabric does not duplicate host-specific runtime mechanics
* Good, because new hosts are added through the existing host-adapter pattern
* Good, because operators get a uniform install / inspect / uninstall surface
* Bad, because Fabric cannot intervene in plugin runtime issues
* Bad, because each host adapter must implement install / register / uninstall correctly

### Option 3: Runtime Owner

Fabric also actively manages plugin runtime: load, unload, sandbox, permissions.

* Good, because Fabric could enforce uniform runtime semantics across hosts
* Bad, because each host already has a mature runtime; Fabric would be reimplementing it from scratch per host
* Bad, because plugin authors expect host runtime behavior; Fabric runtime would diverge in subtle ways
* Bad, because the platform takes on a large new ongoing maintenance surface with no clear benefit

## More Information

The canonical set of supported hosts (`vscode`, `jetbrains`, `cursor`, `claude-code`, `cline`, etc.), the manifest format for plugin declarations, the host-adapter-side install / register / uninstall contract, the build pipeline for producing host-native plugin packages from kit sources (so the kit author does not always hand-build a `.vsix`), version compatibility windows between kit version and host version, and the conflict-resolution rules when multiple kits ship plugins for the same host are intentionally left to follow-on design.

Each host integration follows the host-adapter pattern from ADR-0003. The pattern itself does not need to change for new hosts — only a new adapter is added.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-kits-only-extension-mechanism`, `cpt-cyber-fabric-fr-surface-vscode-plugin`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-kit-configuration-storage-v1.md), [ADR-0016](0016-cpt-cyber-fabric-adr-kit-assets-v1.md)

This decision directly addresses the following traceability items:

* kits must be able to ship dev tool plugins for IDEs and agentic tools
* plugins must be packaged in each host's native format
* installation and registration go through host adapters per ADR-0003
* Fabric is the delivery vehicle and version-controller; runtime (load, unload, sandbox, permissions, in-session updates) stays with the host
* `fabric plugin list / info / install / uninstall` provides the operator CLI surface
* the same surface is reachable from the Web UI per ADR-0001 and ADR-0002
