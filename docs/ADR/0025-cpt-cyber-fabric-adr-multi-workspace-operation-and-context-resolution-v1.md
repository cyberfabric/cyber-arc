---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0025: Multi-Workspace Operation and Workspace Context Resolution Across Surfaces

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: Implicit Active Workspace with Sticky State](#option-1-implicit-active-workspace-with-sticky-state)
  - [Option 2: Always-Explicit Workspace Flag](#option-2-always-explicit-workspace-flag)
  - [Option 3: Auto-Detect from Surface Context with Explicit Override](#option-3-auto-detect-from-surface-context-with-explicit-override)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution`

## Context and Problem Statement

ADR-0011 introduces Fabric workspaces as a first-class concept and provides per-workspace operations (`init`, `add`, `remove`, `info`, plus `list` after the multi-workspace amendment). In real use, every Fabric user has more than one workspace — separate projects, separate codebases, separate experiments. Fabric must therefore answer a question on every invocation or request: **which workspace does this operation target?**

Different surfaces have different natural answers. The CLI is invoked from a working directory and can sensibly auto-detect which workspace the user is in. The REST API receives explicit URL paths and can require workspace addressing in the path. The Web UI has visible UI controls and can offer an explicit workspace selector. The VS Code plugin lives inside a VS Code window with an open folder and can derive the workspace from there.

Without a documented context-resolution scheme, every surface invents its own behavior, users get inconsistent experiences, some commands silently operate on the wrong workspace, and CLI commands that should work without a workspace (`--help`, `workspace list`, `workspace init`) get tangled with commands that absolutely require one.

## Decision Drivers

* **Per-surface natural context** — CLI uses CWD, REST API uses URL path, Web UI uses selector, VS Code plugin uses open folder; each surface should use the resolution that fits it
* **Explicit override** — every surface must allow explicit workspace selection (e.g. CLI `--workspace <name>`, REST API URL path) so scripted and cross-workspace use cases work
* **General versus workspace-required commands** — some commands (help, version, workspace listing, workspace init) operate without a workspace and must not error on missing context; everything else must fail explicitly when no workspace is detected, with a clear remediation message
* **No invisible state** — sticky / "active workspace" models hide which workspace will be used; this confuses users when CWD changes
* **CLI ergonomics** — the common case "I am in my project, working on it" must require zero flags; at the same time, "I am not in any workspace" must produce clear errors, not silent fallbacks
* **Consistency across surfaces** — all surfaces share the same conceptual model: one workspace per invocation or request

## Considered Options

1. **Implicit Active Workspace with Sticky State** — Fabric tracks an "active workspace" globally; users `switch` between workspaces; commands operate on the currently active one regardless of CWD
2. **Always-Explicit Workspace Flag** — every command requires `--workspace <name>`; no auto-detection
3. **Auto-Detect from Surface Context with Explicit Override** — each surface auto-detects the workspace from its natural context (CWD for CLI, URL path for REST API, selector for Web UI, open folder for VS Code plugin), with an explicit override mechanism per surface; commands are classified as workspace-required or general

## Decision Outcome

Chosen option: **Option 3 — Auto-Detect from Surface Context with Explicit Override**, because Cyber Fabric needs a multi-workspace model that respects each surface's natural context, keeps CLI ergonomics for the common in-workspace case, fails explicitly when no workspace is available for workspace-required commands, and never silently mis-targets operations through invisible sticky state.

Each surface operates against exactly one workspace per invocation or request. Resolution differs by surface:

**CLI workspace resolution** (in priority order):

1. **Explicit `--workspace <name>` flag** — highest priority; `<name>` is looked up in the global workspace registry per ADR-0011
2. **CWD inside a registered workspace** — Fabric walks up from the current working directory until it finds a `.fabric/workspaces/<name>.toml` registration file (per ADR-0011); the named workspace is used, and Fabric registers it in the global workspace registry on first encounter if it is not already there
3. **Neither** → command classification:
   * **General commands** (workspace-agnostic) — `--help`, `--version`, `fabric workspace list`, `fabric workspace init`, `fabric kit list`, and similar — run without a workspace
   * **Workspace-required commands** — anything that operates on workspace state (branches, worktrees, commits, scripts, kits at workspace scope, PRs, etc.) — fail with an explicit error: `"No Fabric workspace detected. Run 'fabric workspace init' to create one, 'cd' into an existing workspace, or pass '--workspace <name>'."`

**REST API workspace resolution**:

* **Workspace embedded in URL path** — `/v1/workspaces/<name>/<resource>` for workspace-scoped resources
* **General endpoints** — `/v1/workspaces` (list and create), `/v1/health`, `/v1/openapi.json`, etc., are at the API root and need no workspace
* No header-based workspace selection; the URL path is the authoritative source of workspace context, which keeps requests self-describing and routable

**Web UI workspace resolution**:

* **Workspace selector in the UI** — visible control (in the header or sidebar) shows the current workspace and lets the user switch
* **URL includes the workspace id** — typically `/workspaces/<name>/<view>`; switching the selector updates the URL and reloads workspace-scoped views
* The Web UI is a client of the REST API per amended ADR-0018, so the URL parallels the REST API's path scheme

**VS Code plugin workspace resolution**:

* **Per-window workspace context** — one VS Code window corresponds to one Fabric workspace
* The workspace is derived by default from the window's open folder or `.code-workspace` file per ADR-0012; users can switch the active workspace through the VS Code Command Palette
* When no workspace can be derived, the plugin falls back to general commands only (mirroring CLI command classification)

**Command classification**: every Fabric command (CLI command and REST endpoint, with corresponding Web UI route) declares whether it requires a workspace. The default is workspace-required (the safe default — fail loudly rather than silently target the wrong workspace). New commands explicitly state their classification when they are added.

The **error message format** for workspace-required commands when no workspace is detected is fixed and explicit so users get the same remediation guidance everywhere:

> `No Fabric workspace detected. Run 'fabric workspace init' to create one, 'cd' into an existing workspace, or pass '--workspace <name>'.`

(REST API and Web UI present the equivalent semantic in their own format.)

### Consequences

* Good, because the common case "I am in my project" requires zero flags
* Good, because surface-specific natural context (CWD, URL, selector, open folder) is honored, not fought
* Good, because `--workspace <name>` always wins, supporting scripts and cross-workspace operations
* Good, because workspace-required commands fail loudly with clear remediation when no workspace is found, instead of silently picking a default
* Good, because general commands (`--help`, `workspace list`, `workspace init`) run unobstructed
* Good, because no invisible "active workspace" state can drift away from the user's mental model
* Good, because all four surfaces (CLI, REST API, Web UI, VS Code plugin) share one conceptual model
* Bad, because every new command must explicitly declare its workspace requirement (workspace-required by default, but the classification still has to live somewhere)
* Bad, because edge cases (CWD inside multiple nested workspaces, URL path with stale workspace name after rename) need explicit resolution rules
* Bad, because the global workspace registry (per amended ADR-0011) becomes a stability surface that all surfaces rely on for workspace lookup

### Confirmation

Confirmed when:

* CLI workspace resolution follows the priority order: `--workspace <name>` flag, then CWD-walk-up auto-detect, then command classification (general vs workspace-required) with the canonical error message for the workspace-required-but-missing case
* REST API workspace resolution uses `/v1/workspaces/<name>/<resource>` for workspace-scoped resources and root paths for workspace-agnostic endpoints
* Web UI URL includes the workspace id and provides a visible workspace selector
* VS Code plugin uses per-window workspace context derived from the open folder or `.code-workspace` per ADR-0012
* every Fabric command declares whether it requires a workspace; default is workspace-required
* the canonical error message is used consistently across all surfaces
* no invisible sticky / "active workspace" state is introduced

## Pros and Cons of the Options

### Option 1: Implicit Active Workspace with Sticky State

Fabric tracks an active workspace globally; users `switch` between workspaces; commands operate on the active one regardless of CWD.

* Good, because the user types fewer flags after the initial switch
* Bad, because `cd` into another project does not change which workspace Fabric uses — the gap between CWD and active workspace silently mis-targets operations
* Bad, because the active workspace is invisible state — users have to remember it
* Bad, because scripted use needs to either set the active workspace before each call (race condition with concurrent sessions) or pass an explicit override anyway
* Bad, because debugging "why did this command operate on the wrong workspace" is much harder

### Option 2: Always-Explicit Workspace Flag

Every command requires `--workspace <name>`; no auto-detection.

* Good, because the workspace target is always visible in the command line
* Good, because there is no surface-specific resolution logic to maintain
* Bad, because the common case "I am in my project" pays a flag tax on every command
* Bad, because shell history becomes verbose
* Bad, because the natural CWD-implied context is lost, and users develop ad hoc shell aliases to re-add it

### Option 3: Auto-Detect from Surface Context with Explicit Override

Each surface auto-detects from its natural context, with an explicit override and a command classification (workspace-required vs general).

* Good, because the in-workspace common case is zero-friction
* Good, because `--workspace` override supports scripts and cross-workspace operations
* Good, because workspace-required commands fail loudly rather than silently mis-targeting
* Good, because all surfaces share one conceptual model
* Bad, because every new command must declare its workspace requirement
* Bad, because edge cases (nested workspaces, stale workspace names, etc.) need explicit resolution rules

## More Information

The list of **general commands** (workspace-agnostic) at this ADR's writing includes at minimum:

* `fabric --help` and `--version`
* `fabric workspace list` and `fabric workspace init`
* `fabric kit list` (when the user wants to see installed kits across all scopes, not just within a workspace)

The list will grow as new commands are added; each new command declares its classification at the time it is introduced. The default for unspecified commands is **workspace-required** (safe default).

The exact behavior under nested workspaces (one workspace contained inside another), stale workspace names (a workspace renamed but a process still references the old name), simultaneous multi-workspace operations such as "run this script across all my workspaces" (intentionally out of scope of this ADR — that is a different and higher-level concept), and the relationship between this resolution scheme and the workspace registry's storage (workspace registry storage is itself follow-on design per amended ADR-0011) are intentionally left to follow-on design.

The canonical error message for missing workspace context in workspace-required CLI commands is:

```text
No Fabric workspace detected.
Run 'fabric workspace init' to create one, 'cd' into an existing workspace, or pass '--workspace <name>'.
```

REST API and Web UI present the equivalent semantic in their own format (HTTP 400 with structured body for REST API; UI banner with action buttons for Web UI).

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-workspace-context-resolution`, `cpt-cyber-fabric-usecase-dev-switch-workspace-context`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0012](0012-cpt-cyber-fabric-adr-vscode-workspace-interop-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0020](0020-cpt-cyber-fabric-adr-rest-api-as-fabric-surface-v1.md), [ADR-0021](0021-cpt-cyber-fabric-adr-vscode-plugin-fabric-host-adapter-v1.md)

This decision directly addresses the following traceability items:

* every Fabric surface must operate against exactly one workspace per invocation or request
* CLI workspace resolution follows the priority order: `--workspace <name>` flag, CWD-walk-up auto-detect, command classification fallback
* REST API uses `/v1/workspaces/<name>/<resource>` for workspace-scoped resources and root paths for general endpoints
* Web UI provides a workspace selector and includes the workspace id in the URL
* VS Code plugin uses per-window workspace context per ADR-0012
* every Fabric command declares whether it requires a workspace; default is workspace-required
* the canonical error message for missing workspace context is consistent across all surfaces
* no invisible sticky / "active workspace" state is introduced
