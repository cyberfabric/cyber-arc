---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0012: Bidirectional VS Code Workspace Interop with Init-Time Discovery and Multi-Config Handling

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Interop with IDE Workspace Files](#option-1-no-interop-with-ide-workspace-files)
  - [Option 2: One-Way Import Only from VS Code to Fabric](#option-2-one-way-import-only-from-vs-code-to-fabric)
  - [Option 3: Bidirectional Generation Plus Init-Time Discovery Plus Multi-Config Handling](#option-3-bidirectional-generation-plus-init-time-discovery-plus-multi-config-handling)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-vscode-workspace-interop`

## Context and Problem Statement

Many Cyber Fabric users already maintain VS Code workspace files (`.code-workspace`) that list the folders they actively work across. ADR-0011 introduces a Fabric-native workspace concept independent of any IDE, but if there is no bridge between that concept and existing VS Code workspaces, users end up maintaining the same folder list in two places, manually keeping them in sync, and choosing between Fabric-aware multi-repo workflows and their existing IDE setup.

If interop is one-way only — for example, "import a `.code-workspace` once and forget about it" — then changes made on either side drift, and there is no way to publish a Fabric workspace back into VS Code. If interop is absent entirely, Fabric loses adoption among the large existing population of users who already organize their work through `.code-workspace` files.

## Decision Drivers

* **Adoption** — users with existing `.code-workspace` files should not be forced to recreate their folder set in Fabric
* **No double bookkeeping** — the same workspace should be reachable from both sides without manual synchronization rituals
* **Init-time intelligence** — `fabric workspace init` should detect existing `.code-workspace` files and offer to bootstrap from them
* **Multi-config reality** — directories sometimes contain more than one `.code-workspace` file; the platform must handle that case explicitly rather than picking arbitrarily
* **Host-adapter pattern alignment** — interop should be expressed through the same conceptual pattern as other host integrations (ADR-0003) so that future IDE bridges can follow the same shape
* **Reversible bridge** — both directions of generation should be supported so that the two views remain mutually derivable instead of accidentally divergent

## Considered Options

1. **No Interop with IDE Workspace Files** — Fabric workspaces stand alone; users maintain `.code-workspace` separately
2. **One-Way Import Only from VS Code to Fabric** — Fabric can read a `.code-workspace` to bootstrap a Fabric workspace, but cannot generate a `.code-workspace` from a Fabric workspace
3. **Bidirectional Generation Plus Init-Time Discovery Plus Multi-Config Handling** — Fabric supports both `import` and `export`, `fabric workspace init` discovers existing `.code-workspace` files and offers interactive bootstrap, and the multi-`.code-workspace` case is handled with an explicit choose-or-merge prompt

## Decision Outcome

Chosen option: **Option 3 — Bidirectional Generation Plus Init-Time Discovery Plus Multi-Config Handling**, because Cyber Fabric must meet existing VS Code users where they are without forcing them to maintain parallel workspace definitions, and bidirectional generation makes the Fabric workspace and the VS Code workspace mutually derivable instead of accidentally divergent.

The decision has three parts:

1. **Bidirectional generation commands**:
   * `fabric workspace import <path-to-.code-workspace>` — generate a Fabric workspace from a VS Code workspace file. The folder list is mapped onto Fabric workspace members. VS Code-specific fields (`settings`, `extensions`, `tasks`, `launch`) are not part of the Fabric workspace model; whether they are preserved alongside, ignored, or surfaced as advisory metadata is left to follow-on design.
   * `fabric workspace export --target=vscode [path]` — generate a `.code-workspace` file from the current Fabric workspace. The Fabric workspace's member list becomes the `folders` array in the generated VS Code workspace file. If a target file already exists, the command must not silently overwrite it; the exact merge or refuse-and-prompt behavior is left to follow-on design.

2. **Init-time discovery in `fabric workspace init`**:
   * Scan the target directory for `.code-workspace` files
   * **Zero found** → proceed to create an empty Fabric workspace as defined by ADR-0011
   * **Exactly one found** → offer to bootstrap the Fabric workspace from it (interactive yes / no, plus a non-interactive `--from <path>` form for scripted use)
   * **Two or more found** → present an explicit user choice: either pick one specific `.code-workspace` to import, or **merge** several of them into one Fabric workspace by taking the union of their folder lists and deduplicating overlapping paths. Merging is the canonical answer to "I have several `.code-workspace` files and want one Fabric workspace covering all of them."

3. **Host-adapter pattern alignment**: VS Code interop is the first concrete instance of the host-adapter pattern from ADR-0003 applied at the workspace level. Future ADRs may add JetBrains, Zed, or other IDE interop following the same shape — an `import` command, an `export --target=<host>` command, and init-time discovery for that host's workspace files; this ADR does not commit to those.

### Consequences

* Good, because users with existing `.code-workspace` files can adopt Fabric workspaces without recreating their folder list
* Good, because Fabric workspaces can be published back into VS Code, so the two views are derivable from each other instead of accidentally divergent
* Good, because `fabric workspace init` automatically detects existing IDE workspace files instead of silently creating an empty one next to them
* Good, because the multi-`.code-workspace` case is handled explicitly (choose or merge) rather than picked arbitrarily
* Good, because the interop shape is reusable for future IDE bridges through the host-adapter pattern of ADR-0003
* Bad, because keeping two views derivable means the platform has to define merge / refresh / overwrite policies for both directions
* Bad, because VS Code-specific fields outside the folder list need a documented handling policy
* Bad, because the multi-config merge path can produce a workspace that contains overlapping or conflicting folder entries that need deduplication rules

### Confirmation

Confirmed when:

* `fabric workspace import <path-to-.code-workspace>` produces a Fabric workspace whose members correspond to the folders in the source file
* `fabric workspace export --target=vscode [path]` produces a `.code-workspace` whose `folders` array corresponds to the current Fabric workspace's members
* `fabric workspace init` scans for `.code-workspace` files and behaves as: zero found → empty workspace; one found → offer bootstrap; two or more found → present choose-or-merge prompt
* a non-interactive form (`--from <path>` or equivalent) exists for scripted init flows
* the multi-config merge path produces a single Fabric workspace whose members are the deduplicated union of the chosen `.code-workspace` folder lists
* the `import` and `export` commands are documented as host-adapter-pattern instances per ADR-0003 so that future IDE bridges can follow the same shape

## Pros and Cons of the Options

### Option 1: No Interop with IDE Workspace Files

Fabric workspaces stand alone; users maintain `.code-workspace` separately.

* Good, because the platform stays IDE-agnostic at the cost of no manual bridge code
* Good, because there is no merge / overwrite policy to design
* Bad, because users with existing `.code-workspace` files must recreate their folder set in Fabric by hand
* Bad, because the two views drift silently and there is no way to reconcile them
* Bad, because `fabric workspace init` cannot help users who already have IDE workspace files in the directory

### Option 2: One-Way Import Only from VS Code to Fabric

Fabric can read a `.code-workspace` to bootstrap a Fabric workspace but cannot generate a `.code-workspace` from a Fabric workspace.

* Good, because the simpler direction handles the common adoption case
* Good, because there is no export-side merge policy to design
* Bad, because changes made on the Fabric side cannot be published back to VS Code
* Bad, because users who add a folder via `fabric workspace add` lose VS Code visibility unless they edit the `.code-workspace` manually
* Bad, because the asymmetry encourages drift between the two views

### Option 3: Bidirectional Generation Plus Init-Time Discovery Plus Multi-Config Handling

Fabric supports both `import` and `export`, `fabric workspace init` discovers existing `.code-workspace` files and offers interactive bootstrap, and the multi-config case is handled with an explicit choose-or-merge prompt.

* Good, because the two views remain mutually derivable instead of drifting
* Good, because adoption is frictionless for users who already have a `.code-workspace` setup
* Good, because the multi-config case is handled explicitly rather than left to chance
* Good, because the same pattern can host future IDE bridges (JetBrains, Zed, etc.)
* Bad, because the platform must define merge / overwrite / refresh policies for both directions
* Bad, because VS Code-specific fields outside the folder list need a documented handling policy

## More Information

The interop CLI surface defined by this ADR:

* `fabric workspace import <path-to-.code-workspace>` — generate a Fabric workspace from a VS Code workspace file
* `fabric workspace export --target=vscode [path]` — generate a `.code-workspace` from the current Fabric workspace
* `fabric workspace init` — extended with `.code-workspace` discovery and multi-config handling

The minimal mapping rules:

* a Fabric workspace's members map to the `.code-workspace` `folders` array (each folder's `path` becomes a member; an optional `name` becomes a Fabric workspace member alias)
* VS Code-specific fields (`settings`, `extensions`, `tasks`, `launch`) are not part of the Fabric workspace model; their handling under `import` and `export` (preserve, ignore, or surface as advisory metadata) is left to follow-on design
* multi-config merge takes the union of folder lists across the chosen `.code-workspace` files and deduplicates by path

The init-time multi-config prompt is expected to look approximately like:

```text
Found multiple VS Code workspace files in this directory:
  1) frontend.code-workspace   (5 folders)
  2) backend.code-workspace    (3 folders)
  3) full-stack.code-workspace (8 folders)

Choose action:
  [1|2|3]    pick one to import
  merge      merge all into one Fabric workspace (union of folders, deduplicated)
  none       create an empty Fabric workspace
```

The exact prompt wording, deduplication rules, conflict reporting, and the policy for VS Code-specific fields are intentionally left to follow-on design.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-workspace-vscode-interop`
- **Related decisions**: [ADR-0003](0003-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must support bidirectional generation between Fabric workspaces and VS Code `.code-workspace` files
* `fabric workspace init` must discover existing `.code-workspace` files and offer to bootstrap from them
* the multi-`.code-workspace` case must be handled with an explicit choose-or-merge prompt
* VS Code interop is the first concrete instance of the host-adapter pattern from ADR-0003 applied at the workspace level
