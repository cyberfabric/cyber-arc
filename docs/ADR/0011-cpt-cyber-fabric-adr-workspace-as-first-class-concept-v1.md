---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0011: Workspace as a First-Class Fabric Concept with init/add/remove/list/info Operations and a Global Workspace Registry

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Formal Workspace Concept](#option-1-no-formal-workspace-concept)
  - [Option 2: Workspace as a First-Class Fabric Concept with CLI Operations and Global Registry](#option-2-workspace-as-a-first-class-fabric-concept-with-cli-operations-and-global-registry)
  - [Option 3: Inherit the Workspace Concept from a Specific IDE](#option-3-inherit-the-workspace-concept-from-a-specific-ide)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-workspace-as-first-class-concept`

## Context and Problem Statement

Real Cyber Fabric work frequently spans more than one folder or repository — a delivery feature might touch a frontend repo, a backend repo, and a shared design-system kit at the same time. Today, every Fabric command that needs that multi-folder context must be told the relevant paths ad hoc, which makes operations such as "run this kit across all the repos I'm currently working on", "share workspace-scoped kits across the right set of folders", or "show me what Fabric knows about my current working set" awkward and error-prone. Users also routinely have **multiple workspaces** — separate projects each with their own working set — and need to enumerate, address, and refer to them by name across surfaces.

If Cyber Fabric does not introduce a formal workspace concept, every multi-repo flow has to reinvent path collection, scope handling, and state representation, and there is no canonical way to refer to a workspace by name. If Cyber Fabric instead inherits a workspace concept from a single IDE — for example by requiring users to maintain a `.code-workspace` file as the source of truth — the platform becomes coupled to that ecosystem and IDE-less environments such as plain CLI sessions, CI runners, and other editors lose first-class workspace support.

## Decision Drivers

* **Multi-repo work** — modern delivery often spans several repositories that should share Fabric state and configuration
* **Multi-workspace operation** — users have multiple projects; Fabric must enumerate, address, and reason about all of them through one model
* **IDE independence** — workspace should be a Fabric concept first, not a wrapper over one IDE's data model
* **Discoverable CLI** — operators must be able to inspect, mutate, and query workspace state through one consistent command surface
* **Knowledge primitive** — other tools and integrations need a single canonical command to ask "what does Fabric know about this workspace?" and "what workspaces exist?"
* **Kit scope alignment** — workspace must be the natural home for workspace-scoped kits as defined in ADR-0008
* **Minimal local footprint** — local files in repositories must stay small and reviewable per ADR-0005; the bulk of workspace knowledge lives elsewhere

## Considered Options

1. **No Formal Workspace Concept** — every Fabric command receives folder / repository paths ad hoc, and there is no shared workspace state
2. **Workspace as a First-Class Fabric Concept with CLI Operations and Global Registry** — Fabric introduces a named workspace abstraction with `init`, `add`, `remove`, `list`, and `info` commands; workspace knowledge lives in a global per-user registry (with optional small local registration files in repositories as shortcuts); workspace is independent of any IDE
3. **Inherit the Workspace Concept from a Specific IDE** — require users to maintain (for example) a `.code-workspace` file and treat that as the authoritative workspace definition

## Decision Outcome

Chosen option: **Option 2 — Workspace as a First-Class Fabric Concept with CLI Operations and Global Registry**, because Cyber Fabric needs a stable, IDE-independent way to talk about both a single multi-folder working set and the set of all workspaces a user has, so that multi-repo flows, workspace-scoped kits (ADR-0008), and the shared Fabric core (ADR-0002) all have clear addressable targets.

A **Fabric workspace** is a named set of repositories that share Fabric configuration, workspace-scoped kits, and operational state. **The workspace is never a folder** — it is a logical grouping of repositories, which themselves live in folders that may be in different locations on disk. A workspace exists independently of any IDE; an IDE can map onto the workspace through interop adapters (see ADR-0012 for VS Code interop), but no IDE is required for a workspace to be valid.

The core CLI surface is:

* `fabric workspace init [path]` — initialize a workspace in a directory; registers the workspace globally and registers the repository at that path as the first member; optionally writes a local registration file (see below) into the repository for fast re-registration on other machines
* `fabric workspace add <path>` — add a repository at the given path to the current workspace; the repository becomes a member of the workspace and part of all workspace-scoped operations
* `fabric workspace remove <path>` — remove a repository from the current workspace; the repository remains on disk but is no longer a member
* `fabric workspace list [--json]` — list every Fabric workspace known to the user across all projects; reads the global workspace registry and returns workspace name, member repositories, and any computed metadata; this command is workspace-agnostic and can run without being inside a workspace per ADR-0025
* `fabric workspace info [--json]` — emit structured workspace knowledge for the current workspace: workspace name, list of member repositories (with their paths), configured kits at workspace scope, and any computed metadata that other tools need to consume

`fabric workspace info` is positioned as the canonical knowledge primitive — other tools, IDE adapters, and remote agents call it rather than reading the registry directly, so that the shape of workspace knowledge can evolve without breaking consumers.

**Workspace knowledge is global, not project-local.** Every workspace is recorded in a per-user **global workspace registry** (default location `~/.fabric/workspaces/...`, exact format and storage layout left to follow-on design) so a workspace can be addressed by name regardless of where the user happens to be on disk. The global registry is what `fabric workspace list` reads and what surfaces (CLI, REST API, Web UI, VS Code plugin per ADR-0025) resolve workspace names against.

Repositories may additionally contain a small **local registration file** at `.fabric/workspaces/<name>.toml`. The sole purpose of the local file is to make registering the workspace globally trivial when the repository is cloned on a new machine: when Fabric encounters such a file in CWD or its ancestors, and the workspace `<name>` is not yet in the global registry, Fabric registers it on first encounter. The local file is a **convenience shortcut, not the source of truth** — it stays small enough to satisfy ADR-0005's minimal-footprint discipline, but it does not replace the global registry. The exact schema of both the global registry and the local registration file is intentionally left to follow-on design.

How each surface (CLI, REST API, Web UI, VS Code plugin) resolves *which* workspace a given operation targets — including the auto-detect-from-CWD behavior of CLI that walks up to find a local registration file, and the URL-path scheme of REST API — is decided in ADR-0025.

### Consequences

* Good, because multi-repo flows have one stable target instead of reinventing path collection per command
* Good, because workspace-scoped kits from ADR-0008 have a concrete container to live in
* Good, because `fabric workspace list` enumerates every known workspace through one canonical command, supporting cross-workspace ergonomics
* Good, because `fabric workspace info` gives every other tool a single canonical way to obtain workspace knowledge
* Good, because the global registry makes workspaces addressable by name from any CWD
* Good, because local registration files stay small and only exist as a fast-onboarding shortcut, satisfying ADR-0005
* Good, because the workspace concept is independent of any IDE, so CLI sessions, CI runners, and IDE-less environments work the same way
* Bad, because Fabric must now own the global workspace registry and its lifecycle (creation, mutation, consistency, removal, migration)
* Bad, because the relationship between local registration files and the global registry needs explicit rules (auto-register on first encounter, behavior when registry and local file disagree)
* Bad, because workspace state schema choices in the global registry become a stability surface that future versions must respect or migrate

### Confirmation

Confirmed when:

* `fabric workspace init`, `fabric workspace add`, `fabric workspace remove`, `fabric workspace list`, and `fabric workspace info` are implemented and behave as the canonical operations described above
* a workspace can be created and used without any IDE-specific configuration file
* `fabric workspace info` returns structured workspace knowledge (with a `--json` mode for consumers) including members, kit inventory at workspace scope, and registry-side metadata
* `fabric workspace list` returns every workspace known to the user across all projects, regardless of CWD
* workspace knowledge lives in a global per-user registry; local registration files at `.fabric/workspaces/<name>.toml` exist only as fast-onboarding shortcuts that auto-register the workspace on first encounter
* workspace-scoped kits (ADR-0008) resolve through this workspace concept rather than through ad hoc path collection

## Pros and Cons of the Options

### Option 1: No Formal Workspace Concept

Every Fabric command takes folder / repository paths ad hoc and there is no shared workspace state.

* Good, because the platform avoids owning any workspace state model
* Good, because the initial CLI surface stays smaller
* Bad, because every multi-repo flow reinvents path collection
* Bad, because workspace-scoped kits (ADR-0008) have no addressable container to live in
* Bad, because tools and integrations have nothing to call to ask "what is the current working set?" or "what workspaces exist?"

### Option 2: Workspace as a First-Class Fabric Concept with CLI Operations and Global Registry

Fabric introduces a named workspace abstraction with `init`, `add`, `remove`, `list`, and `info` commands; knowledge lives in a global per-user registry; local registration files in repositories are convenience shortcuts.

* Good, because multi-repo flows and workspace-scoped kits get a stable target
* Good, because the global registry enables `list` and cross-workspace addressing by name
* Good, because `info` becomes the canonical workspace-knowledge primitive
* Good, because the workspace concept works the same in CLI, CI, and IDE environments
* Good, because local registration files keep onboarding to a new machine fast without making local files the source of truth
* Bad, because Fabric must own global workspace registry lifecycle and schema stability
* Bad, because IDE interop becomes a separate concern that needs its own decision (ADR-0012 for VS Code)
* Bad, because the relationship between global registry and local registration files needs explicit rules

### Option 3: Inherit the Workspace Concept from a Specific IDE

Require users to maintain a single IDE-specific workspace file (for example `.code-workspace`) and treat it as the authoritative workspace definition.

* Good, because Fabric does not have to own a state model of its own
* Good, because users who already use that IDE see no extra concept
* Bad, because the platform becomes coupled to one IDE
* Bad, because IDE-less environments lose first-class workspace support
* Bad, because workspace semantics get dictated by an IDE's data model rather than by Fabric's actual needs
* Bad, because `fabric workspace list` across all the user's projects has no clean home — IDE-specific files are scattered

## More Information

The CLI surface defined by this ADR:

* `fabric workspace init [path]`
* `fabric workspace add <path>`
* `fabric workspace remove <path>`
* `fabric workspace list [--json]`
* `fabric workspace info [--json]`

All other workspace-related capabilities — interop with IDE workspace formats (see ADR-0012 for VS Code), multi-workspace coordination, remote workspace synchronization — are expected to build on this surface rather than replace it.

The exact format and storage of the **global workspace registry** (single file, directory of per-workspace files, key-value store, etc.), the schema of the **local registration file** at `.fabric/workspaces/<name>.toml`, the rules when global registry and local file disagree (for example registry says workspace `X` lives at `/a/b`, local file says it lives at `/c/d`), and the migration / rename behavior are intentionally left to follow-on design.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-workspace-named-multi-repo`, `cpt-cyber-fabric-fr-workspace-lifecycle`, `cpt-cyber-fabric-fr-workspace-context-resolution`, `cpt-cyber-fabric-nfr-minimal-footprint`, `cpt-cyber-fabric-usecase-dev-multi-repo-workspace`
- **Related decisions**: [ADR-0005](0005-cpt-cyber-fabric-adr-minimal-installation-footprint-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0012](0012-cpt-cyber-fabric-adr-vscode-workspace-interop-v1.md), [ADR-0025](0025-cpt-cyber-fabric-adr-multi-workspace-operation-and-context-resolution-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must have a first-class workspace concept independent of any IDE
* the workspace surface must include `init`, `add`, `remove`, `list`, and `info` operations
* `fabric workspace list` enumerates every workspace known to the user across all projects
* `fabric workspace info` is the canonical workspace-knowledge primitive
* workspace knowledge lives in a global per-user registry, not in project-local files
* local registration files at `.fabric/workspaces/<name>.toml` are convenience shortcuts that auto-register the workspace globally on first encounter
* workspace-scoped kits from ADR-0008 resolve through this workspace concept
* cross-surface workspace context resolution is delegated to ADR-0025
