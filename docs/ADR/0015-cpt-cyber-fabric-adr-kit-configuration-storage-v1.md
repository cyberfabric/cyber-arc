---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0015: Kit Configuration Storage with Local, Global, and In-Repo Scopes, Kit-Namespacing, and Backend-Agnostic SDK

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Platform Storage, Each Kit Invents Its Own](#option-1-no-platform-storage-each-kit-invents-its-own)
  - [Option 2: Single-Scope Key-Value Store](#option-2-single-scope-key-value-store)
  - [Option 3: Multi-Scope, Kit-Namespaced, Backend-Agnostic SDK](#option-3-multi-scope-kit-namespaced-backend-agnostic-sdk)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-kit-configuration-storage`

## Context and Problem Statement

Kit-shipped resources repeatedly need to persist small structured data: feature flags, last-used parameters, per-project preferences, cached intermediate results, ad hoc state across runs. If every kit invents its own storage, kits diverge in format, location, scoping rules, and lifecycle, and end users have no consistent way to inspect, back up, reset, or migrate that state. Kits also have no shared way to express that some data should live with the project (and be committed), some with the user (across projects), and some only in the current workspace (and never travel).

The platform therefore needs a built-in, kit-facing storage primitive that is simple enough for a kit author not to think about, but expressive enough to handle the real cases: per-project state, per-user state, in-repo state (committed deliberately), and a future where the backend might not be a flat file at all.

## Decision Drivers

* **Author ergonomics** — the kit developer should treat storage as a localStorage-shaped primitive: `get`, `set`, `list`, `delete`, with no schema management or migration burden by default
* **Scope choice belongs to the kit and ultimately the user** — the same kit often wants some keys per-project (workspace) and others per-user (global); kits should be able to direct each key
* **In-repo persistence option** — some state belongs in the repository, committed and reviewed; the kit must be able to direct a key there explicitly
* **Backend-agnostic API** — the current backend is files, but a future backend may be a database or a remote store; kit code should not change when the backend swaps
* **Per-kit isolation** — kit A must not accidentally read or mutate kit B's storage; cross-kit access requires explicit grant
* **Operator inspectability** — operators need a consistent way to inspect, reset, or migrate stored state across kits

## Considered Options

1. **No Platform Storage, Each Kit Invents Its Own** — Fabric provides nothing; every kit chooses its own format and location
2. **Single-Scope Key-Value Store** — Fabric provides one scope (workspace OR global, not both) and a flat k-v API
3. **Multi-Scope, Kit-Namespaced, Backend-Agnostic SDK** — Fabric provides workspace, global, and in-repo scopes with per-key choice, kit-namespacing by construction, and an SDK that hides the underlying backend so it can evolve from files to a database without kit code changes

## Decision Outcome

Chosen option: **Option 3 — Multi-Scope, Kit-Namespaced, Backend-Agnostic SDK**, because Cyber Fabric needs every kit-shipped script and web extension to persist state without reinventing storage, while still letting kits direct where each piece of state belongs and letting the platform evolve its backend over time. The model is intentionally close to browser localStorage in shape: `get`, `set`, `delete`, `list`, JSON-serializable values, no schema enforcement.

The storage is **kit-namespaced by construction**. A kit identified by `<kit-id>` reads and writes only into its own namespace; the SDK does not expose paths or keys outside that namespace. Cross-kit access requires an explicit grant mechanism whose exact shape is intentionally left to follow-on design.

The storage exposes three **placement scopes**, chosen per key by the kit:

1. **Workspace-local** — per project / workspace; default file location `.fabric/storage/kits/<kit-id>/<collection>.json`. The default scope when a kit does not specify.
2. **Global** — per user, across the user's projects; default file location `~/.fabric/storage/kits/<kit-id>/<collection>.json`.
3. **In-repo** — committed into the repository alongside source; default file location `<repo-root>/.fabric/storage/kits/<kit-id>/<collection>.json` and registered for git tracking by the kit author.

The SDK exposes operations such as `fabric.storage.local.get(collection, key)` / `set(...)` / `delete(...)` / `list(...)` and analogous `fabric.storage.global.*` and `fabric.storage.repo.*`. The kit author does not handle file I/O, locking, JSON serialization, or schema management; the storage layer owns those concerns.

The **backend is intentionally hidden** behind the SDK. The current implementation uses JSON files at the paths above. A future Fabric configuration may swap the backend (for example to a local SQLite database, an embedded key-value engine, or a remote cloud-backed store) without requiring kit code changes. Fabric's runtime configuration may also override the default file paths; kit code does not depend on them.

The CLI surface for operators is at minimum:

* `fabric storage list [--kit <id>] [--scope local|global|repo] [--json]`
* `fabric storage get <kit> <scope> <collection> <key> [--json]`
* `fabric storage set <kit> <scope> <collection> <key> <value>`
* `fabric storage delete <kit> <scope> <collection> <key>`

The CLI is operational — kits do not call the CLI to read or write their own data; they call the SDK directly per ADR-0001 and ADR-0002. The CLI exists for inspection, debugging, manual overrides, and migration tooling.

### Consequences

* Good, because kit authors get a localStorage-shaped primitive without thinking about files, schema, or migration
* Good, because per-key scope choice supports both ephemeral per-project state and cross-project user settings
* Good, because in-repo placement gives kits a clean way to ship reviewable state that is part of delivery output
* Good, because backend abstraction lets the platform evolve from files to a database without changing kit code
* Good, because operators get one consistent CLI for inspecting and managing storage across kits
* Good, because kit-namespacing prevents accidental collisions and enables clean kit uninstall (delete the namespace)
* Bad, because three scopes plus per-key choice add cognitive surface compared to a single-scope k-v
* Bad, because in-repo placement creates a soft contract with git workflows (commit policy, conflicts) that needs documentation
* Bad, because backend abstraction means some advanced features (transactions, queries, indices) are not in the default SDK and require explicit follow-on design

### Confirmation

Confirmed when:

* a kit can call `fabric.storage.local.set / get / delete / list`, `fabric.storage.global.*`, and `fabric.storage.repo.*` from its scripts and web extensions
* every storage call is automatically kit-namespaced through the SDK; a kit cannot read or write outside its `<kit-id>` namespace through the default SDK
* default file paths follow `.fabric/storage/kits/<kit-id>/<collection>.json` for workspace, `~/.fabric/storage/kits/<kit-id>/<collection>.json` for global, and `<repo-root>/.fabric/storage/kits/<kit-id>/<collection>.json` for in-repo
* Fabric runtime configuration can override the default backend without requiring kit code changes
* `fabric storage list / get / set / delete` exist for operators and respect kit, scope, and collection filters

## Pros and Cons of the Options

### Option 1: No Platform Storage, Each Kit Invents Its Own

Fabric provides nothing; every kit picks its own format and location.

* Good, because the platform avoids owning a storage model
* Good, because kits with niche needs are not constrained by a shared shape
* Bad, because every kit reinvents its own scheme
* Bad, because operators cannot inspect, back up, or reset state in one place
* Bad, because kits cannot share scope semantics (workspace, global, in-repo) cleanly

### Option 2: Single-Scope Key-Value Store

Fabric provides one scope (workspace OR global, not both) and a flat k-v API.

* Good, because the SDK and CLI surface stay minimal
* Good, because semantics are easier to explain
* Bad, because kits routinely need state at more than one scope; pushing them to choose one forces awkward workarounds
* Bad, because the in-repo case (committed reviewable state) has no clean home
* Bad, because future-state needs such as shared user preferences across machines are not addressable

### Option 3: Multi-Scope, Kit-Namespaced, Backend-Agnostic SDK

Workspace, global, and in-repo scopes; per-key kit-controlled choice; opaque backend.

* Good, because every realistic placement need has a home
* Good, because kit code stays simple even as the backend evolves
* Good, because operators get a uniform inspection surface
* Good, because kit-namespacing prevents collisions by construction
* Bad, because three scopes plus per-key choice need teaching
* Bad, because the in-repo scope creates an implicit contract with git workflows

## More Information

The default file paths for the three scopes are:

* Workspace-local: `.fabric/storage/kits/<kit-id>/<collection>.json`
* Global: `~/.fabric/storage/kits/<kit-id>/<collection>.json`
* In-repo: `<repo-root>/.fabric/storage/kits/<kit-id>/<collection>.json`

The exact JSON schema for collections, the lock and concurrency model under the file backend, the semantics of cross-kit access grants, the default backend swap mechanism, and the migration behavior between backends are intentionally left to follow-on design. What this ADR fixes is the existence of the three scopes, the kit-namespacing rule, the SDK shape (`get` / `set` / `delete` / `list`), and the operator CLI surface.

This ADR's storage primitive is consumed by the script ADR (ADR-0017), the web UI / web extensions ADR (ADR-0018), and the dev tool plugins ADR (ADR-0019).

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-kits-only-extension-mechanism`, `cpt-cyber-fabric-fr-per-kit-dependency-isolation`
- **Related decisions**: [ADR-0005](0005-cpt-cyber-fabric-adr-minimal-installation-footprint-v1.md), [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources-v1.md)

This decision directly addresses the following traceability items:

* kits must have a built-in key-value storage primitive
* the storage must support workspace-local, global, and in-repo scopes
* the SDK must hide the backend so it can evolve from files to a database without kit code changes
* every storage call must be kit-namespaced by construction
* operators must have a CLI surface for inspecting and managing storage across kits
