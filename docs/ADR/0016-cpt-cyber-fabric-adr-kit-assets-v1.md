---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0016: Kit Assets Addressable by Identifier

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Platform Assets](#option-1-no-platform-assets)
  - [Option 2: Assets at Fixed Paths](#option-2-assets-at-fixed-paths)
  - [Option 3: Assets Addressable by Identifier](#option-3-assets-addressable-by-identifier)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-kit-assets`

## Context and Problem Statement

Kit-shipped resources frequently need to access static files: prompt fragments referenced by a script, image and icon assets used by a web extension, model files, schema files, fixtures, configuration templates. Without a platform-level concept, every kit invents its own way of locating these files: hard-coded relative paths, environment variables, manual install steps. That makes kits brittle when their installation scope changes (workspace, global, or core-bundled per ADR-0008), and it makes asset access opaque to operators and tools.

The platform therefore needs a first-class **assets** primitive: a kit can ship arbitrary files as assets, each asset has a stable identifier within the kit, and consumers retrieve the on-disk path of an asset by identifier through one consistent API regardless of where the kit is installed.

## Decision Drivers

* **Location independence** — kit asset access must work the same whether the kit is core-bundled, global, or workspace-scoped
* **Stable identifiers** — assets must be addressable by a kit-author-chosen id rather than a path, so refactoring layout doesn't break consumers
* **Arbitrary content types** — assets are any files: text, JSON, images, binary blobs, model files, fixtures; the platform does not interpret them
* **Tool transparency** — operators must be able to discover and inspect assets through one consistent CLI
* **SDK and CLI parity** — both kit code and operators reach assets through the same identifier model

## Considered Options

1. **No Platform Assets** — kits put files wherever they want and access them via ad hoc paths
2. **Assets at Fixed Paths** — kits ship files under known fixed paths inside the kit, and consumers compute absolute paths from the kit's installed location
3. **Assets Addressable by Identifier** — kit declares assets in its manifest with stable ids; consumers retrieve the on-disk path through one API regardless of installation scope

## Decision Outcome

Chosen option: **Option 3 — Assets Addressable by Identifier**, because Cyber Fabric needs kit assets to remain reachable through one consistent contract regardless of where the kit is installed (core-bundled, global, workspace-scoped per ADR-0008), while keeping the kit author free to organize files inside the kit however they prefer.

A kit declares its assets in its manifest with stable identifiers. The actual file layout inside the kit is the kit author's choice; the manifest maps identifiers to file paths within the kit. Consumers retrieve assets through:

* **CLI**: `fabric assets get <kit> <id>` returns the local filesystem path to the asset (resolves the kit's installation scope automatically); `fabric assets list [--kit <id>] [--json]` lists known assets across kits
* **SDK**: `fabric.assets.get(kit, id)` returns the same path for kit-shipped scripts (ADR-0017), web extensions (ADR-0018), and other consumers

The returned path is **read-only by contract** — kits and consumers must not write through the assets path. Mutable kit-controlled state is what storage (ADR-0015) is for; assets are immutable kit-shipped files.

When the kit is core-bundled (ADR-0008), assets resolve relative to the Fabric installation. When the kit is global, they resolve from the user-level kit directory. When the kit is workspace-scoped, they resolve from inside the workspace member repository. The asset SDK and CLI always return the correct path for the current installation regardless of scope.

### Consequences

* Good, because kit consumers reach assets through one stable id without caring how or where the kit is installed
* Good, because kit authors can freely refactor file layout as long as the manifest mapping stays correct
* Good, because operators get a uniform CLI for inspecting kit assets across all kits and scopes
* Good, because the assets primitive composes with the kit lifecycle: install, update, and uninstall propagate to assets automatically
* Good, because assets stay separated from mutable storage (ADR-0015) — different lifecycles, different responsibilities
* Bad, because the kit manifest must declare each asset; ad hoc files inside a kit are not asset-addressable
* Bad, because the read-only contract requires discipline (some consumers may try to write through the path)
* Bad, because assets that should change at runtime (for example caches) belong in storage (ADR-0015), not assets, and authors must understand the split

### Confirmation

Confirmed when:

* a kit declares its assets in the kit manifest with stable identifiers
* `fabric assets get <kit> <id>` returns the correct on-disk path regardless of whether the kit is core-bundled, global, or workspace-scoped (ADR-0008)
* `fabric assets list [--kit <id>] [--json]` enumerates assets across kits with kit and id filters
* the SDK provides `fabric.assets.get(kit, id)` returning the same path that the CLI returns
* the asset path is documented as read-only; mutable state belongs in storage (ADR-0015)

## Pros and Cons of the Options

### Option 1: No Platform Assets

Kits put files wherever they want and access them via ad hoc paths.

* Good, because the platform owns less surface
* Bad, because every kit reinvents asset access
* Bad, because installation scope changes (core, global, workspace) break ad hoc paths
* Bad, because operators have no uniform inspection surface

### Option 2: Assets at Fixed Paths

Kits ship files under known fixed paths inside the kit; consumers compute absolute paths from the kit installation location.

* Good, because the contract is simple — known relative paths
* Good, because no manifest declaration is needed
* Bad, because layout changes break consumers
* Bad, because the consumer still has to compute the absolute path from the kit's installation root, which differs across scopes
* Bad, because there is no built-in id-to-path indirection, so assets cannot be renamed or relocated cleanly

### Option 3: Assets Addressable by Identifier

Kit declares assets in its manifest with stable ids; consumers retrieve the on-disk path through one API regardless of installation scope.

* Good, because consumers reach assets through one stable id regardless of installation scope
* Good, because kit authors can refactor file layout freely
* Good, because operators get a uniform CLI surface
* Good, because the manifest gives a discoverable list of assets per kit
* Bad, because the kit manifest must declare each asset
* Bad, because the read-only contract needs explicit teaching

## More Information

The asset declaration form inside the kit manifest, the canonical CLI flags beyond `--json`, the discovery rules across kit scopes, the bundle-versus-stream semantics for very large assets, and the relationship to kit content addressing (for example integrity hashes) are intentionally left to follow-on design. What this ADR fixes is the existence of asset identifiers, the `fabric assets get / list` CLI surface, and the SDK function that returns the path.

Assets are immutable kit-shipped files. Mutable kit-controlled state belongs in storage (ADR-0015). The two primitives are intentionally separated.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-kits-only-extension-mechanism`, `cpt-cyber-fabric-usecase-pe-author-kit`, `cpt-cyber-fabric-usecase-pe-bundle-scripts-with-prompts`
- **Related decisions**: [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-kit-configuration-storage-v1.md), [ADR-0017](0017-cpt-cyber-fabric-adr-scripts-as-kit-resources-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md), [ADR-0019](0019-cpt-cyber-fabric-adr-dev-tool-plugins-as-kit-resources-v1.md)

This decision directly addresses the following traceability items:

* kits must be able to ship arbitrary files as assets
* assets must be addressable by stable kit-author-chosen identifiers
* `fabric assets get / list` must work consistently across all kit installation scopes
* the SDK must expose the same identifier-based access for kit code
* assets are read-only; mutable state lives in storage (ADR-0015)
