---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0014: Worktrees as a First-Class Concept with Hybrid Ownership

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No First-Class Worktree Concept](#option-1-no-first-class-worktree-concept)
  - [Option 2: First-Class Worktrees with Hybrid Ownership](#option-2-first-class-worktrees-with-hybrid-ownership)
  - [Option 3: Active Gateway Where Fabric Owns All Worktree Creation](#option-3-active-gateway-where-fabric-owns-all-worktree-creation)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-worktrees-as-first-class-with-hybrid-ownership`

## Context and Problem Statement

Cyber Fabric workflows already produce a high density of git worktrees from multiple sources: parallel agent runs (Claude Code's Agent tool with `isolation: "worktree"`), the Ralph Loop plugin, manual `git worktree add` invocations, and tooling such as `gh pr checkout`. These worktrees accumulate without a shared lifecycle owner — orphaned directories pile up, branches go "gone" upstream while their worktree survives locally, and operators have no single source of truth for "what worktrees exist in this workspace and what state are they in?". A `commit-commands:clean_gone` skill already exists to clean up the most common version of this pain, which is itself a signal that the underlying problem is real.

If Fabric does not model worktrees as first-class objects, every multi-repo and parallel-agent workflow re-implements its own discovery and cleanup. If Fabric tries to be the only blessed creator of worktrees (active gateway), it loses immediately because Ralph Loop, Claude Code's Agent tool, and direct `git worktree add` will not route through Fabric. The platform therefore needs a model in which Fabric is worktree-aware regardless of who created the worktree, but distinguishes its own worktrees through ownership metadata so that lifecycle policy can apply intelligently.

## Decision Drivers

* **Multi-source reality** — worktrees in this project come from at least four distinct sources; Fabric cannot pretend it is the only creator
* **Visibility** — operators need a single command that lists every worktree across the workspace with state per worktree
* **Lifecycle ownership** — Fabric-created worktrees should carry ownership metadata so cleanup can be intelligent and safe
* **Operations apply universally** — `list`, `info`, `create`, `drop`, `merge`, and `gc` should work on any worktree, not only Fabric-created ones
* **Web UI readiness** — the planned Fabric web UI needs structured worktree data with the same model the CLI emits
* **Composability with branches** — worktree records reference branches modeled in ADR-0013; the two share one model
* **Workspace aggregation** — `fabric workspace info` (ADR-0011) gains worktree state per workspace member repository
* **Realistic git library** — implementation must use a TypeScript library that fully supports worktrees

## Considered Options

1. **No First-Class Worktree Concept** — Fabric does not model worktrees; users call `git worktree` directly and clean up by hand or with ad hoc skills
2. **First-Class Worktrees with Hybrid Ownership** — Fabric models worktrees as structured data, exposes a CLI surface for them, and operations apply to all worktrees regardless of creator while Fabric-created worktrees carry ownership metadata that enables intelligent cleanup
3. **Active Gateway Where Fabric Owns All Worktree Creation** — Fabric becomes the only blessed way to create worktrees in a Fabric-aware repository; tools that don't route through Fabric are second-class

## Decision Outcome

Chosen option: **Option 2 — First-Class Worktrees with Hybrid Ownership**, because Cyber Fabric must coexist with multiple existing worktree creators (Claude Code Agent tool, Ralph Loop, manual `git`, `gh`) without forcing them to migrate, while still providing a unified discovery, lifecycle, and cleanup surface across the workspace. Active gateway is rejected because the existing creators will not route through Fabric, and a no-op approach loses the visibility benefit entirely.

A **worktree** in Cyber Fabric is structured data that represents one git worktree within a workspace member repository. The worktree model represents at minimum:

* `path` — absolute filesystem path to the worktree
* `repo` — workspace member repository the worktree belongs to
* `branch` — branch checked out in the worktree, as a reference into ADR-0013's branch model
* `is_main` — whether this is the main worktree of the repository
* `dirty` — whether the working tree has uncommitted changes
* `owner` — `fabric` if Fabric created and registered the worktree, `external` otherwise
* `metadata` — ownership metadata when `owner = fabric`: at minimum `creator_id` (for example `claude-code-agent`, `ralph-loop`, `fabric-cli`), `session_id`, and `cleanup_policy` (for example `auto-on-merge`, `auto-on-stop`, `manual`); empty for external worktrees
* `gone` — whether the worktree's branch has been deleted on the remote (composes with the `gone` flag from ADR-0013)

The CLI surface is:

* `fabric worktree list [--repo <r>] [--own | --external | --all] [--json]` — list worktrees across the workspace; defaults to all workspace member repositories. `--own` shows only Fabric-created worktrees; `--external` shows worktrees Fabric did not create; `--all` is the default explicit form.
* `fabric worktree info <path> [--json]` — return the structured record for one worktree
* `fabric worktree create <name> [--branch <b>] [--from <ref>] [--repo <r>] [--owner <id>]` — create a new worktree, register it as Fabric-owned, and attach metadata
* `fabric worktree drop <path> [--delete-branch] [--force]` — remove a worktree; optionally also delete its branch; refuses dirty worktrees unless `--force`
* `fabric worktree merge <path> [--into <target-branch>] [--mode merge|rebase|squash]` — merge the worktree's branch into the target branch (default: workspace default branch), then drop the worktree; this composes branch operations with the drop primitive
* `fabric worktree gc [--dry-run]` — scan for "gone", abandoned, or expired worktrees and prompt for removal; aggressive on Fabric-owned worktrees with cleanup-policy metadata, conservative on external worktrees (always require explicit confirmation)

**Hybrid ownership** means:

* All operations work on all worktrees regardless of creator
* `info` and `list` clearly distinguish `owner: fabric` from `owner: external`
* `create` always tags the resulting worktree as Fabric-owned with metadata
* `gc` uses ownership metadata when present (for example `cleanup_policy: auto-on-stop` lets `gc` reap a stopped agent's worktree without prompting); on external worktrees it falls back to conservative heuristics (offer to remove only if the branch is gone and the worktree is clean) and always requires explicit confirmation
* External worktrees are not silently auto-managed — the platform respects that another tool created them and another tool may still own their lifecycle

**Workspace aggregation**: `fabric workspace info` (ADR-0011) is extended to aggregate worktree state per workspace member repository through this same data model — the workspace info command becomes the canonical knowledge primitive for "the whole picture", and the worktree CLI is the canonical primitive for worktree-specific operations.

**Git library**: the implementation uses **`simple-git`** as the git interaction library. There is no official git SDK from the git project for TypeScript. The realistic alternatives are `simple-git` (CLI wrapper, full worktree support, on the order of five million weekly npm downloads), `isomorphic-git` (pure JavaScript, no full worktree support), and `nodegit` (`libgit2` bindings, `libgit2` itself does not adequately support worktrees). Because worktrees are central to this ADR and only `simple-git` models them adequately, `simple-git` is the only viable choice; `fabric branch` (ADR-0013) reuses the same library for consistency.

The exact storage location of Fabric's worktree-ownership metadata (inside the worktree, in the workspace state file from ADR-0011, or in a dedicated registry) and the precise semantics of `cleanup_policy` values are intentionally left to follow-on design.

### Consequences

* Good, because the workspace gets a single source of truth for worktree visibility regardless of who created each worktree
* Good, because Fabric-created worktrees carry metadata that lets `gc` reason about cleanup without guesswork
* Good, because external worktrees are still operable through Fabric without forcing their creators to migrate
* Good, because `fabric workspace info` aggregates worktree state for the whole workspace, serving both the CLI and the planned web UI from one model
* Good, because `fabric worktree merge` gives users a "merge and clean up" primitive that composes the branch and worktree models
* Bad, because the platform must define cleanup policy semantics carefully so that `gc` does not delete data the user still wanted
* Bad, because ownership metadata storage and lifecycle become part of the architecture surface
* Bad, because external worktrees lacking metadata force conservative defaults that may surprise users who expect Fabric to "just clean up"

### Confirmation

Confirmed when:

* `fabric worktree list`, `fabric worktree info`, `fabric worktree create`, `fabric worktree drop`, `fabric worktree merge`, and `fabric worktree gc` are implemented and behave as the canonical operations defined above
* `fabric worktree list --json` returns the structured record described in this ADR for every worktree, with `--own`, `--external`, and `--all` filters honored
* operations work on all worktrees regardless of creator, while Fabric-created worktrees carry ownership metadata
* `fabric worktree gc` uses ownership metadata aggressively for Fabric-owned worktrees and conservatively for external worktrees with explicit confirmation
* `fabric worktree merge` composes the branch model from ADR-0013 with the worktree drop primitive
* `fabric workspace info` (ADR-0011) is extended to aggregate worktree state per workspace member repository through this model
* the implementation uses `simple-git` as the git interaction library

## Pros and Cons of the Options

### Option 1: No First-Class Worktree Concept

Fabric does not model worktrees; users call `git worktree` directly and clean up by hand or via ad hoc skills.

* Good, because Fabric avoids owning a worktree model
* Good, because the platform stays minimal initially
* Bad, because every multi-repo and parallel-agent workflow re-implements discovery and cleanup
* Bad, because workspace-level visibility ("what worktrees exist?") cannot be answered with one command
* Bad, because the planned web UI has no structured worktree data to render
* Bad, because the existing pain (orphaned directories, the `commit-commands:clean_gone` skill) goes unaddressed

### Option 2: First-Class Worktrees with Hybrid Ownership

Model worktrees as structured data with a CLI surface; operations apply to all worktrees regardless of creator; Fabric-created worktrees carry ownership metadata that enables intelligent cleanup.

* Good, because every worktree creator coexists peacefully — Fabric does not break their workflows
* Good, because Fabric-owned worktrees get rich lifecycle handling while external worktrees remain visible and operable
* Good, because the same model serves CLI and the future web UI
* Good, because cleanup gains real precision through ownership metadata
* Good, because the worktree model composes naturally with the branch model from ADR-0013
* Bad, because cleanup-policy semantics and metadata storage need explicit design
* Bad, because external worktrees without metadata force conservative defaults

### Option 3: Active Gateway Where Fabric Owns All Worktree Creation

Fabric becomes the only blessed way to create worktrees in a Fabric-aware repository; tools that don't route through Fabric are second-class.

* Good, because lifecycle ownership is unambiguous
* Good, because every worktree carries Fabric metadata by construction
* Bad, because Ralph Loop, Claude Code's Agent tool, manual `git`, and `gh` will not route through Fabric — the gateway is politically unrealistic
* Bad, because real existing worktrees would be stuck in second-class status without a migration story
* Bad, because the platform creates conflict with tools whose value users already rely on

## More Information

The CLI surface defined by this ADR:

* `fabric worktree list [--repo <r>] [--own | --external | --all] [--json]`
* `fabric worktree info <path> [--json]`
* `fabric worktree create <name> [--branch <b>] [--from <ref>] [--repo <r>] [--owner <id>]`
* `fabric worktree drop <path> [--delete-branch] [--force]`
* `fabric worktree merge <path> [--into <target-branch>] [--mode merge|rebase|squash]`
* `fabric worktree gc [--dry-run]`

Defaults for `--mode`, the precise heuristics `gc` applies to external worktrees (for example "branch is gone and the worktree is clean"), the storage location of Fabric's ownership metadata, the canonical set of `cleanup_policy` values, and the canonical set of `creator_id` values are intentionally left to follow-on design. The structured contract this ADR fixes is the existence of the worktree CLI surface, the structured `--json` output, the hybrid ownership model, and the integration with both ADR-0011's workspace info and ADR-0013's branch model.

`simple-git` rationale: there is no official git SDK from the git project for TypeScript. `isomorphic-git` is pure JavaScript and works in browsers but does not fully support worktrees. `nodegit` wraps `libgit2`, which itself does not support worktrees adequately. `simple-git` wraps the git CLI and supports worktree commands directly; it has on the order of five million weekly npm downloads, has typed TypeScript bindings, and is actively maintained. Wrapping the CLI is acceptable because the git CLI is the most stable and universally available git interface.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-git-worktrees-first-class`, `cpt-cyber-fabric-fr-git-workspace-aggregation`, `cpt-cyber-fabric-usecase-dev-browse-git-domain`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0011](0011-cpt-cyber-fabric-adr-workspace-as-first-class-concept-v1.md), [ADR-0013](0013-cpt-cyber-fabric-adr-branches-as-first-class-concept-v1.md)

This decision directly addresses the following traceability items:

* Cyber Fabric must model worktrees as first-class structured data
* operations must apply to all worktrees regardless of creator (Fabric, Claude Code Agent tool, Ralph Loop, manual `git`, `gh`)
* Fabric-created worktrees must carry ownership metadata enabling intelligent cleanup
* the worktree CLI surface must support list, info, create, drop, merge, and gc operations
* `fabric worktree merge` composes the branch model from ADR-0013 with the worktree drop primitive
* `fabric worktree gc` is aggressive on Fabric-owned worktrees with policy metadata and conservative on external worktrees
* `fabric workspace info` (ADR-0011) is extended to aggregate worktree state per workspace member repository through this model
* the implementation uses `simple-git` because no official git SDK exists for TypeScript and only `simple-git` provides full worktree support
